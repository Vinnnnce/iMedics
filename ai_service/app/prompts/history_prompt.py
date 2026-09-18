"""
Medical History AI Prompt Templates.
Generates guided questions, clinician summaries, patient recaps,
symptom clusters, risk factors, and timelines from structured history data.
All outputs are assistive-only — never diagnostic or prescriptive.
"""

import json
from typing import Any


# ═══════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ═══════════════════════════════════════════════════════════

HISTORY_SYSTEM_PROMPT = """You are an AI clinical documentation assistant for a telemedicine platform.

Your role is to HELP clinicians structure patient medical history. You are NOT a diagnostic tool.

You ONLY:
- Organize and summarize information the clinician has already entered.
- Suggest follow-up questions that a thorough clinician might ask.
- Group symptoms into body-system clusters for review.
- Identify risk factors from the documented history.
- Generate a patient-friendly recap of what was recorded.
- Build a timeline of symptom onset and progression.

You NEVER:
- Provide a diagnosis or differential diagnosis.
- Prescribe medications, dosages, or treatment plans.
- Give emergency or urgent care instructions.
- Override or replace a clinician's judgment.
- Interpret symptoms as indicative of a specific disease.

If information is insufficient or incomplete, say so clearly.
Always encourage the clinician to use their clinical judgment.
All outputs must be reviewed and approved by a qualified clinician before use."""


# ═══════════════════════════════════════════════════════════
# CLINICIAN SUMMARY PROMPT
# ═══════════════════════════════════════════════════════════

CLINICIAN_SUMMARY_TASK = """ROLE: Clinical documentation assistant — generate a structured history summary for the clinician.
LANGUAGE: {language}

PATIENT CONTEXT:
- Age: {age}, Gender: {gender}
- BMI: {bmi} ({bmi_category})
- Occupation: {occupation}

CHIEF COMPLAINT:
{chief_complaint}

SYMPTOMS (JSON):
{symptoms_json}

MEDICATIONS (JSON):
{medications_json}

CHRONIC CONDITIONS (JSON):
{chronic_conditions_json}

FAMILY HISTORY (JSON):
{family_history_json}

PAST HISTORY (JSON):
{past_history_json}

ALLERGIES (JSON):
{allergies_json}

LIFESTYLE FACTORS (JSON):
{lifestyle_json}

WOUND/INJURY (JSON):
{wound_injury_json}

REPRODUCTIVE HISTORY (JSON):
{reproductive_json}

MENTAL HEALTH (JSON):
{mental_health_json}

IMMUNIZATIONS (JSON):
{immunizations_json}

EXTENSIBLE FIELDS (JSON):
{extensible_json}

TASK:
Generate a structured history summary in standard clinical documentation format.
Include these sections:
1. "chief_complaint": One-sentence summary of the main reason for visit.
2. "hpi": History of Present Illness — 3-5 sentences synthesizing the chief complaint,
   symptoms, onset, progression, and relevant context. Use clinical language.
3. "past_medical_history": Bullet list of chronic conditions, past diagnoses, surgeries.
4. "family_history": Bullet list of relevant family history with relationships.
5. "social_history": Bullet list of lifestyle factors (smoking, alcohol, activity, sleep,
   travel, occupational exposures).
6. "medications": Bullet list of current and recent medications with doses.
7. "allergies": Bullet list of allergies with reactions.
8. "additional_notes": Any other relevant information from extensible fields.

Output JSON with these exact field names. Each field value should be a string (for chief_complaint)
or an array of strings (for all other fields). Be concise and clinically accurate.
Do NOT include any diagnostic impressions or treatment recommendations.

Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# PATIENT RECAP PROMPT
# ═══════════════════════════════════════════════════════════

PATIENT_RECAP_TASK = """ROLE: Patient-facing explainer — generate a simple recap of what was recorded.
LANGUAGE: {language}

PATIENT CONTEXT:
- Age: {age}, Gender: {gender}

CHIEF COMPLAINT:
{chief_complaint}

SYMPTOMS (JSON):
{symptoms_json}

CHRONIC CONDITIONS (JSON):
{chronic_conditions_json}

MEDICATIONS (JSON):
{medications_json}

LIFESTYLE FACTORS (JSON):
{lifestyle_json}

TASK:
Generate a simple, warm explanation of what has been recorded in the patient's medical history.
This is NOT a diagnosis or medical advice — it is a confirmation of what the patient told the clinician.

Output JSON with these fields:
- "title": Short friendly title (e.g., "Your Visit Summary")
- "greeting": One-sentence greeting addressing the patient
- "what_you_reported": Array of 2-4 plain-language sentences summarizing what the patient described
  (symptoms, when they started, how they feel)
- "your_history": Array of 1-3 sentences about relevant medical history mentioned
- "medications_listed": Array of 1-2 sentences about medications recorded
- "next_steps": One sentence encouraging the patient to discuss with their doctor
- "disclaimer": "This summary is for your reference only. It is not a diagnosis. Please consult your doctor."

Be warm, clear, and reassuring. Use simple language a patient can understand.
Do NOT name specific diseases, recommend treatments, or give medical advice.
Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# QUESTION GENERATION PROMPT
# ═══════════════════════════════════════════════════════════

QUESTION_GENERATION_TASK = """ROLE: Clinical questioning assistant — suggest follow-up questions for the clinician.
LANGUAGE: {language}

PATIENT CONTEXT:
- Age: {age}, Gender: {gender}
- Known conditions: {known_conditions}
- Risk factors: {risk_factors}

CHIEF COMPLAINT:
{chief_complaint}

CURRENT SYMPTOMS (JSON):
{symptoms_json}

FAMILY HISTORY (JSON):
{family_history_json}

LIFESTYLE FACTORS (JSON):
{lifestyle_json}

TASK:
Based on the chief complaint, symptoms, and patient risk factors, suggest 5-8 follow-up questions
that a thorough clinician might ask to complete the history. Adapt questions to:
- The patient's age and gender
- Known chronic conditions (e.g., diabetes, heart disease)
- Risk factors (smoking, family history, lifestyle)
- The specific symptoms described

Group questions into categories:
- "symptom_detail": Questions about symptom characteristics (duration, radiation, triggers)
- "associated_symptoms": Questions about related symptoms to explore
- "risk_assessment": Questions about risk factors relevant to the complaint
- "functional_impact": Questions about how symptoms affect daily life

Output JSON:
{{
  "questions": [
    {{
      "category": "symptom_detail",
      "question": "Can you describe the exact location of the chest discomfort?",
      "rationale": "Helps characterize the symptom"
    }}
  ],
  "priority_topics": ["Key area 1", "Key area 2"]
}}

Each question should be phrased as if the clinician is asking the patient.
Do NOT suggest diagnostic questions like "Could this be a heart attack?"
Do NOT suggest treatment questions.
Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# SYMPTOM CLUSTERING PROMPT
# ═══════════════════════════════════════════════════════════

SYMPTOM_CLUSTERING_TASK = """ROLE: Clinical organization assistant — group symptoms into body-system clusters.
LANGUAGE: {language}

SYMPTOMS (JSON):
{symptoms_json}

CHRONIC CONDITIONS (JSON):
{chronic_conditions_json}

TASK:
Group the listed symptoms into body-system clusters for easy review.
Use standard clinical categories:
- "cardiovascular": Chest pain, palpitations, edema, etc.
- "respiratory": Cough, shortness of breath, wheezing, etc.
- "gastrointestinal": Nausea, vomiting, abdominal pain, changes in bowel habits
- "neurological": Headache, dizziness, weakness, numbness, speech difficulty
- "musculoskeletal": Joint pain, back pain, muscle aches, stiffness
- "dermatological": Rash, itching, skin changes, wounds
- "psychiatric": Anxiety, depression, sleep disturbance
- "constitutional": Fever, fatigue, weight loss, appetite changes
- "genitourinary": Urinary symptoms, reproductive concerns
- "endocrine": Thirst, polyuria, heat/cold intolerance

Output JSON:
{{
  "clusters": [
    {{
      "system": "cardiovascular",
      "symptoms": ["Chest pain", "Shortness of breath"],
      "notes": "Symptoms worse at night"
    }}
  ],
  "cross_system_patterns": ["Pattern description if any"]
}}

Only include clusters that have symptoms. Be concise.
Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# RISK FACTOR EXTRACTION PROMPT
# ═══════════════════════════════════════════════════════════

RISK_FACTOR_TASK = """ROLE: Clinical risk factor identification assistant.
LANGUAGE: {language}

PATIENT CONTEXT:
- Age: {age}, Gender: {gender}
- BMI: {bmi} ({bmi_category})

CHRONIC CONDITIONS (JSON):
{chronic_conditions_json}

FAMILY HISTORY (JSON):
{family_history_json}

LIFESTYLE FACTORS (JSON):
{lifestyle_json}

CHIEF COMPLAINT:
{chief_complaint}

TASK:
Identify key risk factors from the patient's documented history.
Present each risk factor as a clear bullet point.

Output JSON:
{{
  "risk_factors": [
    {{
      "factor": "Long-standing Type 2 diabetes (poorly controlled)",
      "category": "chronic_condition",
      "relevance": "Cardiovascular risk"
    }},
    {{
      "factor": "Current smoker (15 cigarettes/day for 20 years)",
      "category": "lifestyle",
      "relevance": "Cardiovascular and respiratory risk"
    }}
  ],
  "summary": "Patient has multiple cardiovascular risk factors."
}}

Categories: chronic_condition, family_history, lifestyle, demographic, other.
Be concise and factual. Do NOT interpret risk as diagnosis.
Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# TIMELINE GENERATION PROMPT
# ═══════════════════════════════════════════════════════════

TIMELINE_TASK = """ROLE: Clinical timeline assistant — build a symptom timeline.
LANGUAGE: {language}

SYMPTOMS (JSON):
{symptoms_json}

CHRONIC CONDITIONS (JSON):
{chronic_conditions_json}

PAST HISTORY (JSON):
{past_history_json}

TASK:
Build a chronological timeline of the patient's medical events and symptom progression.
Order events from earliest to most recent.

Output JSON:
{{
  "timeline": [
    {{
      "event": "Type 2 diabetes diagnosed",
      "approximate_date": "2019",
      "category": "chronic_condition",
      "ongoing": true
    }},
    {{
      "event": "Chest pain started",
      "approximate_date": "2 weeks ago",
      "category": "symptom",
      "ongoing": true,
      "progression": "worsening"
    }}
  ],
  "patterns": [
    "Symptoms progressive over weeks",
    "Chest pain worse in the evening"
  ]
}}

Be concise. Only include events that have timing information.
Output valid JSON only, no markdown or extra text."""


# ═══════════════════════════════════════════════════════════
# BUILDER FUNCTIONS
# ═══════════════════════════════════════════════════════════

def _safe_json(data: Any) -> str:
    """Safely serialize data to JSON string."""
    if data is None:
        return "[]"
    if isinstance(data, str):
        return data
    return json.dumps(data, indent=2, ensure_ascii=False, default=str)


def build_clinician_summary_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for generating a clinician-focused history summary."""
    patient = context.get("patient", {})
    return CLINICIAN_SUMMARY_TASK.format(
        language=language,
        age=patient.get("age", "unknown"),
        gender=patient.get("gender", "unknown"),
        bmi=patient.get("bmi", "unknown"),
        bmi_category=patient.get("bmi_category", "unknown"),
        occupation=patient.get("occupation", "unknown"),
        chief_complaint=context.get("chief_complaint", "Not provided"),
        symptoms_json=_safe_json(context.get("symptoms")),
        medications_json=_safe_json(context.get("medications")),
        chronic_conditions_json=_safe_json(context.get("chronic_conditions")),
        family_history_json=_safe_json(context.get("family_history")),
        past_history_json=_safe_json(context.get("past_history")),
        allergies_json=_safe_json(context.get("allergies")),
        lifestyle_json=_safe_json(context.get("lifestyle")),
        wound_injury_json=_safe_json(context.get("wound_injury")),
        reproductive_json=_safe_json(context.get("reproductive")),
        mental_health_json=_safe_json(context.get("mental_health")),
        immunizations_json=_safe_json(context.get("immunizations")),
        extensible_json=_safe_json(context.get("extensible")),
    )


def build_patient_recap_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for generating a patient-friendly recap."""
    patient = context.get("patient", {})
    return PATIENT_RECAP_TASK.format(
        language=language,
        age=patient.get("age", "unknown"),
        gender=patient.get("gender", "unknown"),
        chief_complaint=context.get("chief_complaint", "Not provided"),
        symptoms_json=_safe_json(context.get("symptoms")),
        chronic_conditions_json=_safe_json(context.get("chronic_conditions")),
        medications_json=_safe_json(context.get("medications")),
        lifestyle_json=_safe_json(context.get("lifestyle")),
    )


def build_question_generation_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for generating follow-up questions."""
    patient = context.get("patient", {})
    return QUESTION_GENERATION_TASK.format(
        language=language,
        age=patient.get("age", "unknown"),
        gender=patient.get("gender", "unknown"),
        known_conditions=_safe_json(patient.get("conditions", [])),
        risk_factors=_safe_json(context.get("risk_factors", [])),
        chief_complaint=context.get("chief_complaint", "Not provided"),
        symptoms_json=_safe_json(context.get("symptoms")),
        family_history_json=_safe_json(context.get("family_history")),
        lifestyle_json=_safe_json(context.get("lifestyle")),
    )


def build_symptom_clustering_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for symptom clustering."""
    return SYMPTOM_CLUSTERING_TASK.format(
        language=language,
        symptoms_json=_safe_json(context.get("symptoms")),
        chronic_conditions_json=_safe_json(context.get("chronic_conditions")),
    )


def build_risk_factor_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for risk factor extraction."""
    patient = context.get("patient", {})
    return RISK_FACTOR_TASK.format(
        language=language,
        age=patient.get("age", "unknown"),
        gender=patient.get("gender", "unknown"),
        bmi=patient.get("bmi", "unknown"),
        bmi_category=patient.get("bmi_category", "unknown"),
        chronic_conditions_json=_safe_json(context.get("chronic_conditions")),
        family_history_json=_safe_json(context.get("family_history")),
        lifestyle_json=_safe_json(context.get("lifestyle")),
        chief_complaint=context.get("chief_complaint", "Not provided"),
    )


def build_timeline_prompt(context: dict, language: str = "en") -> str:
    """Build the prompt for timeline generation."""
    return TIMELINE_TASK.format(
        language=language,
        symptoms_json=_safe_json(context.get("symptoms")),
        chronic_conditions_json=_safe_json(context.get("chronic_conditions")),
        past_history_json=_safe_json(context.get("past_history")),
    )
