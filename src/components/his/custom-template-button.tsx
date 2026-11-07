"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, inputClass } from "./use-api";

/** Create a blank custom document type, or import an exported template JSON. */
export function CustomTemplateButton({ groups }: { groups: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("CUSTOM");
  const [error, setError] = useState<string | null>(null);
  const go = async (body: unknown) => {
    setError(null);
    try { const { template } = await api<{ template: { id: string } }>("/api/facility/his/templates", { body }); router.push(`/lab/clinical-documents/templates/${template.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="button-custom-template">New / import template</Button>;
  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border bg-card p-3 text-sm">
      <label className="block text-xs">Name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block text-xs">Group<select className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={name.trim().length < 2} onClick={() => go({ mode: "custom", name: name.trim(), groupCode: group, definition: { sections: [{ id: "details", title: "Details", fields: [{ id: "summary", label: "Details", type: "textarea", required: true }] }], signatures: [{ role: "AUTHOR", label: "Responsible clinician (author)", required: true }] } })}>Create blank</Button>
        <label className="cursor-pointer rounded-lg border px-2 py-1 text-xs">Import JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          try { const data = JSON.parse(await file.text()); await go({ mode: "import", data: { name: data.name, groupCode: data.groupCode, sourceCode: data.sourceCode, description: data.description, definition: data.definition } }); }
          catch { setError("Not a valid template export"); }
        }} /></label>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
