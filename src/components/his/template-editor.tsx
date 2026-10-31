"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TemplateDefinition, TemplateField, TemplateSection } from "@/lib/his/template-schema";
import { FIELD_TYPES, SIGNATURE_ROLES } from "@/lib/his/template-schema";
import { api, inputClass, textareaClass } from "./use-api";

interface Props {
  templateId: string;
  name: string;
  status: string;
  version: number;
  definition: TemplateDefinition;
  editable: boolean;
  canApprove: boolean;
  canManage: boolean;
  history: { version: number; status: string; changeNote: string | null; publishedAt: string | null }[];
}

const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

/** Section-based template builder with lifecycle actions and live preview. */
export function TemplateEditor(props: Props) {
  const router = useRouter();
  const [def, setDef] = useState<TemplateDefinition>(props.definition);
  const [name, setName] = useState(props.name);
  const [changeNote, setChangeNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const ro = !props.editable;

  const setSection = (i: number, s: Partial<TemplateSection>) => setDef((d) => ({ ...d, sections: d.sections.map((x, k) => (k === i ? { ...x, ...s } : x)) }));
  const setField = (si: number, fi: number, f: Partial<TemplateField>) => setSection(si, { fields: def.sections[si].fields.map((x, k) => (k === fi ? { ...x, ...f } : x)) });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); router.refresh(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" }); } finally { setBusy(false); }
  };
  const action = (a: string) => run(() => api(`/api/facility/his/templates/${props.templateId}/actions`, { body: { action: a, note: changeNote || undefined } }), `Done: ${a}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
        <span>Version {props.version} · <strong data-testid="text-template-status">{props.status}</strong></span>
        <span className="flex-1" />
        {props.editable && <Button size="sm" disabled={busy} data-testid="button-save-template" onClick={() => run(() => api(`/api/facility/his/templates/${props.templateId}`, { method: "PUT", body: { name, definition: def, changeNote: changeNote || undefined } }), "Draft saved")}>Save draft</Button>}
        {props.status === "DRAFT" && props.canManage && <Button size="sm" variant="outline" disabled={busy} onClick={() => action("submit")} data-testid="button-submit-template">Submit for review</Button>}
        {props.status === "IN_REVIEW" && props.canApprove && <><Button size="sm" variant="outline" disabled={busy} onClick={() => action("approve")} data-testid="button-approve-template">Approve</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => action("reject")}>Return to draft</Button></>}
        {props.status === "APPROVED" && props.canManage && <Button size="sm" disabled={busy} onClick={() => action("publish")} data-testid="button-publish-template">Publish</Button>}
        {(props.status === "PUBLISHED" || props.status === "RETIRED") && props.canManage && <Button size="sm" variant="outline" disabled={busy} onClick={() => action("new-version")} data-testid="button-new-version">New version</Button>}
        {props.status === "PUBLISHED" && props.canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm("Retire this template? Existing documents are kept.") && action("retire")}>Retire</Button>}
        <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</Button>
        <a className="text-xs text-primary underline" href={`/api/facility/his/templates/${props.templateId}/export`}>Export JSON</a>
        {props.canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => { const { template } = await api<{ template: { id: string } }>("/api/facility/his/templates", { body: { mode: "clone", templateId: props.templateId } }); router.push(`/lab/clinical-documents/templates/${template.id}`); }, "Cloned")}>Clone</Button>}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      {def.notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">{def.notice}</p>}
      {ro && <p className="text-xs text-muted-foreground">This version is {props.status.toLowerCase()} and cannot be edited. Create a new version to make changes.</p>}

      {preview ? (
        <div className="space-y-3 rounded-xl border bg-white p-4 text-neutral-900">
          <h2 className="text-lg font-bold">{name}</h2>
          {def.sections.map((s) => (
            <section key={s.id}><h3 className="border-b text-sm font-semibold">{s.title}{s.condition ? ` (shown when ${s.condition.fieldId} = ${String(s.condition.equals)})` : ""}</h3>
              <ul className="mt-1 text-sm">{s.fields.map((f) => <li key={f.id}>{f.label}{f.required ? " *" : ""} <span className="text-xs text-neutral-500">[{f.type}{f.unit ? `, ${f.unit}` : ""}]</span></li>)}</ul></section>
          ))}
          <section><h3 className="border-b text-sm font-semibold">Signatures</h3><ul className="text-sm">{def.signatures.map((r) => <li key={r.role}>{r.label}{r.required ? " (required)" : ""}</li>)}</ul></section>
        </div>
      ) : (
        <fieldset disabled={ro} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Template name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="text-xs">Change note<input className={inputClass} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed in this version" /></label>
          </div>
          <div className="flex flex-wrap gap-4 rounded-xl border bg-card p-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={def.workflow.requiresReview} onChange={(e) => setDef({ ...def, workflow: { ...def.workflow, requiresReview: e.target.checked } })} /> Requires clinical review</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={def.workflow.independentReview} onChange={(e) => setDef({ ...def, workflow: { ...def.workflow, independentReview: e.target.checked } })} /> Reviewer must differ from author</label>
            <label className="flex items-center gap-2">Sensitivity<select className="rounded border px-1" value={def.sensitivity} onChange={(e) => setDef({ ...def, sensitivity: e.target.value as TemplateDefinition["sensitivity"] })}><option>STANDARD</option><option>RESTRICTED</option><option>SPECIALLY_PROTECTED</option></select></label>
            <label className="flex items-center gap-2">Page<select className="rounded border px-1" value={def.output.pageSize} onChange={(e) => setDef({ ...def, output: { ...def.output, pageSize: e.target.value as "A4" } })}><option>A4</option><option>LETTER</option><option>A5</option></select></label>
          </div>
          {def.sections.map((s, si) => (
            <section key={s.id} className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <input className={inputClass} value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} aria-label="Section title" />
                <Button size="icon-sm" variant="ghost" aria-label="Move section up" onClick={() => setDef({ ...def, sections: move(def.sections, si, -1) })}><ArrowUp /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move section down" onClick={() => setDef({ ...def, sections: move(def.sections, si, 1) })}><ArrowDown /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Remove section" disabled={s.fields.some((f) => f.locked)} onClick={() => setDef({ ...def, sections: def.sections.filter((_, k) => k !== si) })}><Trash2 /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span>Show only when field</span>
                <input className="h-7 w-32 rounded border px-1" value={s.condition?.fieldId ?? ""} placeholder="field id" onChange={(e) => setSection(si, { condition: e.target.value ? { fieldId: e.target.value, equals: s.condition?.equals ?? true } : undefined })} />
                <span>equals</span>
                <input className="h-7 w-28 rounded border px-1" value={s.condition ? String(s.condition.equals) : ""} placeholder="true / value" onChange={(e) => s.condition && setSection(si, { condition: { ...s.condition, equals: e.target.value === "true" ? true : e.target.value === "false" ? false : e.target.value } })} />
              </div>
              {s.fields.map((f, fi) => (
                <div key={f.id} className="grid gap-2 rounded-lg border p-2 text-xs md:grid-cols-[2fr_1fr_1fr_auto]">
                  <input className={inputClass} value={f.label} onChange={(e) => setField(si, fi, { label: e.target.value })} aria-label="Field label" />
                  <select className={inputClass} value={f.type} disabled={f.locked} onChange={(e) => setField(si, fi, { type: e.target.value as TemplateField["type"] })} aria-label="Field type">{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={f.required} disabled={f.locked && f.required} onChange={(e) => setField(si, fi, { required: e.target.checked })} /> Required{f.locked ? " (locked)" : ""}</label>
                  <div className="flex">
                    <Button size="icon-sm" variant="ghost" aria-label="Move field up" onClick={() => setSection(si, { fields: move(s.fields, fi, -1) })}><ArrowUp /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Move field down" onClick={() => setSection(si, { fields: move(s.fields, fi, 1) })}><ArrowDown /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove field" disabled={f.locked} onClick={() => setSection(si, { fields: s.fields.filter((_, k) => k !== fi) })}><Trash2 /></Button>
                  </div>
                  {(f.type === "select" || f.type === "multiselect") && <input className={`${inputClass} md:col-span-4`} placeholder="Options, comma-separated" value={(f.options ?? []).join(", ")} onChange={(e) => setField(si, fi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />}
                  {f.type === "table" && <input className={`${inputClass} md:col-span-4`} placeholder="Columns, comma-separated" value={(f.columns ?? []).join(", ")} onChange={(e) => setField(si, fi, { columns: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />}
                  {f.type === "number" && <input className={`${inputClass} md:col-span-2`} placeholder="Unit (UCUM)" value={f.unit ?? ""} onChange={(e) => setField(si, fi, { unit: e.target.value || undefined })} />}
                  <input className={`${inputClass} md:col-span-2`} placeholder="French label (optional translation)" value={f.translations?.fr ?? ""} onChange={(e) => setField(si, fi, { translations: { ...(f.translations ?? {}), fr: e.target.value } })} />
                  <span className="self-center text-muted-foreground">id: {f.id}</span>
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => setSection(si, { fields: [...s.fields, { id: newId("f"), label: "New field", type: "textarea", required: false }] })}><Plus /> Add field</Button>
            </section>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDef({ ...def, sections: [...def.sections, { id: newId("s"), title: "New section", fields: [] }] })}><Plus /> Add section</Button>
          <section className="space-y-2 rounded-xl border bg-card p-3">
            <h3 className="text-sm font-semibold">Signature requirements</h3>
            {def.signatures.map((r, ri) => (
              <div key={`${r.role}-${ri}`} className="grid gap-2 text-xs md:grid-cols-[1fr_2fr_auto_auto]">
                <select className={inputClass} value={r.role} disabled={r.locked} onChange={(e) => setDef({ ...def, signatures: def.signatures.map((x, k) => (k === ri ? { ...x, role: e.target.value as typeof r.role } : x)) })}>{SIGNATURE_ROLES.map((x) => <option key={x}>{x}</option>)}</select>
                <input className={inputClass} value={r.label} onChange={(e) => setDef({ ...def, signatures: def.signatures.map((x, k) => (k === ri ? { ...x, label: e.target.value } : x)) })} />
                <label className="flex items-center gap-1"><input type="checkbox" checked={r.required} disabled={r.locked && r.required} onChange={(e) => setDef({ ...def, signatures: def.signatures.map((x, k) => (k === ri ? { ...x, required: e.target.checked } : x)) })} /> Required</label>
                <Button size="icon-sm" variant="ghost" aria-label="Remove signature" disabled={r.locked} onClick={() => setDef({ ...def, signatures: def.signatures.filter((_, k) => k !== ri) })}><Trash2 /></Button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => setDef({ ...def, signatures: [...def.signatures, { role: "CO_SIGNER", label: "Co-signatory", required: false }] })}><Plus /> Add signature</Button>
          </section>
          <label className="block text-xs">PDF footer note<textarea className={textareaClass} rows={2} value={def.output.footerNote ?? ""} onChange={(e) => setDef({ ...def, output: { ...def.output, footerNote: e.target.value || undefined } })} /></label>
        </fieldset>
      )}
      <section className="rounded-xl border bg-card p-3 text-xs">
        <h3 className="text-sm font-semibold">Version history</h3>
        <ul className="mt-1">{props.history.map((h) => <li key={h.version}>v{h.version} · {h.status}{h.publishedAt ? ` · published ${h.publishedAt.slice(0, 10)}` : ""}{h.changeNote ? ` · ${h.changeNote}` : ""}</li>)}</ul>
      </section>
    </div>
  );
}
