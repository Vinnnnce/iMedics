"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { LineChart } from "@/components/shared/line-chart";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { Panel, apiClient, useDashboardMutation } from "./common";
import type { WorkspaceData } from "@/lib/workspace/types";
export function PatientIntelligence({ data }: { data: WorkspaceData }) {
  const mutation = useDashboardMutation();
  const [readings, setReadings] = useState<{ metric: string; value: number; recorded_at: string; source: string }[]>([]);
  const [questions, setQuestions] = useState<string[]>([]), [questionLabel, setQuestionLabel] = useState("");
  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget), file = fields.get("file") as File;
    await mutation.run(async () => {
      if (!file?.size || file.size > 200000) throw new Error("Choose a JSON file smaller than 200 KB.");
      let readings: unknown;
      try { readings = JSON.parse(await file.text()); } catch { throw new Error("The file must contain a JSON array of readings."); }
      const result = await apiClient.post<{ inserted: number; duplicatesSkipped: number }>("/workspace/wearables", { consent: fields.get("consent") === "on", source: fields.get("source"), readings });
      setReadings(await apiClient.get("/workspace/wearables"));
      if (result.inserted === 0) throw new Error("No new readings were imported; matching readings already exist.");
    }, "Consented wearable readings imported");
  }
  return <section aria-label="Personalized health insights" className="space-y-4">{mutation.errorUI}
    <Panel title="Verified result trends"><p className="text-xs text-muted-foreground">Only clinician-verified numeric results are charted. Different units are never merged or converted. A trend is not a diagnosis.</p>
      {!data.trends.length && <p className="text-sm text-muted-foreground">At least two verified results with matching test code and unit are needed.</p>}
      <div className="grid gap-4 lg:grid-cols-2">{data.trends.map(trend => <LineChart key={`${trend.code}-${trend.unit}`} title={trend.name} unit={trend.unit} points={trend.points.map(point => ({ label: point.date.slice(0, 10), value: point.value }))} />)}</div>
    </Panel>
    <Panel title="Wearable data import"><p className="text-sm text-muted-foreground">Import a compatible wearable export. No wearable account is connected, and these patient-reported readings are not clinician-verified.</p>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Supported JSON format</summary><pre className="mt-2 overflow-x-auto rounded-lg border border-border p-3">{'[{"metric":"steps","value":4000,"recordedAt":"2026-01-01T12:00:00Z"}]'}</pre><p>Metrics: steps, resting_heart_rate, sleep_hours. Maximum 365 readings per import. Include source and consent below.</p></details>
      <form onSubmit={importFile} className="space-y-3"><FormField label="Source or device name" required><Input name="source" required maxLength={80} /></FormField>
        <FormField label="Wearable JSON file" required><Input name="file" type="file" accept=".json,application/json" required /></FormField>
        <label className="flex gap-2 text-sm"><input name="consent" type="checkbox" required />I consent to storing this wearable export in my account.</label>
        <Button type="submit" variant="outline" disabled={!data.extensionsReady || mutation.busy}>Import readings</Button>
      </form>
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!data.extensionsReady || mutation.busy} onClick={() => void mutation.run(async () => setReadings(await apiClient.get("/workspace/wearables")), "Wearable readings loaded")}>Load saved readings</Button>
        <Button variant="outline" disabled={!data.extensionsReady || mutation.busy} onClick={() => {
          if (window.confirm("Permanently delete all wearable readings in your account? This does not remove clinical records.")) void mutation.run(async () => { await apiClient.delete("/workspace/wearables", { confirm: true }); setReadings([]); }, "Wearable data deleted");
        }}>Delete imported wearable data</Button>
      </div>
      {["steps", "resting_heart_rate", "sleep_hours"].map(metric => {
        const rows = readings.filter(row => row.metric === metric).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
        return rows.length ? <div key={metric} className="space-y-2"><LineChart title={metric.replace(/_/g, " ")} unit={metric === "sleep_hours" ? "hours" : metric === "steps" ? "steps" : "bpm"} points={rows.map(row => ({ label: `${row.recorded_at.slice(0, 10)} · ${row.source}`, value: Number(row.value) }))} />
          <p className="text-xs text-muted-foreground">{rows.length} observations in the latest loaded readings. Latest value {rows.at(-1)?.value}; descriptive only, not medical advice.</p></div> : null;
      })}
    </Panel>
    <Panel title="Assisted pre-visit preparation"><p className="text-sm text-muted-foreground">Generate optional clarifying questions, then decide what to include in your intake. Nothing is saved to the clinical record here.</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); const fields = new FormData(event.currentTarget);
        void mutation.run(async () => {
          const output = await apiClient.post<{ questions: string[]; label: string }>("/workspace/assistance", { mode: "intake", concern: fields.get("concern"), useProvider: fields.get("provider") === "on", consent: fields.get("consent") === "on" });
          setQuestions(output.questions); setQuestionLabel(output.label);
        }, "Unsaved intake questions prepared");
      }}><FormField label="What would you like to discuss?"><Input name="concern" maxLength={1000} /></FormField>
        <label className="flex gap-2 text-sm"><input name="provider" type="checkbox" />Use the configured external AI provider rather than local guide questions.</label>
        <label className="flex gap-2 text-sm"><input name="consent" type="checkbox" required />I consent to processing this concern, including by the configured AI provider if selected. No name or contact details should be entered.</label>
        <Button type="submit" variant="outline" disabled={mutation.busy}>Prepare questions</Button>
      </form>
      {questions.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">{questionLabel}</h3><ul className="list-inside list-disc space-y-2 text-sm">{questions.map(question => <li key={question}>{question}</li>)}</ul><p className="text-xs text-muted-foreground">Use the Pre-visit intake tab to submit your own answers to your clinician.</p></div>}
    </Panel>
  </section>;
}
