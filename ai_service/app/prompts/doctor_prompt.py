"""
Doctor-focused prompt template.
Generates technical, concise clinical decision support output.
"""

import json


DOCTOR_SYSTEM_PROMPT = """You are an AI assistant for a telemedicine platform.

You ONLY:
- Explain lab results and risk factors.
- Suggest what a clinician might want to review.
- Use evidence from the provided medical snippets.

You NEVER:
- Give a definitive diagnosis.
- Prescribe medications, dosages, or treatment plans.
- Override or replace a clinician's judgment.

If information is insufficient, say so clearly and recommend consulting the doctor.
Always respect the requested output language and tone."""


DOCTOR_TASK_PROMPT = """ROLE: Clinical decision-support assistant for doctors.
LANGUAGE: {doctor_language}

CONTEXT:
- Patient: age {age}, sex {sex}
- Conditions: {conditions}
- Medications: {medications}
- Lab panel (JSON): {panel_json}
- Rule-based flags: {rule_flags}
- Retrieved medical evidence: {evidence}

TASK:
1. Summarize key abnormalities and trends in 5-8 bullet points.
2. Suggest POSSIBLE areas for further evaluation (e.g., 'consider iron studies'),
   but DO NOT state a diagnosis.
3. Highlight any values that typically warrant urgent attention.
4. Output JSON with fields:
   - "summary": array of bullet point strings
   - "suggested_followup": array of suggestion strings
   - "urgency_level": one of "routine", "soon", "urgent"
   - "limitations": string with caveats

Be concise and strictly evidence-grounded. Output valid JSON only."""


def build_doctor_prompt(context: dict, evidence: list[dict], language: str = "en") -> str:
    """Build the full prompt for doctor-facing LLM generation."""
    patient = context.get("patient", {})
    panel = context.get("panel", [])
    rule_flags = context.get("rule_flags", {})

    # Format evidence snippets
    evidence_text = "\n".join(
        f"- {e.get('title', '')}: {e.get('content', '')}"
        for e in evidence
    ) if evidence else "No specific evidence retrieved."

    return DOCTOR_TASK_PROMPT.format(
        doctor_language=language,
        age=patient.get("age", "unknown"),
        sex=patient.get("sex", "unknown"),
        conditions=", ".join(patient.get("conditions", [])) or "none",
        medications=", ".join(patient.get("medications", [])) or "none",
        panel_json=json.dumps(panel, indent=2),
        rule_flags=json.dumps(rule_flags, indent=2),
        evidence=evidence_text,
    )
