import type { Trend, WorkspaceItem } from "./types";

/** Transparent operational heuristic, not a validated clinical/predictive model. */
export function attendanceSignals(input: { previousNoShows: number; bookedDaysAhead: number; confirmed: boolean }) {
  const reasons: string[] = [];
  if (input.previousNoShows > 0) reasons.push("Previous missed appointment");
  if (input.bookedDaysAhead > 14) reasons.push("Booked over two weeks ahead");
  if (!input.confirmed) reasons.push("Awaiting confirmation");
  return { level: reasons.length >= 2 ? "Review" : reasons.length ? "Monitor" : "Routine", reasons,
    disclaimer: "Rule-based reminder priority, not a probability. Never use to deny care or double-book." };
}

/** Suggestions between already-published appointments, never an automatic booking. */
export function scheduleSuggestions(slots: { at: string; durationMinutes: number }[]) {
  const ordered = [...slots].sort((a,b) => a.at.localeCompare(b.at));
  return ordered.slice(1).flatMap((slot, i) => {
    const previous = ordered[i];
    const end = new Date(Date.parse(previous.at) + previous.durationMinutes * 60000);
    const next = new Date(slot.at);
    const sameDay = end.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) === next.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
    const minutes = (next.getTime() - end.getTime()) / 60000;
    return sameDay && minutes >= 30 ? [{ startsAt: end.toISOString(), minutes, suggestion: "Review this gap against published availability before offering a slot." }] : [];
  });
}

export function careGaps(input: { intakeComplete: boolean; overdueFollowUps: number; pendingReviews: number }): WorkspaceItem[] {
  return [
    ...(!input.intakeComplete ? [{ id: "intake-gap", title: "Complete your health history", subtitle: "Help your care team prepare for your visit.", status: "Care task", href: "/patient/history", tone: "amber" as const }] : []),
    ...(input.overdueFollowUps ? [{ id: "followup-gap", title: `${input.overdueFollowUps} follow-up${input.overdueFollowUps === 1 ? "" : "s"} due`, subtitle: "Check the clinician's follow-up plan.", status: "Review", href: "/patient/appointments", tone: "amber" as const }] : []),
    ...(input.pendingReviews ? [{ id: "review-gap", title: `${input.pendingReviews} result review${input.pendingReviews === 1 ? "" : "s"} pending`, subtitle: "Awaiting your care team's review.", status: "Pending", href: "/patient/results", tone: "blue" as const }] : []),
  ];
}

export function buildTrends(rows: { code: string; name: string; unit: string | null; value: number; date: string }[]): Trend[] {
  const groups = new Map<string, Trend>();
  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    // Never mix different units, even when the laboratory uses the same test code.
    const key = `${row.code}:${row.unit ?? ""}`;
    if (!groups.has(key)) groups.set(key, { code: key, name: row.name, unit: row.unit ?? "", points: [] });
    groups.get(key)!.points.push({ date: row.date, value: row.value });
  }
  return [...groups.values()].map(group => ({ ...group, points: group.points.sort((a, b) => a.date.localeCompare(b.date)) })).filter(group => group.points.length > 1);
}

export const consultationTemplates = {
  SOAP: "Subjective:\n\nObjective:\n\nAssessment (select an ICD-10 code):\n\nPlan:\n\nFollow-up:\n",
  FollowUp: "Interval history:\n\nResponse to treatment:\n\nResults reviewed:\n\nAssessment (select an ICD-10 code):\n\nPlan:\n\nNext review:\n",
};

export function experimentVariant(subjectId: string, experiment: string): "A" | "B" {
  let hash = 2166136261;
  for (const char of `${experiment}:${subjectId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2 ? "B" : "A";
}

/** Protect spreadsheet users from formula injection in exported text. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "").replace(/[\u0000-\u0008]/g, "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
