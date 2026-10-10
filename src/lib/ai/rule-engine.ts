/**
 * Deterministic lab flagging. Runs BEFORE (and independently of) any language model,
 * so critical values are always surfaced even when the AI service is down.
 * Ported from the original Python rule engine, with two safety fixes:
 *  - critical thresholds are applied only when the unit matches the one they were defined for
 *    (a glucose of 5.5 mmol/L must never be read as "critically low" against a mg/dL threshold);
 *  - a reference bound of 0 is a real bound, not "missing".
 */

export interface PanelValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
}

export interface PreviousValue {
  value: number;
  unit: string;
  date: Date;
}

export interface RuleFlag {
  code: string;
  name: string;
  flag: "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH";
  value: number;
  unit: string;
  message: string;
}

export interface Trend {
  previous: number;
  current: number;
  direction: "increasing" | "decreasing" | "stable";
  change: number;
  previousDate: string;
}

export interface RuleResult {
  critical: RuleFlag[];
  nonCritical: RuleFlag[];
  trends: Record<string, Trend>;
  /** Values whose critical thresholds could not be checked (unknown or mismatched unit). */
  unitNotes: string[];
}

interface Threshold {
  unit: string;
  low?: number;
  high?: number;
}

// Critical (panic) thresholds from common clinical guidelines. Non-exhaustive.
const CRITICAL_THRESHOLDS: Record<string, Threshold> = {
  HGB: { unit: "g/dl", low: 7, high: 20 },
  PLT: { unit: "x10^9/l", low: 50, high: 1000 },
  WBC: { unit: "x10^9/l", low: 2, high: 50 },
  RBC: { unit: "x10^12/l", low: 2, high: 8 },
  GLU: { unit: "mg/dl", low: 40, high: 500 },
  K: { unit: "mmol/l", low: 2.5, high: 7 },
  NA: { unit: "mmol/l", low: 120, high: 160 },
  CA: { unit: "mg/dl", low: 6, high: 14 },
  MG: { unit: "mg/dl", low: 0.8, high: 4 },
  PO4: { unit: "mg/dl", low: 1, high: 7 },
  INR: { unit: "", high: 5 },
  PT: { unit: "s", high: 30 },
  TBIL: { unit: "mg/dl", high: 20 },
  CREA: { unit: "mg/dl", high: 10 },
  UREA: { unit: "mg/dl", high: 100 },
  TSH: { unit: "miu/l", low: 0.1, high: 50 },
  FT4: { unit: "pmol/l", low: 5, high: 25 },
  HBA1C: { unit: "%", high: 12 },
  FERRITIN: { unit: "ng/ml", high: 1000 },
};

const CODE_ALIASES: Record<string, string> = {
  HB: "HGB",
  GLUC: "GLU",
  GLUCOSE: "GLU",
  CRE: "CREA",
  CREATININE: "CREA",
  BUN: "UREA",
  BIL: "TBIL",
  HBA1C: "HBA1C",
};

export function canonicalCode(code: string): string {
  const upper = code.trim().toUpperCase();
  return CODE_ALIASES[upper] ?? upper;
}

/** Lower-case, unify the common spellings of the same unit. */
export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\s+/g, "").replace("µ", "u").replace("μ", "u");
  if (/^(x|×)?10(\^|\*|e)?9\/l$/.test(u) || u === "k/ul" || u === "10^3/ul" || u === "thou/ul") return "x10^9/l";
  if (/^(x|×)?10(\^|\*|e)?12\/l$/.test(u) || u === "m/ul" || u === "10^6/ul") return "x10^12/l";
  if (u === "meq/l") return "mmol/l";
  if (u === "miu/l" || u === "uiu/ml" || u === "mu/l") return "miu/l";
  return u;
}

function acceptsUnit(threshold: Threshold, unit: string): boolean {
  const u = normalizeUnit(unit);
  if (threshold.unit === "") return u === "" || u === "ratio" || u === "inr";
  return u === threshold.unit;
}

export function evaluatePanel(panel: PanelValue[], previous: Map<string, PreviousValue> = new Map()): RuleResult {
  const critical: RuleFlag[] = [];
  const nonCritical: RuleFlag[] = [];
  const trends: Record<string, Trend> = {};
  const unitNotes: string[] = [];

  for (const v of panel) {
    const code = canonicalCode(v.code);
    const label = `${v.name} (${v.value} ${v.unit})`.trim();
    const threshold = CRITICAL_THRESHOLDS[code];

    let isCritical = false;
    if (threshold) {
      if (acceptsUnit(threshold, v.unit)) {
        if (threshold.low !== undefined && v.value <= threshold.low) {
          isCritical = true;
          critical.push({ code, name: v.name, flag: "CRITICAL_LOW", value: v.value, unit: v.unit, message: `${label} is critically low (threshold ${threshold.low})` });
        } else if (threshold.high !== undefined && v.value >= threshold.high) {
          isCritical = true;
          critical.push({ code, name: v.name, flag: "CRITICAL_HIGH", value: v.value, unit: v.unit, message: `${label} is critically high (threshold ${threshold.high})` });
        }
      } else {
        unitNotes.push(`${v.name}: unit "${v.unit || "none"}" not recognised, critical thresholds were not checked.`);
      }
    }

    if (!isCritical) {
      if (v.refLow !== null && v.value < v.refLow) {
        nonCritical.push({ code, name: v.name, flag: "LOW", value: v.value, unit: v.unit, message: `${label} is below the reference range` });
      } else if (v.refHigh !== null && v.value > v.refHigh) {
        nonCritical.push({ code, name: v.name, flag: "HIGH", value: v.value, unit: v.unit, message: `${label} is above the reference range` });
      }
    }

    const prev = previous.get(code);
    if (prev && normalizeUnit(prev.unit) === normalizeUnit(v.unit)) {
      const diff = v.value - prev.value;
      const tolerance = Math.abs(prev.value) * 0.05; // ignore changes within 5%
      trends[code] = {
        previous: prev.value,
        current: v.value,
        direction: Math.abs(diff) <= tolerance ? "stable" : diff > 0 ? "increasing" : "decreasing",
        change: Math.round(diff * 100) / 100,
        previousDate: prev.date.toISOString().slice(0, 10),
      };
    }
  }

  return { critical, nonCritical, trends, unitNotes };
}
