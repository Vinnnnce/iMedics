"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass } from "./use-api";

interface TemplateOption { id: string; name: string; groupCode: string }

export function NewDocumentForm({ templates, presetPatient, encounterId }: { templates: TemplateOption[]; presetPatient: IdentifiedPatient | null; encounterId?: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<IdentifiedPatient | null>(presetPatient);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (templates.length === 0) return <p className="text-sm text-muted-foreground">No published templates yet. Adopt a template from the library, then submit, approve and publish it.</p>;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">1. Patient</h2>
        {patient ? (
          <p className="mt-2 text-sm" data-testid="text-selected-patient">{patient.firstName} {patient.lastName} · {patient.caseNumber} · DOB {patient.dateOfBirth.slice(0, 10)} <button type="button" className="ml-2 text-xs text-primary underline" onClick={() => setPatient(null)}>change</button></p>
        ) : <div className="mt-2"><PatientIdentify onFound={setPatient} /></div>}
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">2. Document type</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">Template<select className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)} data-testid="select-template">{templates.map((t) => <option key={t.id} value={t.id}>{t.groupCode} · {t.name}</option>)}</select></label>
          <label className="text-xs">Department<input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
        </div>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={!patient || !templateId || busy} data-testid="button-create-document" onClick={async () => {
        setBusy(true); setError(null);
        try {
          const { document } = await api<{ document: { id: string } }>("/api/facility/his/documents", { body: { templateId, patientId: patient!.id, department: department || undefined, encounterId } });
          router.push(`/lab/clinical-documents/${document.id}`);
        } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setBusy(false); }
      }}>Create draft</Button>
      <p className="text-xs text-muted-foreground">Patients must already have a care relationship with your facility (e.g. a registered encounter).</p>
    </div>
  );
}
