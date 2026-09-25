"""
Rule Engine — Deterministic medical flagging before LLM.
Checks reference ranges, critical thresholds, and trends.
"""

from typing import Any
from datetime import datetime

# Critical value thresholds (non-exhaustive, based on common clinical guidelines)
CRITICAL_THRESHOLDS = {
    "HGB": {"low": 7.0, "high": 20.0},
    "PLT": {"low": 50, "high": 1000},
    "WBC": {"low": 2.0, "high": 50.0},
    "RBC": {"low": 2.0, "high": 8.0},
    "GLU": {"low": 40, "high": 500},
    "K": {"low": 2.5, "high": 7.0},
    "NA": {"low": 120, "high": 160},
    "CA": {"low": 6.0, "high": 14.0},
    "MG": {"low": 0.8, "high": 4.0},
    "PO4": {"low": 1.0, "high": 7.0},
    "INR": {"high": 5.0},
    "PT": {"high": 30},
    "BIL": {"high": 20},
    "CRE": {"high": 10},
    "BUN": {"high": 100},
    "TSH": {"low": 0.1, "high": 50},
    "FT4": {"low": 5, "high": 25},
    "HBA1C": {"high": 12},
    "FERRITIN": {"high": 1000},
}


class RuleEngine:
    """Deterministic rule-based flagging engine."""

    def evaluate(
        self,
        panel: list[dict],
        previous_results: list[Any] = None,
    ) -> dict:
        """
        Evaluate lab values against rules.

        Returns:
            Dictionary with critical flags, non-critical flags, and trend summary.
        """
        critical = []
        non_critical = []
        trend_summary = {}

        for v in panel:
            code = v["code"]
            value = v["value"]
            ref_low = v.get("ref_low")
            ref_high = v.get("ref_high")

            # Range check
            flag = v.get("flag", "NORMAL")
            if flag == "LOW" or (ref_low and value < ref_low):
                flag = "LOW"
            elif flag == "HIGH" or (ref_high and value > ref_high):
                flag = "HIGH"

            # Critical threshold check
            thresholds = CRITICAL_THRESHOLDS.get(code, {})
            is_critical = False
            if "low" in thresholds and value <= thresholds["low"]:
                is_critical = True
                critical.append({
                    "code": code,
                    "name": v["name"],
                    "flag": "LOW",
                    "value": value,
                    "unit": v.get("unit", ""),
                    "message": f"{v['name']} ({value} {v.get('unit', '')}) is critically low (threshold: {thresholds['low']})",
                })
            elif "high" in thresholds and value >= thresholds["high"]:
                is_critical = True
                critical.append({
                    "code": code,
                    "name": v["name"],
                    "flag": "HIGH",
                    "value": value,
                    "unit": v.get("unit", ""),
                    "message": f"{v['name']} ({value} {v.get('unit', '')}) is critically high (threshold: {thresholds['high']})",
                })

            # Non-critical out-of-range
            if not is_critical and flag != "NORMAL":
                non_critical.append({
                    "code": code,
                    "name": v["name"],
                    "flag": flag,
                    "value": value,
                    "unit": v.get("unit", ""),
                    "message": f"{v['name']} is {flag.lower()} ({value} {v.get('unit', '')})",
                })

            # Trend analysis
            if previous_results:
                trend = self._analyze_trend(code, value, previous_results)
                if trend:
                    trend_summary[code] = trend

        return {
            "critical": critical,
            "non_critical": non_critical,
            "trend_summary": trend_summary,
        }

    def _analyze_trend(self, code: str, current: float, previous_results: list[Any]) -> dict | None:
        """Compare current value to most recent previous result."""
        # Find most recent previous result for this code
        most_recent = None
        most_recent_date = None

        for prev in previous_results:
            for v in prev.get("values", []):
                if v.get("code") == code:
                    prev_date = prev.get("test_date", "")
                    if most_recent_date is None or prev_date > most_recent_date:
                        most_recent = v
                        most_recent_date = prev_date

        if most_recent is None:
            return None

        prev_value = float(most_recent.get("value", 0))
        diff = current - prev_value

        # Determine direction (with 5% tolerance to avoid noise)
        tolerance = abs(prev_value) * 0.05
        if abs(diff) <= tolerance:
            direction = "stable"
        elif diff > 0:
            direction = "increasing"
        else:
            direction = "decreasing"

        # For values where "improving" = increasing (e.g., HGB in anemia)
        # This is a simplification — real trend interpretation requires clinical context
        if code in ("HGB", "HCT", "RBC", "PLT", "ALB", "TP"):
            # For these, increasing could be improving (if was low)
            if direction == "increasing":
                clinical_direction = "improving"
            elif direction == "decreasing":
                clinical_direction = "worsening"
            else:
                clinical_direction = "stable"
        elif code in ("GLU", "HBA1C", "CHOL", "LDL", "TRIG", "CRE", "BUN"):
            # For these, decreasing could be improving (if was high)
            if direction == "decreasing":
                clinical_direction = "improving"
            elif direction == "increasing":
                clinical_direction = "worsening"
            else:
                clinical_direction = "stable"
        else:
            clinical_direction = direction

        return {
            "previous": prev_value,
            "current": current,
            "direction": clinical_direction,
            "raw_direction": direction,
            "change": round(diff, 2),
            "previous_date": most_recent_date,
        }
