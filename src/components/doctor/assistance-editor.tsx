"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Panel, apiClient, useDashboardMutation } from "@/components/dashboard/common";
export interface ReviewedAssistance { text: string; method: "local-extractive" | "ai-assisted"; reviewed: true }
export function AssistanceEditor({ patientId, onApply }: { patientId: string; onApply: (draft: ReviewedAssistance) => void }) {
  const mutation = useDashboardMutation();
  const [mode, setMode] = useState("summary"), [consent, setConsent] = useState(false), [provider, setProvider] = useState(false);
  const [draft, setDraft] = useState<{ text: string; method: "local-extractive" | "ai-assisted"; label: string } | null>(null), [reviewed, setReviewed] = useState(false);
  return <Panel title="Assisted patient summary and documentation">
    <p className="text-xs text-muted-foreground">Drafts are unsaved. A local extract is not AI-generated. External AI requires the existing configured provider and explicit processing authorization. Nothing diagnoses, prescribes, finalizes, or enters the record automatically.</p>
    <label className="block space-y-2 text-sm">Draft type<select className="block h-10 w-full rounded-lg border border-input bg-background px-2" value={mode} onChange={event => setMode(event.target.value)}><option value="summary">Patient summary</option><option value="documentation">Consultation documentation</option></select></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={provider} onChange={event => setProvider(event.target.checked)} />Use configured external AI provider instead of local extraction.</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I confirm authorized access and, if using external AI, the required patient permission and approved provider processing arrangement.</label>
    {mutation.errorUI}<Button variant="outline" type="button" disabled={!patientId || !consent || mutation.busy} onClick={() => void mutation.run(async () => {
      const response = await apiClient.post<NonNullable<typeof draft>>("/workspace/assistance", { patientId, mode, consent, useProvider: provider });
      setDraft(response); setReviewed(false);
    }, "Unsaved assistance draft prepared")}>{mutation.busy ? "Preparing…" : provider ? "Generate AI-assisted draft" : "Prepare local extract"}</Button>
    {draft && <div className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">{draft.label}</h3>
      <FormField label="Review and edit the draft"><textarea value={draft.text} maxLength={4500} rows={10} className="w-full rounded-lg border border-input bg-background p-3 text-sm" onChange={event => { setDraft({ ...draft, text: event.target.value }); setReviewed(false); }} /></FormField>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed and edited this draft against the source records and accept responsibility for its accuracy.</label>
      <Button variant="outline" type="button" disabled={!reviewed || !draft.text.trim()} onClick={() => {
        if (window.confirm("Place this reviewed draft into Additional Notes? The consultation will still require your explicit save.")) onApply({ text: draft.text, method: draft.method, reviewed: true });
      }}>Use reviewed draft in notes</Button>
    </div>}
  </Panel>;
}
