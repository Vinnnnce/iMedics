import type { ResultFlag } from "@prisma/client";

export interface RangeInput {
  value: number | null | undefined;
  refLow?: number | null;
  refHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
}

export interface FlagOutcome {
  flag: ResultFlag | null;
  isCritical: boolean;
}

/**
 * Abnormal / critical flagging against facility-configured ranges. Nothing is
 * flagged when no range is configured: ranges are clinical content that a
 * facility must validate, so the system never guesses them.
 */
export function evaluateFlag({ value, refLow, refHigh, criticalLow, criticalHigh }: RangeInput): FlagOutcome {
  if (value == null || Number.isNaN(value)) return { flag: null, isCritical: false };
  if (criticalLow != null && value <= criticalLow) return { flag: "CRITICAL_LOW", isCritical: true };
  if (criticalHigh != null && value >= criticalHigh) return { flag: "CRITICAL_HIGH", isCritical: true };
  if (refLow != null && value < refLow) return { flag: "LOW", isCritical: false };
  if (refHigh != null && value > refHigh) return { flag: "HIGH", isCritical: false };
  if (refLow != null || refHigh != null) return { flag: "NORMAL", isCritical: false };
  return { flag: null, isCritical: false };
}

export function rangeText(refLow?: number | null, refHigh?: number | null): string | null {
  if (refLow != null && refHigh != null) return `${refLow} – ${refHigh}`;
  if (refLow != null) return `≥ ${refLow}`;
  if (refHigh != null) return `≤ ${refHigh}`;
  return null;
}
