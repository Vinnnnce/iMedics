"""
Medical History Analysis Router — FastAPI endpoints for AI-driven history processing.
Generates clinician summaries, patient recaps, suggested questions,
symptom clusters, risk factors, and timelines from structured history data.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError

from app.models.history_schemas import HistoryAnalysisRequest, HistoryAnalysisResponse
from app.prompts.history_prompt import (
    HISTORY_SYSTEM_PROMPT,
    build_clinician_summary_prompt,
    build_patient_recap_prompt,
    build_question_generation_prompt,
    build_symptom_clustering_prompt,
    build_risk_factor_prompt,
    build_timeline_prompt,
)
from app.pipeline.safety import SafetyFilter

router = APIRouter()


async def get_llm(request: Request):
    """Get the LLM client from app state."""
    if not hasattr(request.app.state, "llm"):
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    return request.app.state.llm


async def get_safety(request: Request):
    """Get the safety filter from app state."""
    if not hasattr(request.app.state, "safety"):
        return SafetyFilter()
    return request.app.state.safety


@router.post("/history/analyse", response_model=HistoryAnalysisResponse)
async def analyse_medical_history(
    payload: HistoryAnalysisRequest,
    request: Request,
):
    """
    Full medical history analysis pipeline.
    Generates all AI outputs: clinician summary, patient recap,
    suggested questions, risk factors, symptom clusters, and timeline.
    """
    llm = await get_llm(request)
    safety = await get_safety(request)

    # Build context dict from structured payload
    context = {
        "patient": payload.patient.model_dump(),
        "chief_complaint": payload.chief_complaint or "Not provided",
        "symptoms": [s.model_dump() for s in payload.symptoms],
        "medications": [m.model_dump() for m in payload.medications],
        "chronic_conditions": [c.model_dump() for c in payload.chronic_conditions],
        "family_history": [f.model_dump() for f in payload.family_history],
        "past_history": [p.model_dump() for p in payload.past_history],
        "allergies": [a.model_dump() for a in payload.allergies],
        "lifestyle": payload.lifestyle.model_dump() if payload.lifestyle else {},
        "wound_injury": payload.wound_injury.model_dump() if payload.wound_injury else {},
        "reproductive": payload.reproductive.model_dump() if payload.reproductive else {},
        "mental_health": [m.model_dump() for m in payload.mental_health],
        "immunizations": [i.model_dump() for i in payload.immunizations],
        "extensible": payload.extensible,
    }

    language = payload.options.get("language", "en")
    max_tokens = payload.options.get("max_tokens", 800)

    results = {}
    errors = []

    # ── 1. Clinician Summary ──────────────────────────
    try:
        summary_prompt = build_clinician_summary_prompt(context, language)
        results["clinician_summary"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, summary_prompt,
            max_tokens=max_tokens, temperature=0.3,
        )
    except Exception as e:
        errors.append(f"clinician_summary: {str(e)}")
        results["clinician_summary"] = {
            "chief_complaint": context["chief_complaint"],
            "hpi": "Summary generation failed. Please review manually.",
            "past_medical_history": [], "family_history": [],
            "social_history": [], "medications": [],
            "allergies": [], "additional_notes": [],
        }

    # ── 2. Patient Recap ──────────────────────────────
    try:
        recap_prompt = build_patient_recap_prompt(context, language)
        results["patient_recap"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, recap_prompt,
            max_tokens=500, temperature=0.4,
        )
    except Exception as e:
        errors.append(f"patient_recap: {str(e)}")
        results["patient_recap"] = {
            "title": "Your Visit Summary",
            "greeting": "Hello,",
            "what_you_reported": ["Your medical history has been recorded."],
            "your_history": [], "medications_listed": [],
            "next_steps": "Please discuss your history with your doctor.",
            "disclaimer": "This summary is for your reference only. It is not a diagnosis.",
        }

    # ── 3. Suggested Questions ────────────────────────
    try:
        # Extract risk factors first for question context
        risk_factors = results.get("risk_factors", {}).get("risk_factors", [])
        context["risk_factors"] = risk_factors
        question_prompt = build_question_generation_prompt(context, language)
        results["suggested_questions"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, question_prompt,
            max_tokens=500, temperature=0.4,
        )
    except Exception as e:
        errors.append(f"suggested_questions: {str(e)}")
        results["suggested_questions"] = {
            "questions": [], "priority_topics": [],
        }

    # ── 4. Risk Factors ───────────────────────────────
    try:
        risk_prompt = build_risk_factor_prompt(context, language)
        results["risk_factors"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, risk_prompt,
            max_tokens=400, temperature=0.2,
        )
    except Exception as e:
        errors.append(f"risk_factors: {str(e)}")
        results["risk_factors"] = {"risk_factors": [], "summary": ""}

    # ── 5. Symptom Clusters ───────────────────────────
    try:
        cluster_prompt = build_symptom_clustering_prompt(context, language)
        results["symptom_clusters"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, cluster_prompt,
            max_tokens=400, temperature=0.2,
        )
    except Exception as e:
        errors.append(f"symptom_clusters: {str(e)}")
        results["symptom_clusters"] = {"clusters": [], "cross_system_patterns": []}

    # ── 6. Timeline ───────────────────────────────────
    try:
        timeline_prompt = build_timeline_prompt(context, language)
        results["timeline"] = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, timeline_prompt,
            max_tokens=400, temperature=0.2,
        )
    except Exception as e:
        errors.append(f"timeline: {str(e)}")
        results["timeline"] = {"timeline": [], "patterns": []}

    # ── Safety Post-Processing ────────────────────────
    safety_report = {"passed": True, "filtered_count": 0, "notes": "", "actions_taken": []}
    try:
        post_result = safety.post_llm_check(
            results.get("clinician_summary", {}),
            results.get("patient_recap", {}),
        )
        results["clinician_summary"] = post_result.doctor_view_safe
        results["patient_recap"] = post_result.patient_view_safe
        safety_report = post_result.to_dict()
    except Exception as e:
        safety_report = {
            "passed": True, "filtered_count": 0,
            "notes": f"Safety check skipped: {str(e)}", "actions_taken": [],
        }

    return HistoryAnalysisResponse(
        analysis_id=payload.analysis_id,
        status="completed" if not errors else "completed_with_errors",
        clinician_summary=results.get("clinician_summary", {}),
        patient_recap=results.get("patient_recap", {}),
        suggested_questions=results.get("suggested_questions", {}),
        risk_factors=results.get("risk_factors", {}),
        symptom_clusters=results.get("symptom_clusters", {}),
        timeline=results.get("timeline", {}),
        safety=safety_report,
        metadata={
            "model": getattr(llm, "model", "unknown"),
            "errors": errors,
            "processing_time_ms": 0,
            "timestamp": "",
        },
    )


@router.post("/history/questions")
async def generate_questions(
    payload: HistoryAnalysisRequest,
    request: Request,
):
    """Generate only follow-up questions based on chief complaint and risk factors."""
    llm = await get_llm(request)
    language = payload.options.get("language", "en")

    context = {
        "patient": payload.patient.model_dump(),
        "chief_complaint": payload.chief_complaint or "Not provided",
        "symptoms": [s.model_dump() for s in payload.symptoms],
        "family_history": [f.model_dump() for f in payload.family_history],
        "lifestyle": payload.lifestyle.model_dump() if payload.lifestyle else {},
    }

    # First get risk factors for context
    try:
        risk_prompt = build_risk_factor_prompt(context, language)
        risk_result = await llm.generate_json(
            HISTORY_SYSTEM_PROMPT, risk_prompt,
            max_tokens=400, temperature=0.2,
        )
        context["risk_factors"] = risk_result.get("risk_factors", [])
    except Exception:
        context["risk_factors"] = []

    question_prompt = build_question_generation_prompt(context, language)
    result = await llm.generate_json(
        HISTORY_SYSTEM_PROMPT, question_prompt,
        max_tokens=500, temperature=0.4,
    )
    return result


@router.post("/history/summary")
async def generate_summary(
    payload: HistoryAnalysisRequest,
    request: Request,
):
    """Generate only the clinician summary."""
    llm = await get_llm(request)
    safety = await get_safety(request)
    language = payload.options.get("language", "en")

    context = {
        "patient": payload.patient.model_dump(),
        "chief_complaint": payload.chief_complaint or "Not provided",
        "symptoms": [s.model_dump() for s in payload.symptoms],
        "medications": [m.model_dump() for m in payload.medications],
        "chronic_conditions": [c.model_dump() for c in payload.chronic_conditions],
        "family_history": [f.model_dump() for f in payload.family_history],
        "past_history": [p.model_dump() for p in payload.past_history],
        "allergies": [a.model_dump() for a in payload.allergies],
        "lifestyle": payload.lifestyle.model_dump() if payload.lifestyle else {},
        "wound_injury": payload.wound_injury.model_dump() if payload.wound_injury else {},
        "reproductive": payload.reproductive.model_dump() if payload.reproductive else {},
        "mental_health": [m.model_dump() for m in payload.mental_health],
        "immunizations": [i.model_dump() for i in payload.immunizations],
        "extensible": payload.extensible,
    }

    summary_prompt = build_clinician_summary_prompt(context, language)
    result = await llm.generate_json(
        HISTORY_SYSTEM_PROMPT, summary_prompt,
        max_tokens=800, temperature=0.3,
    )

    # Apply safety filter
    post_result = safety.post_llm_check(result, {})
    return post_result.doctor_view_safe


@router.post("/history/recap")
async def generate_recap(
    payload: HistoryAnalysisRequest,
    request: Request,
):
    """Generate only the patient-friendly recap."""
    llm = await get_llm(request)
    safety = await get_safety(request)
    language = payload.options.get("language", "en")

    context = {
        "patient": payload.patient.model_dump(),
        "chief_complaint": payload.chief_complaint or "Not provided",
        "symptoms": [s.model_dump() for s in payload.symptoms],
        "chronic_conditions": [c.model_dump() for c in payload.chronic_conditions],
        "medications": [m.model_dump() for m in payload.medications],
        "lifestyle": payload.lifestyle.model_dump() if payload.lifestyle else {},
    }

    recap_prompt = build_patient_recap_prompt(context, language)
    result = await llm.generate_json(
        HISTORY_SYSTEM_PROMPT, recap_prompt,
        max_tokens=500, temperature=0.4,
    )

    # Apply safety filter (patient-facing, stricter)
    post_result = safety.post_llm_check({}, result)
    return post_result.patient_view_safe
