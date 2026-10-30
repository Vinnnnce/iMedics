"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DocumentView } from "@/lib/his/documents";
import { ATTESTED_ROLES, sectionVisible, type DocumentContent, type TemplateField } from "@/lib/his/template-schema";
import { api, inputClass, textareaClass } from "./use-api";

interface Perms { author: boolean; review: boolean; sign: boolean; approve: boolean; release: boolean }
interface MediaOption { id: string; fileName: string; mimeType: string; sensitivity: string }

function FieldInput({ field, value, onChange, disabled, mediaOptions }: { field: TemplateField; value: DocumentContent[string] | undefined; onChange: (v: DocumentContent[string]) => void; disabled: boolean; mediaOptions: MediaOption[] }) {
  const id = `f-${field.id}`;
  const label = <label htmlFor={id} className="text-xs font-semibold">{field.label}{field.required ? " *" : ""}{field.unit ? ` (${field.unit})` : ""}</label>;
  switch (field.type) {
    case "textarea": return <div>{label}<textarea id={id} className={textareaClass} rows={4} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
    case "number": return <div>{label}<input id={id} type="number" className={inputClass} disabled={disabled} value={value === undefined || value === null ? "" : String(value)} min={field.min} max={field.max} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} /></div>;
    case "date": case "datetime": return <div>{label}<input id={id} type={field.type === "date" ? "date" : "datetime-local"} className={inputClass} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
    case "checkbox": return <label className="flex items-center gap-2 text-sm"><input id={id} type="checkbox" disabled={disabled} checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {field.label}{field.required ? " *" : ""}</label>;
    case "select": return <div>{label}<select id={id} className={inputClass} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)}><option value="">—</option>{field.options?.map((o) => <option key={o}>{o}</option>)}</select></div>;
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return <fieldset><legend className="text-xs font-semibold">{field.label}</legend>{field.options?.map((o) => <label key={o} className="mr-3 inline-flex items-center gap-1 text-sm"><input type="checkbox" disabled={disabled} checked={arr.includes(o)} onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />{o}</label>)}</fieldset>;
    }
    case "table": {
      const cols = field.columns ?? [];
      const rows = Array.isArray(value) ? (value as string[][]) : [];
      const set = (r: number, c: number, v: string) => onChange(rows.map((row, i) => (i === r ? cols.map((_, k) => (k === c ? v : row[k] ?? "")) : row)));
      return (
        <div>{label}
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{cols.map((c) => <th key={c} className="text-left">{c}</th>)}<th /></tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{cols.map((c, ci) => <td key={c}><input aria-label={`${c} row ${r + 1}`} className="h-8 w-full rounded border px-1" disabled={disabled} value={row[ci] ?? ""} onChange={(e) => set(r, ci, e.target.value)} /></td>)}<td>{!disabled && <button type="button" className="px-1 text-destructive" aria-label="Remove row" onClick={() => onChange(rows.filter((_, i) => i !== r))}>×</button>}</td></tr>)}</tbody></table></div>
          {!disabled && <Button type="button" size="xs" variant="outline" onClick={() => onChange([...rows, cols.map(() => "")])}>Add row</Button>}
        </div>
      );
    }
    case "image": case "attachment": {
      const choices = mediaOptions.filter((m) => field.type !== "image" || m.mimeType.startsWith("image/"));
      return <div>{label}<select id={id} className={inputClass} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose a patient file</option>
        {typeof value === "string" && !choices.some((m) => m.id === value) && <option value={value}>Unavailable file reference: {value}</option>}
        {choices.map((m) => <option key={m.id} value={m.id}>{m.fileName}</option>)}
      </select><p className="mt-1 text-xs text-muted-foreground">Upload files in Diagnostic media first. Only files for this patient are available; patient access requires a separate release.</p></div>;
    }
    case "signature": return <p className="text-xs text-muted-foreground">{field.label}: captured through the signature workflow below.</p>;
    default: return <div>{label}<input id={id} className={inputClass} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
  }
}

/** Document authoring and workflow: autosaved drafts, explicit submit/review/sign/finalize, amendments. */
export function DocumentEditor({ view, perms, isAuthor, mediaOptions = [] }: { view: DocumentView; perms: Perms; isAuthor: boolean; mediaOptions?: MediaOption[] }) {
  const router = useRouter();
  const [content, setContent] = useState<DocumentContent>(view.content);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signRole, setSignRole] = useState("");
  const [signerName, setSignerName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [attest, setAttest] = useState(false);
  const editable = view.status === "DRAFT" && isAuthor && perms.author;
  const contentRef = useRef(content);
  const savingRef = useRef<Promise<void> | null>(null);
  const saveDraft = useCallback(async (autosave: boolean) => {
    // Explicit save/submit waits for any autosave, then saves the newest snapshot.
    while (savingRef.current) await savingRef.current.catch(() => undefined);
    const snapshot = contentRef.current;
    const pending = api(`/api/facility/his/documents/${view.id}`, { method: "PUT", body: { content: snapshot, autosave } }).then(() => {
      if (contentRef.current === snapshot) setDirty(false);
      setSaved(new Date().toLocaleTimeString());
    });
    savingRef.current = pending;
    try { await pending; } finally { if (savingRef.current === pending) savingRef.current = null; }
  }, [view.id]);

  useEffect(() => {
    if (!editable || !dirty || busy) return;
    const t = setTimeout(async () => {
      try { await saveDraft(true); }
      catch (e) { setMsg({ ok: false, text: `Autosave failed: ${e instanceof Error ? e.message : ""}` }); }
    }, 2500);
    return () => clearTimeout(t);
  }, [content, dirty, editable, busy, saveDraft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try {
      if (editable) await saveDraft(false);
      const res = await api<{ amendment?: { id: string } }>(`/api/facility/his/documents/${view.id}/actions`, { body });
      setMsg({ ok: true, text: ok });
      if (res.amendment) router.push(`/lab/clinical-documents/${res.amendment.id}`); else router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" }); } finally { setBusy(false); }
  };
  const ask = (q: string) => window.prompt(q)?.trim();
  const roles = [...new Set(view.definition.signatures.flatMap((r) => [r.role, ...(r.anyOf ?? [])]))];
  const attested = (ATTESTED_ROLES as readonly string[]).includes(signRole);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
        <strong data-testid="text-document-status">{view.statusLabel}</strong>
        {editable && <span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes…" : saved ? `Autosaved ${saved}` : "Draft"}</span>}
        <span className="flex-1" />
        {editable && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await saveDraft(false); setMsg({ ok: true, text: "Saved" }); router.refresh(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" }); } finally { setBusy(false); } }} data-testid="button-save-document">Save</Button>}
        {editable && <Button size="sm" disabled={busy} onClick={() => act({ action: "submit" }, "Submitted")} data-testid="button-submit-document">Submit</Button>}
        {view.status === "PENDING_REVIEW" && perms.review && <Button size="sm" disabled={busy} onClick={() => act({ action: "review" }, "Verified")} data-testid="button-review-document">Verify (clinical review)</Button>}
        {(view.status === "PENDING_REVIEW" || view.status === "PENDING_SIGNATURE") && (perms.review || isAuthor) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { const r = ask("Reason for returning to draft (signatures will be revoked)"); if (r) void act({ action: "return", reason: r }, "Returned to draft"); }}>Return to draft</Button>}
        {view.status === "PENDING_SIGNATURE" && perms.sign && <Button size="sm" disabled={busy || view.missingSignatureLabels.length > 0} onClick={() => act({ action: "finalize" }, "Finalized")} data-testid="button-finalize-document">Finalize</Button>}
        {view.status === "FINAL" && perms.author && !view.supersededBy && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const r = ask("Reason for amendment (the original stays unchanged)"); if (r) void act({ action: "amend", reason: r }, "Amendment created"); }} data-testid="button-amend-document">Amend</Button>}
        {view.status === "FINAL" && perms.release && !view.releasedToPatientAt && <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (view.sensitivity === "SPECIALLY_PROTECTED" && !window.confirm("Specially protected record: confirm release complies with policy.")) return; void act({ action: "release", confirmProtected: true }, "Released to patient portal"); }} data-testid="button-release-document">Release to patient</Button>}
        {view.status !== "AMENDED" && view.status !== "ENTERED_IN_ERROR" && (perms.approve || (isAuthor && view.status !== "FINAL")) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { const r = ask("Reason this was entered in error"); if (r) void act({ action: "void", reason: r }, "Marked entered in error"); }}>Entered in error</Button>}
        <a className="text-xs text-primary underline" href={`/lab/clinical-documents/${view.id}/print`}>Print view</a>
        <a className="text-xs text-primary underline" href={`/api/facility/his/documents/${view.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
        {["FINAL", "AMENDED"].includes(view.status) && <a className="text-xs text-primary underline" href={`/api/facility/his/documents/${view.id}/fhir`}>FHIR JSON</a>}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      {view.definition.notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">{view.definition.notice}</p>}
      {view.supersedes && <p className="text-sm text-amber-700">Amendment of <a className="underline" href={`/lab/clinical-documents/${view.supersedes.id}`}>{view.supersedes.documentNumber}</a>: {view.amendmentReason}</p>}
      {view.supersededBy && <p className="text-sm text-red-700">Superseded by <a className="underline" href={`/lab/clinical-documents/${view.supersededBy.id}`}>{view.supersededBy.documentNumber}</a> ({view.supersededBy.status}).</p>}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {view.definition.sections.filter((s) => sectionVisible(s, content)).map((s) => (
          <section key={s.id} className="space-y-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            {s.fields.map((f) => <FieldInput key={f.id} field={f} mediaOptions={mediaOptions.filter((m) => {
              const rank: Record<string, number> = { STANDARD: 0, RESTRICTED: 1, SPECIALLY_PROTECTED: 2 };
              return rank[m.sensitivity] <= rank[view.sensitivity];
            })} disabled={!editable || busy} value={content[f.id]} onChange={(v) => { const next = { ...contentRef.current, [f.id]: v }; contentRef.current = next; setContent(next); setDirty(true); }} />)}
          </section>
        ))}
      </form>

      <section className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">Signatures</h2>
        <ul className="space-y-1">
          {view.definition.signatures.map((r) => {
            const okRoles = r.anyOf?.length ? r.anyOf : [r.role];
            const sig = view.signatures.find((s) => s.valid && okRoles.includes(s.role as never));
            return <li key={r.role + r.label}>{r.label}{r.required ? " *" : ""}: {sig ? <span className="text-emerald-700">{sig.signerName} · {sig.method === "HANDWRITTEN_ATTESTED" ? "handwritten (attested)" : "electronic"} · {new Date(sig.signedAt).toLocaleString()}</span> : <span className="text-muted-foreground">not signed</span>}</li>;
          })}
        </ul>
        {view.signatures.some((s) => !s.valid) && <p className="text-xs text-muted-foreground">{view.signatures.filter((s) => !s.valid).length} earlier signature(s) revoked or no longer matching the content.</p>}
        {view.status === "PENDING_SIGNATURE" && perms.sign && (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <label className="text-xs">Sign as<select className={inputClass} value={signRole} onChange={(e) => setSignRole(e.target.value)} data-testid="select-sign-role"><option value="">Choose role…</option>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
            {attested && <>
              <label className="text-xs">Signer full name<input className={inputClass} value={signerName} onChange={(e) => setSignerName(e.target.value)} /></label>
              <label className="text-xs">Relationship / authority<input className={inputClass} value={relationship} onChange={(e) => setRelationship(e.target.value)} /></label>
              <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> I witnessed this person sign the paper form in person. (The original must be retained per hospital policy.)</label>
            </>}
            {!attested && signRole && <p className="text-xs text-muted-foreground sm:col-span-2">You will sign as yourself with an authenticated electronic signature bound to the current content.</p>}
            <Button size="sm" className="sm:col-span-2" disabled={busy || !signRole || (attested && (!signerName || !attest))} data-testid="button-sign-document"
              onClick={() => act({ action: "sign", role: signRole, ...(attested ? { signerName, relationship: relationship || undefined, attestation: true } : {}) }, "Signature recorded")}>Record signature</Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 text-xs">
        <h2 className="text-sm font-semibold">Document trail</h2>
        <ol className="mt-1 space-y-0.5">{view.events.map((e, i) => <li key={i}>{new Date(e.createdAt).toLocaleString()} · {e.action}{e.note ? ` — ${e.note}` : ""}</li>)}</ol>
      </section>
    </div>
  );
}
