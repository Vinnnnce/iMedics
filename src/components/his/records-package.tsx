"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "./use-api";

/** Export selected finalized documents as one PDF with index and manifest (requires a patient authorization reference). */
export function RecordsPackage({ patientId, documents }: { patientId: string; documents: { id: string; label: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [auth, setAuth] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (documents.length === 0) return <p className="text-sm text-muted-foreground">No finalized documents to export.</p>;
  return (
    <div className="space-y-2 text-sm">
      {documents.map((d) => <label key={d.id} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(d.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))} />{d.label}</label>)}
      <label className="block text-xs">Patient authorization reference (e.g. signed release form number)<input className={inputClass} value={auth} onChange={(e) => setAuth(e.target.value)} /></label>
      <Button size="sm" disabled={!selected.length || auth.trim().length < 3} onClick={async () => {
        setError(null);
        const res = await fetch(`/api/facility/his/patients/${patientId}/package`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentIds: selected, authorizationReference: auth.trim() }) });
        if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Export failed"); return; }
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a"); a.href = url; a.download = "records-package.pdf"; a.click(); URL.revokeObjectURL(url);
      }}>Export package (PDF)</Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
