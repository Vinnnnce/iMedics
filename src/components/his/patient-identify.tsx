"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, inputClass } from "./use-api";

export interface IdentifiedPatient { id: string; caseNumber: string; firstName: string; lastName: string; dateOfBirth: string; gender: string }

/** Safe identity verification: exact case number + date of birth (never name search). */
export function PatientIdentify({ onFound, label = "Identify patient" }: { onFound: (p: IdentifiedPatient) => void; label?: string }) {
  const [caseNumber, setCaseNumber] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try { const { patient } = await api<{ patient: IdentifiedPatient }>("/api/facility/his/patients/identify", { body: { caseNumber, dateOfBirth: dob } }); onFound(patient); }
      catch (err) { setError(err instanceof Error ? err.message : "Not found"); } finally { setBusy(false); }
    }}>
      <label className="text-xs">Case number<input className={inputClass} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required minLength={6} data-testid="input-case-number" /></label>
      <label className="text-xs">Date of birth<input type="date" className={inputClass} value={dob} onChange={(e) => setDob(e.target.value)} required data-testid="input-dob" /></label>
      <Button type="submit" disabled={busy} className="self-end" data-testid="button-identify">{label}</Button>
      {error && <p role="alert" className="text-xs text-destructive sm:col-span-3">{error}</p>}
    </form>
  );
}
