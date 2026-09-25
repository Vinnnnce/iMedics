"""
Lab Analysis Router — Main endpoint for AI lab result analysis.
Orchestrates the full pipeline: normalize → rule engine → RAG → LLM → safety.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any
import time

from app.models.schemas import (
    LabAnalysisRequest,
    LabAnalysisResponse,
    PatientContext,
    LabValue,
    RuleFlags,
)
from app.pipeline.normalize import Normalizer
from app.pipeline.rule_engine import RuleEngine
from app.pipeline.rag import RAGEngine
from app.pipeline.llm import LLMClient
from app.pipeline.safety import SafetyFilter
from app.prompts.doctor_prompt import build_doctor_prompt
from app.prompts.patient_prompt import build_patient_prompt

router = APIRouter()


@router.post("/lab/analyse", response_model=LabAnalysisResponse)
async def analyse_lab_results(request: Request, payload: LabAnalysisRequest):
    """
    Full AI analysis pipeline for lab results.

    Stages:
    1. Normalize & validate values
    2. Rule-based flagging (ranges, critical, trends)
    3. Build context for LLM
    4. RAG retrieval of relevant medical evidence
    5. LLM generation (doctor + patient views)
    6. Safety post-processing
    7. Uncertainty & escalation assessment
    """
    start_time = time.time()
    rag: RAGEngine = request.app.state.rag
    safety: SafetyFilter = request.app.state.safety
    llm: LLMClient = request.app.state.llm

    # ── Stage 1: Normalize & Validate ──────────────────────────
    normalizer = Normalizer()
    try:
        normalized = normalizer.normalize(payload.panel, payload.patient)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Normalization error: {e}")

    # Pre-LLM safety: check for impossible values
    pre_safety = safety.pre_llm_check(normalized)
    if pre_safety.blocked:
        return _blocked_response(payload.analysis_id, pre_safety.reason, start_time)

    # ── Stage 2: Rule Engine ───────────────────────────────────
    rule_engine = RuleEngine()
    rule_flags = rule_engine.evaluate(
        normalized,
        previous_results=payload.patient.previous_results,
    )

    # ── Stage 3: Build Context ─────────────────────────────────
    context = _build_context(payload.patient, normalized, rule_flags)

    # ── Stage 4: RAG Retrieval ────────────────────────────────
    evidence = await rag.retrieve(
        panel_type=payload.panel[0].code if payload.panel else "",
        flags=rule_flags,
        top_k=3,
    )

    # ── Stage 5: LLM Generation ───────────────────────────────
    doctor_prompt = build_doctor_prompt(context, evidence, payload.options.doctor_language)
    patient_prompt = build_patient_prompt(context, evidence, payload.options.patient_language)

    try:
        doctor_view = await llm.generate_json(doctor_prompt, max_tokens=500)
    except Exception as e:
        doctor_view = {
            "summary": [f"AI analysis failed: {str(e)}. Manual review required."],
            "suggested_followup": [],
            "urgency_level": "routine",
            "limitations": "LLM generation failed.",
        }

    try:
        patient_view = await llm.generate_json(patient_prompt, max_tokens=400)
    except Exception as e:
        patient_view = {
            "language": payload.options.patient_language,
            "title": "Results Available",
            "body": ["Your lab results are available. Please discuss them with your doctor."],
            "questions_for_doctor": ["What do these results mean?"],
        }

    # ── Stage 6: Safety Post-Processing ────────────────────────
    safety_result = safety.post_llm_check(doctor_view, patient_view)

    if safety_result.doctor_modified:
        doctor_view = safety_result.doctor_view_safe
    if safety_result.patient_modified:
        patient_view = safety_result.patient_view_safe

    # ── Stage 7: Uncertainty & Escalation ──────────────────────
    confidence = _assess_confidence(rule_flags, doctor_view, payload.patient)

    # Escalation: critical flags → doctor gets urgent, patient gets neutral message
    if rule_flags.critical:
        doctor_view["urgency_level"] = "urgent"
        patient_view = _escalate_patient_view(patient_view, payload.options.patient_language)

    processing_time = int((time.time() - start_time) * 1000)

    return LabAnalysisResponse(
        analysis_id=payload.analysis_id,
        status="completed_with_safety_override" if safety_result.filtered_count > 0 else "completed",
        doctor_view=doctor_view,
        patient_view=patient_view,
        flags=rule_flags,
        urgency_level=doctor_view.get("urgency_level", "routine"),
        confidence=confidence,
        safety=safety_result.to_dict(),
        metadata={
            "model": f"{llm.provider}/{llm.model}",
            "rag_documents_retrieved": len(evidence),
            "processing_time_ms": processing_time,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )


def _build_context(patient: PatientContext, panel: list[LabValue], rule_flags: RuleFlags) -> dict:
    """Build compact JSON context for LLM."""
    return {
        "patient": {
            "age": patient.age,
            "sex": patient.sex,
            "conditions": patient.conditions,
            "medications": patient.medications,
        },
        "panel": [v.model_dump() for v in panel],
        "history": {
            "previous_results": [r.model_dump() for r in (patient.previous_results or [])],
        },
        "rule_flags": rule_flags.model_dump(),
    }


def _assess_confidence(rule_flags: RuleFlags, doctor_view: dict, patient: PatientContext) -> dict:
    """Assess confidence in the AI output."""
    reasons = []

    # Rule-LLM consistency check
    llm_urgency = doctor_view.get("urgency_level", "routine")
    if rule_flags.critical and llm_urgency != "urgent":
        reasons.append("Rule engine and LLM disagree on urgency")
        level = "low"
    elif len(patient.previous_results or []) == 0:
        reasons.append("No historical data for trend analysis")
        level = "medium"
    elif rule_flags.critical:
        reasons.append("Critical flags present — escalated to doctor")
        level = "medium"
    else:
        reasons.append("Rule engine and LLM agree on key findings")
        level = "high"

    return {"level": level, "reasons": reasons}


def _escalate_patient_view(patient_view: dict, language: str) -> dict:
    """Replace patient view with neutral message when critical flags present."""
    messages = {
        "en": {
            "title": "Your Results Need Review",
            "body": [
                "Some of your results need attention from your doctor.",
                "Please contact your doctor promptly to discuss these results.",
            ],
            "questions_for_doctor": [
                "What do these results mean for me?",
                "What should I do next?",
                "Do I need additional tests?",
            ],
        },
        "fr": {
            "title": "Vos résultats nécessitent un examen",
            "body": [
                "Certains de vos résultats nécessitent l'attention de votre médecin.",
                "Veuillez contacter votre médecin rapidement pour discuter de ces résultats.",
            ],
            "questions_for_doctor": [
                "Que signifient ces résultats pour moi ?",
                "Que dois-je faire ensuite ?",
                "Ai-je besoin d'examens supplémentaires ?",
            ],
        },
        "ru": {
            "title": "Ваши результаты требуют проверки",
            "body": [
                "Некоторые из ваших результатов требуют внимания врача.",
                "Пожалуйста, свяжитесь с врачом в ближайшее время для обсуждения результатов.",
            ],
            "questions_for_doctor": [
                "Что означают эти результаты для меня?",
                "Что мне делать дальше?",
                "Нужны ли мне дополнительные анализы?",
            ],
        },
        "es": {
            "title": "Sus resultados necesitan revisión",
            "body": [
                "Algunos de sus resultados necesitan atención de su médico.",
                "Comuníquese con su médico pronto para discutir estos resultados.",
            ],
            "questions_for_doctor": [
                "¿Qué significan estos resultados para mí?",
                "¿Qué debo hacer ahora?",
                "¿Necesito pruebas adicionales?",
            ],
        },
    }

    return messages.get(language, messages["en"])


def _blocked_response(analysis_id: str, reason: str, start_time: float) -> LabAnalysisResponse:
    """Return a blocked response when pre-LLM safety filter triggers."""
    return LabAnalysisResponse(
        analysis_id=analysis_id,
        status="blocked",
        doctor_view={
            "summary": [f"Analysis blocked: {reason}. Manual review required."],
            "suggested_followup": [],
            "urgency_level": "routine",
            "limitations": "Pre-LLM safety filter triggered.",
        },
        patient_view={
            "language": "en",
            "title": "Results Available",
            "body": ["Your lab results are available. Please discuss them with your doctor."],
            "questions_for_doctor": ["What do these results mean?"],
        },
        flags=RuleFlags(critical=[], non_critical=[], trend_summary={}),
        urgency_level="routine",
        confidence={"level": "low", "reasons": ["Pre-LLM safety filter blocked analysis"]},
        safety={"passed": False, "filtered_count": 0, "notes": f"Blocked: {reason}"},
        metadata={
            "model": "none",
            "rag_documents_retrieved": 0,
            "processing_time_ms": int((time.time() - start_time) * 1000),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )
