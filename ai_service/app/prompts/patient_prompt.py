"""
Patient-focused prompt template.
Generates plain-language explanations without diagnosis or treatment advice.
"""

import json


PATIENT_SYSTEM_PROMPT = """You are an AI assistant for a telemedicine platform.

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


PATIENT_TASK_PROMPT = """ROLE: Patient-facing explainer of lab results.
LANGUAGE: {patient_language}

CONTEXT:
- Patient: age {age}, sex {sex}
- Lab panel (JSON): {panel_json}
- Rule-based flags: {rule_flags}
- Retrieved medical evidence: {evidence}

TASK:
1. Explain in simple words what the main lab findings mean.
2. Avoid medical jargon where possible.
3. DO NOT:
   - Name specific diseases.
   - Recommend or describe treatments, drugs, or dosages.
   - Give emergency instructions.
4. Encourage the patient to discuss results with their doctor.

Output JSON with fields:
- "title": short title string
- "body": array of 2-4 paragraph strings
- "questions_for_doctor": array of 3 question strings

Be warm, clear, and reassuring. Output valid JSON only."""


def build_patient_prompt(context: dict, evidence: list[dict], language: str = "en") -> str:
    """Build the full prompt for patient-facing LLM generation."""
    patient = context.get("patient", {})
    panel = context.get("panel", [])
    rule_flags = context.get("rule_flags", {})

    # Format evidence snippets (simplified for patient context)
    evidence_text = "\n".join(
        f"- {e.get('content', '')}"
        for e in evidence
    ) if evidence else "No specific evidence retrieved."

    return PATIENT_TASK_PROMPT.format(
        patient_language=language,
        age=patient.get("age", "unknown"),
        sex=patient.get("sex", "unknown"),
        panel_json=json.dumps(panel, indent=2),
        rule_flags=json.dumps(rule_flags, indent=2),
        evidence=evidence_text,
    )
