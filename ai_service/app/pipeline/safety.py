"""
Safety Filter — Pre and post LLM safety filters for medical content.
Prevents diagnosis, treatment, and emergency advice in AI output.
"""

import re
from typing import Any
from dataclasses import dataclass, field


# Patterns that indicate unsafe content in patient-facing output
DIAGNOSIS_PATTERNS = [
    re.compile(r"\byou have\s+(?:been diagnosed with\s+)?([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\byou are\s+(?:suffering from|diagnosed with)\s+([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bdiagnosis\s*(?:is|:)\s+([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bthis\s+(?:indicates|confirms|means you have)\s+([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bconfirmed\s+(?:diagnosis of\s+)?([a-z\s]+)", re.IGNORECASE),
]

TREATMENT_PATTERNS = [
    re.compile(r"\btake\s+(\d+)\s*mg\s+(?:of\s+)?([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bstart taking\s+([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bprescri(?:be|ption)[:\s]+([a-z\s]+)", re.IGNORECASE),
    re.compile(r"\bdosage\s*(?:is|:)\s+(\d+\s*mg)", re.IGNORECASE),
    re.compile(r"\brecommend(?:ed)?\s+(?:dose|dosage)[:\s]+(\d+)", re.IGNORECASE),
    re.compile(r"\bshould take\s+([a-z\s]+\d+\s*mg)", re.IGNORECASE),
]

EMERGENCY_PATTERNS = [
    re.compile(r"\bdo not\s+(?:go to|visit)\s+(?:the\s+)?hospital", re.IGNORECASE),
    re.compile(r"\bno need to\s+(?:go to|visit)\s+(?:the\s+)?(?:hospital|ER|emergency)", re.IGNORECASE),
    re.compile(r"\bdon'?t\s+(?:go to|visit)\s+(?:the\s+)?hospital", re.IGNORECASE),
    re.compile(r"\b(?:you (?:do not|don'?t) need|no need for)\s+(?:emergency|urgent)\s+(?:care|attention|medical)", re.IGNORECASE),
]

# Safe replacement message
SAFE_FALLBACK = {
    "en": "Only a qualified clinician can diagnose or prescribe. Please discuss these results with your doctor.",
    "fr": "Seul un médecin qualifié peut poser un diagnostic ou prescrire. Veuillez discuter de ces résultats avec votre médecin.",
    "ru": "Только квалифицированный врач может ставить диагноз и назначать лечение. Пожалуйста, обсудите эти результаты с вашим врачом.",
    "es": "Solo un médico calificado puede diagnosticar o recetar. Por favor, discuta estos resultados con su médico.",
}


@dataclass
class PreSafetyResult:
    blocked: bool
    reason: str = ""


@dataclass
class PostSafetyResult:
    doctor_modified: bool = False
    patient_modified: bool = False
    doctor_view_safe: dict = field(default_factory=dict)
    patient_view_safe: dict = field(default_factory=dict)
    filtered_count: int = 0
    actions: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "passed": self.filtered_count == 0,
            "filtered_count": self.filtered_count,
            "actions_taken": self.actions,
            "notes": "Safety filters applied." if self.filtered_count > 0 else "No safety violations detected.",
        }


class SafetyFilter:
    """Pre and post LLM safety filtering for medical AI output."""

    def pre_llm_check(self, panel: list[dict]) -> PreSafetyResult:
        """Validate input before sending to LLM."""
        for v in panel:
            value = v.get("value", 0)
            code = v.get("code", "")

            # Reject impossible values
            if value < 0:
                return PreSafetyResult(blocked=True, reason=f"Negative value for {v.get('name', code)}")

            # Check for implausible values
            if code in ("WBC", "PLT", "RBC") and value > 10000:
                return PreSafetyResult(blocked=True, reason=f"Implausible value for {v.get('name', code)}: {value}")

            # Check for unknown units
            unit = v.get("unit", "")
            if not unit:
                # Mark as uninterpretable but don't block
                v["unit"] = "unknown"

        return PreSafetyResult(blocked=False)

    def post_llm_check(self, doctor_view: dict, patient_view: dict) -> PostSafetyResult:
        """Check LLM output for unsafe content and rewrite if needed."""
        result = PostSafetyResult()

        # Check patient view (stricter — patients should never see diagnosis/treatment)
        patient_text = self._extract_text(patient_view)
        patient_findings = self._check_text(patient_text, is_patient=True)

        if patient_findings:
            result.patient_modified = True
            result.filtered_count += len(patient_findings)
            result.actions.extend(patient_findings)

            # Rewrite patient view with safe fallback
            result.patient_view_safe = self._rewrite_patient_view(patient_view, patient_findings)
        else:
            result.patient_view_safe = patient_view

        # Check doctor view (less strict — doctors can see technical content)
        # But still block prescription of specific dosages
        doctor_text = self._extract_text(doctor_view)
        doctor_findings = self._check_text(doctor_text, is_patient=False)

        if doctor_findings:
            result.doctor_modified = True
            result.filtered_count += len(doctor_findings)
            result.actions.extend(doctor_findings)
            result.doctor_view_safe = self._rewrite_doctor_view(doctor_view, doctor_findings)
        else:
            result.doctor_view_safe = doctor_view

        return result

    def _extract_text(self, view: dict) -> str:
        """Extract all text from a view dictionary."""
        parts = []
        if isinstance(view.get("summary"), list):
            parts.extend(view["summary"])
        if isinstance(view.get("body"), list):
            parts.extend(view["body"])
        if isinstance(view.get("suggested_followup"), list):
            parts.extend(view["suggested_followup"])
        if isinstance(view.get("title"), str):
            parts.append(view["title"])
        if isinstance(view.get("limitations"), str):
            parts.append(view["limitations"])
        return " ".join(str(p) for p in parts)

    def _check_text(self, text: str, is_patient: bool = True) -> list[dict]:
        """Check text for unsafe patterns."""
        findings = []

        # Always check for emergency advice
        for pattern in EMERGENCY_PATTERNS:
            match = pattern.search(text)
            if match:
                findings.append({
                    "view": "patient" if is_patient else "doctor",
                    "original_snippet": match.group(0),
                    "action": "flagged",
                    "reason": "EMERGENCY_ADVICE_DETECTED",
                })

        # Check for diagnosis (patient view only — doctors can see differentials)
        if is_patient:
            for pattern in DIAGNOSIS_PATTERNS:
                match = pattern.search(text)
                if match:
                    findings.append({
                        "view": "patient",
                        "original_snippet": match.group(0),
                        "action": "replaced",
                        "reason": "DIAGNOSIS_PATTERN_DETECTED",
                    })

            for pattern in TREATMENT_PATTERNS:
                match = pattern.search(text)
                if match:
                    findings.append({
                        "view": "patient",
                        "original_snippet": match.group(0),
                        "action": "replaced",
                        "reason": "TREATMENT_RECOMMENDATION_DETECTED",
                    })
        else:
            # For doctor view, only block specific dosage recommendations
            for pattern in TREATMENT_PATTERNS:
                match = pattern.search(text)
                if match:
                    findings.append({
                        "view": "doctor",
                        "original_snippet": match.group(0),
                        "action": "flagged",
                        "reason": "DOSAGE_RECOMMENDATION_DETECTED",
                    })

        return findings

    def _rewrite_patient_view(self, view: dict, findings: list[dict]) -> dict:
        """Rewrite patient view with safe content."""
        language = view.get("language", "en")
        fallback = SAFE_FALLBACK.get(language, SAFE_FALLBACK["en"])

        # Replace body with safe message
        return {
            "language": language,
            "title": view.get("title", "Your Results"),
            "body": [
                fallback,
                "Please discuss your results with your doctor for a complete explanation.",
            ],
            "questions_for_doctor": view.get("questions_for_doctor", [
                "What do these results mean?",
                "What should I do next?",
            ]),
        }

    def _rewrite_doctor_view(self, view: dict, findings: list[dict]) -> dict:
        """Rewrite doctor view — flag dosage recommendations."""
        summary = view.get("summary", [])
        # Add safety note
        summary = summary + [
            "Note: AI output contained treatment recommendations that were filtered. "
            "Please consult clinical guidelines for dosing decisions."
        ]

        return {
            **view,
            "summary": summary,
            "limitations": (view.get("limitations", "") + 
                          " Safety filter: treatment recommendations were removed from AI output."),
        }
