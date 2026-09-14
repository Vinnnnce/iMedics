"""
Normalization Pipeline — Lab result ingestion and standardization.
Maps to LOINC codes, validates units, checks for impossible values.
"""

from typing import Any
import re


# LOINC code mapping for common lab values
LOINC_MAP = {
    "HGB": "718-7",
    "HCT": "4544-3",
    "WBC": "6690-2",
    "RBC": "789-8",
    "PLT": "777-3",
    "MCV": "787-2",
    "MCH": "785-6",
    "MCHC": "786-4",
    "GLU": "2339-0",
    "CRE": "2160-0",
    "BUN": "3074-6",
    "NA": "2951-2",
    "K": "2823-3",
    "CL": "2075-0",
    "CA": "17861-6",
    "ALB": "1751-7",
    "TP": "2885-2",
    "BIL": "1975-2",
    "ALT": "1742-6",
    "AST": "1920-8",
    "ALP": "6768-6",
    "GGT": "2324-2",
    "CHOL": "2093-3",
    "TRIG": "14927-8",
    "HDL": "2085-9",
    "LDL": "18262-6",
    "TSH": "3016-3",
    "FT4": "3024-7",
    "FT3": "3051-0",
    "HBA1C": "4548-4",
    "INR": "3173-2",
    "PT": "5902-2",
    "FERRITIN": "2276-4",
    "IRON": "2502-3",
    "TIBC": "2500-7",
}

# Unit conversion factors (to standard units)
UNIT_CONVERSIONS = {
    # Hemoglobin: g/dL → g/L (factor 10)
    "HGB": {"g/dL": ("g/L", 10), "g/L": ("g/L", 1)},
    # Glucose: mg/dL → mmol/L (factor 0.0555)
    "GLU": {"mg/dL": ("mmol/L", 0.0555), "mmol/L": ("mmol/L", 1)},
    # Creatinine: mg/dL → μmol/L (factor 88.4)
    "CRE": {"mg/dL": ("μmol/L", 88.4), "μmol/L": ("μmol/L", 1)},
    # Cholesterol: mg/dL → mmol/L (factor 0.0259)
    "CHOL": {"mg/dL": ("mmol/L", 0.0259), "mmol/L": ("mmol/L", 1)},
}


class Normalizer:
    """Normalizes lab values: LOINC mapping, unit conversion, validation."""

    def normalize(self, panel: list[Any], patient: Any) -> list[dict]:
        """
        Normalize a list of lab values.

        Args:
            panel: List of lab value dictionaries.
            patient: Patient context (age, sex).

        Returns:
            Normalized list of lab value dictionaries.
        """
        normalized = []

        for v in panel:
            code = v.get("code", "").upper()
            name = v.get("name", code)
            value = float(v.get("value", 0))
            unit = v.get("unit", "")
            ref_low = v.get("ref_low")
            ref_high = v.get("ref_high")

            # Map to LOINC if not already provided
            loinc = v.get("loinc") or LOINC_MAP.get(code)

            # Unit conversion
            if code in UNIT_CONVERSIONS and unit in UNIT_CONVERSIONS[code]:
                target_unit, factor = UNIT_CONVERSIONS[code][unit]
                value = round(value * factor, 2)
                unit = target_unit
                if ref_low:
                    ref_low = round(ref_low * factor, 2)
                if ref_high:
                    ref_high = round(ref_high * factor, 2)

            # Validate: reject impossible values
            if value < 0:
                raise ValueError(f"Impossible value for {name}: {value} (negative)")

            if code in ("WBC", "PLT", "RBC") and value > 10000:
                raise ValueError(f"Implausible value for {name}: {value}")

            normalized.append({
                "code": code,
                "loinc": loinc,
                "name": name,
                "value": value,
                "unit": unit,
                "ref_low": ref_low,
                "ref_high": ref_high,
                "flag": v.get("flag", self._compute_flag(value, ref_low, ref_high)),
            })

        return normalized

    def _compute_flag(self, value: float, ref_low: float | None, ref_high: float | None) -> str:
        if ref_low and value < ref_low:
            return "LOW"
        if ref_high and value > ref_high:
            return "HIGH"
        return "NORMAL"
