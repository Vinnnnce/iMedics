"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass, textareaClass } from "./use-api";

interface AssessmentRow {
  id: string;
  type: string;
  score: number | null;
  notes: string | null;
  assessedAt: string;
  data: Record<string, unknown>;
  assessedBy: { name: string } | null;
}

interface CarePlanRow {
  id: string;
  goals: string;
  interventions: { description: string; frequency?: string }[];
  status: string;
  createdAt: string;
}

const ASSESSMENT_TYPES: { value: string; label: string; fields: string[] }[] = [
  { value: "FALL_RISK", label: "Fall risk", fields: ["fallHistory", "mobility", "confusion", "medicationsRisk"] },
  { value: "PRESSURE_INJURY", label: "Pressure injury", fields: ["bradenScore", "skinCondition", "existingWounds"] },
  { value: "WOUND_CARE", label: "Wound care", fields: ["location", "size", "exudate", "dressingApplied"] },
  { value: "INTAKE_OUTPUT", label: "Intake / output", fields: ["intakeMl", "outputMl", "balanceMl"] },
];

/** Structured nursing assessments, care plans and the AI handover draft. */
export function NursingAssessments({ patientId, canRecord }: { patientId: string; canRecord: boolean }) {
  const [assessments, setAssessments] = useState<AssessmentRow[] | null>(null);
  const [carePlans, setCarePlans] = useState<CarePlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [type, setType] = useState("FALL_RISK");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [planGoals, setPlanGoals] = useState("");
  const [planInterventions, setPlanInterventions] = useState("");
  const [aiDraft, setAiDraft] = useState<{ summary: string; outstandingTasks: string[]; escalationNotes: string[] } | null>(null);
  const [aiLabel, setAiLabel] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await api<{ assessments: AssessmentRow[]; carePlans: CarePlanRow[] }>(
        `/api/facility/his/nursing/assessments?patientId=${patientId}`,
      );
      setAssessments(data.assessments);
      setCarePlans(data.carePlans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const submitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    const fields = ASSESSMENT_TYPES.find((t) => t.value === type)?.fields ?? [];
    const data: Record<string, string> = {};
    for (const f of fields) {
      if (values[f]) data[f] = values[f];
    }
    try {
      await api("/api/facility/his/nursing/assessments", {
        body: { patientId, type, data, notes: notes || undefined },
      });
      setNotice("Assessment recorded.");
      setValues({}); setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const submitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    const interventions = planInterventions.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [description, frequency] = line.split("|").map((p) => p.trim());
      return { description, ...(frequency ? { frequency } : {}) };
    });
    try {
      await api("/api/facility/his/nursing/assessments", {
        method: "PUT",
        body: { patientId, goals: planGoals, interventions },
      });
      setNotice("Care plan created.");
      setPlanGoals(""); setPlanInterventions("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const generateHandover = async () => {
    setError(null); setAiDraft(null);
    try {
      const res = await api<{ draft: { summary: string; outstandingTasks: string[]; escalationNotes: string[] }; aiGenerated: boolean; disclaimer: string }>(
        "/api/facility/his/ai/nursing",
        { body: { patientId } },
      );
      setAiDraft(res.draft);
      setAiLabel(res.disclaimer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const fields = ASSESSMENT_TYPES.find((t) => t.value === type)?.fields ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-base">Assessments & care plans</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive" data-testid="text-assessment-error">{error}</p>}
        {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-assessment-notice">{notice}</p>}

        {canRecord && (
          <form onSubmit={submitAssessment} className="space-y-2" data-testid="form-assessment">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">Assessment type
                <select className={inputClass} value={type} onChange={(e) => { setType(e.target.value); setValues({}); }} data-testid="select-assessment-type">
                  {ASSESSMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              {fields.map((f) => (
                <label key={f} className="text-xs">{f}
                  <input className={inputClass} value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} data-testid={`input-assessment-${f}`} />
                </label>
              ))}
              <Button type="submit" data-testid="button-record-assessment">Record</Button>
            </div>
            <textarea className={textareaClass} rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </form>
        )}

        {canRecord && (
          <form onSubmit={submitPlan} className="space-y-2" data-testid="form-careplan">
            <p className="text-xs font-medium">New care plan</p>
            <textarea className={textareaClass} rows={2} placeholder="Goals" required value={planGoals} onChange={(e) => setPlanGoals(e.target.value)} data-testid="input-plan-goals" />
            <textarea className={textareaClass} rows={3} placeholder={"Interventions (one per line, optional | frequency)\ne.g. Reposition every 2 hours | q2h"} value={planInterventions} onChange={(e) => setPlanInterventions(e.target.value)} />
            <Button type="submit" variant="outline" data-testid="button-create-plan">Create care plan</Button>
          </form>
        )}

        {canRecord && (
          <div className="space-y-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={generateHandover} data-testid="button-ai-handover">Draft handover with AI assistant</Button>
            {aiLabel && <p className="text-xs text-muted-foreground" data-testid="text-ai-disclaimer">{aiLabel}</p>}
            {aiDraft && (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm" data-testid="box-ai-draft">
                <p>{aiDraft.summary}</p>
                {aiDraft.outstandingTasks.length > 0 && (
                  <div className="mt-2"><p className="text-xs font-medium">Outstanding tasks</p><ul className="list-inside list-disc text-xs"><li>{aiDraft.outstandingTasks.join(" · ")}</li></ul></div>
                )}
                {aiDraft.escalationNotes.length > 0 && (
                  <div className="mt-2"><p className="text-xs font-medium">Escalation notes</p><ul className="list-inside list-disc text-xs"><li>{aiDraft.escalationNotes.join(" · ")}</li></ul></div>
                )}
              </div>
            )}
          </div>
        )}

        {assessments === null ? <p className="text-sm text-muted-foreground">Loading assessments…</p> : assessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No structured assessments recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-xs" data-testid="list-assessments">
            {assessments.map((a) => (
              <li key={a.id} className="rounded-lg border p-2">
                <span className="font-medium">{ASSESSMENT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</span>
                <span className="text-muted-foreground"> · {new Date(a.assessedAt).toLocaleString()} · {a.assessedBy?.name ?? "unknown"}</span>
                {a.score !== null ? <span className="ml-1 rounded-full bg-muted px-2 py-0.5">score {a.score}</span> : null}
                {a.notes ? <div className="text-muted-foreground">{a.notes}</div> : null}
                <div className="text-muted-foreground">{Object.entries(a.data).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</div>
              </li>
            ))}
          </ul>
        )}

        {carePlans === null ? null : carePlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No care plans yet.</p>
        ) : (
          <ul className="space-y-1 text-xs" data-testid="list-careplans">
            {carePlans.map((c) => (
              <li key={c.id} className="rounded-lg border p-2">
                <span className="font-medium">Care plan</span>
                <span className="text-muted-foreground"> · {c.status} · {new Date(c.createdAt).toLocaleDateString()}</span>
                <div className="text-muted-foreground">{c.goals}</div>
                <ul className="list-inside list-disc text-muted-foreground">
                  {c.interventions.map((i, idx) => <li key={idx}>{i.description}{i.frequency ? ` (${i.frequency})` : ""}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
