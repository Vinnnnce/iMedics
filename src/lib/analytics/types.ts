import type { Change, TargetStatus, TargetDirection } from "./stats";
import type { MetricUnit } from "./registry";

/** Everything below is plain JSON so it can be cached, exported and sent to the browser unchanged. */

export interface KpiValue {
  key: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  /** Present for rates: the figures the percentage was calculated from. */
  numerator?: number;
  denominator?: number;
  /** Comparison against the baseline period (absent for point-in-time metrics). */
  change?: Change;
  /** Small trend line (current period, oldest first). */
  spark?: number[];
  /** Direction that counts as an improvement, so the UI can colour a change correctly. */
  betterWhen: "HIGHER" | "LOWER" | "NEUTRAL";
  target?: { value: number; direction: TargetDirection; status: TargetStatus; progressPercent: number | null };
  /** Drill-down key understood by /api/facility/analytics/drilldown. */
  drill?: string;
  /** Short plain-language caveat shown beside the figure. */
  note?: string;
  /** Number of records behind a rate or average; used for small-sample warnings. */
  sampleSize?: number;
  currency?: string;
}

export interface Point { x: string; y: number | null }

export type Visual =
  | { type: "line"; unit: MetricUnit; series: { name: string; points: Point[]; dashed?: boolean }[] }
  | { type: "bars"; unit: MetricUnit; items: { label: string; value: number | null; previous?: number | null; drill?: string }[] }
  | { type: "stacked"; unit: MetricUnit; keys: string[]; items: { label: string; values: Record<string, number> }[] }
  | { type: "donut"; unit: MetricUnit; items: { label: string; value: number }[] }
  | { type: "heatmap"; unit: MetricUnit; rows: string[]; cols: string[]; values: (number | null)[][] }
  | { type: "funnel"; steps: { label: string; value: number }[] }
  | { type: "calendar"; unit: MetricUnit; days: { date: string; value: number }[] }
  | { type: "progress"; items: { key: string; label: string; actual: number | null; target: number; unit: MetricUnit; direction: TargetDirection; status: TargetStatus; progressPercent: number | null }[] }
  | { type: "beds"; wards: BedWard[] }
  | { type: "table"; columns: { key: string; label: string; align?: "left" | "right" }[]; rows: Record<string, string | number | null>[]; footnote?: string }
  | { type: "definitions"; items: { key: string; name: string; formula: string; caveat?: string }[] };

export interface BedWard {
  wardId: string;
  name: string;
  className: "ICU" | "HDU" | "GENERAL";
  beds: { id: string; label: string; status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "MAINTENANCE" | "ISOLATION" }[];
  occupied: number;
  inService: number;
  pendingDischarge: number;
}

export interface Section {
  id: string;
  title: string;
  /** The operational question this visual answers (every chart must justify itself). */
  question: string;
  visual: Visual;
  note?: string;
  drill?: string;
}

/** An indicator the specification asks for that Medic1905 does not yet record. Shown, never faked. */
export interface DataGap {
  indicator: string;
  reason: string;
}

export type DashboardKey =
  | "overview" | "command-centre" | "hospital" | "emergency" | "mortality" | "nursing" | "doctors"
  | "laboratory" | "diagnostic" | "pharmacy" | "departments" | "quality" | "financial" | "forecast" | "my-performance";

export interface DashboardPayload {
  dashboard: DashboardKey;
  title: string;
  facility: { id: string; name: string; kind: string };
  range: {
    preset: string;
    current: { start: string; end: string; startDate: string; endDate: string; label: string };
    previous: { start: string; end: string; startDate: string; endDate: string; label: string } | null;
    compare: string;
    likeForLike: boolean;
    timeZone: string;
  };
  kpis: KpiValue[];
  sections: Section[];
  gaps: DataGap[];
  /** Cached payloads say when they were computed. */
  computedAt: string;
  cached: boolean;
  /** Set when the viewer is restricted to some departments. */
  departmentScoped: boolean;
}

export interface DrilldownPage {
  key: string;
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  pageSize: number;
  /** True when patient case numbers are included (requires patient-record permission). */
  identified: boolean;
  period: { startDate: string; endDate: string; label: string };
}
