"use client";

import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useState } from "react";
import { ShieldCheck, RefreshCw, Plus, Search, LockKeyhole, FileText, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { MODULES, policyRulesSchema, type PolicyRules } from "@/lib/platform/policy";

type Policy = { id: string; key: string; revision: number; kind: string; resource: string; mode: string; rules: PolicyRules; reason: string; createdAt: string };
export type ControlData = {
  policies: Policy[]; metrics: { staff: number; departments: number; pendingCredentials: number; activeSubscriptions: number; expiredSubscriptions: number; aiRequests30d: number; activeUsers30d: number; pendingUsers: number; facilityTypes: { kind: string | null; _count: { _all: number } }[] };
  audit: { sequence: string; action: string; actorId: string; resourceId: string; occurredAt: string; hash: string }[];
  security: { mfa: string; database: string; storage: string; clinicalAccess: string };
  grants: { userId: string; revokedAt: string | null; expiresAt: string | null; user: { name: string; email: string } }[];
  credentials: { id: string; type: string; number: string; authority: string; expiryDate: string | null; staff: { fullName: string; facility: { laboratoryName: string | null } } }[];
};
const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{Children.map(children, (child) => isValidElement<{ id?: string }>(child) && ["input", "select", "textarea"].includes(String(child.type)) ? cloneElement(child, { id }) : child)}</div>;
}
function human(s: string) { return s.toLowerCase().replaceAll("_", " "); }
export function PlatformControl() {
  const [data, setData] = useState<ControlData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Features");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Policy | "new" | null>(null);
  const [kind, setKind] = useState("FEATURE");
  const [mode, setMode] = useState("RESTRICTED");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<ControlData>("/admin/control")); }
    catch (e) { setError(e instanceof Error ? e.message : "Control centre is unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);
  const latest = Object.values((data?.policies ?? []).reduce<Record<string, Policy>>((out, p) => { if (!out[p.key] || out[p.key].revision < p.revision) out[p.key] = p; return out; }, {}));
  const items = latest.filter((p) => p.kind === (tab === "Documents" ? "DOCUMENT" : "FEATURE") && `${p.key} ${p.resource}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.resource.localeCompare(b.resource));
  const existing = editor && editor !== "new" ? editor : null;
  const defaults = existing?.rules ?? policyRulesSchema.parse({});
  const edit = (p: Policy | "new", type = tab === "Documents" ? "DOCUMENT" : "FEATURE") => { setEditor(p); setKind(p === "new" ? type : p.kind); setMode(p === "new" ? "RESTRICTED" : p.mode); setError(""); };
  const csv = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="size-4" />Privileged administration</p><h1 className="text-xl font-bold">Super Administrator Control Centre</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage platform availability without changing clinical findings or deleting historical records.</p></div><Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button></header>
    {error && <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><p className="font-medium text-destructive">{error}</p><p className="text-muted-foreground">Master controls require an explicit, unexpired Super Administrator grant and MFA completed within the last 10 minutes. Ordinary platform administrators retain their existing administrative workspace.</p></div>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Checking privileged session and loading platform controls…</div>}
    {!loading && data && <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-xs"><span className="flex items-center gap-2"><LockKeyhole className="size-4" />MFA verified</span><span>Database connected</span><span>No automatic clinical privileges</span><span>Versioned policy changes</span></div>
      <section aria-label="Live platform metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[["Active users / 30 days", data.metrics.activeUsers30d], ["Active facility staff", data.metrics.staff], ["Active departments", data.metrics.departments], ["Credentials awaiting review", data.metrics.pendingCredentials], ["Active subscriptions", data.metrics.activeSubscriptions], ["Expired subscriptions", data.metrics.expiredSubscriptions], ["AI requests / 30 days", data.metrics.aiRequests30d], ["Pending registrations", data.metrics.pendingUsers]].map(([name, count]) => <div className="min-w-0 rounded-xl border bg-card p-4" key={name}><p className="text-xs text-muted-foreground">{name}</p><p className="mt-2 text-xl font-semibold tabular-nums">{Number(count).toLocaleString()}</p></div>)}</section>
      <nav aria-label="Master control sections" className="flex flex-wrap gap-2 border-b pb-3">{["Features", "Documents", "Credentials", "Security", "Audit trail"].map((t) => <Button key={t} variant={tab === t ? "default" : "ghost"} aria-pressed={tab === t} onClick={() => { setTab(t); setPage(0); setSearch(""); }}>{t}</Button>)}</nav>
      {tab === "Credentials" && <section className="space-y-4"><h2 className="font-semibold">Professional verification queue</h2><p className="text-sm text-muted-foreground">Review the professional register and supporting evidence independently. An uploaded certificate does not establish a clinical privilege. Showing the oldest 50 pending credentials.</p>
        {!data.credentials.length && <p className="rounded-xl border p-6 text-sm text-muted-foreground">No credentials are awaiting review.</p>}
        {data.credentials.map((c) => <article key={c.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4"><div><h3 className="font-semibold">{c.staff.fullName}</h3><p className="mt-1 text-sm text-muted-foreground">{c.staff.facility.laboratoryName} · {human(c.type)}</p><p className="mt-2 break-all text-sm">{c.authority} · {c.number}</p><p className="mt-2 text-xs text-muted-foreground">{c.expiryDate ? `Expires ${new Date(c.expiryDate).toLocaleDateString()}` : "Expiry not recorded"}</p></div>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError(""); try { await apiClient.post("/admin/control", { action: "VERIFY_CREDENTIAL", id: c.id, decision: f.get("decision"), reason: f.get("reason"), confirmation: f.get("confirmation") }); setNotice("Credential review recorded. Clinical privileges remain separately authorized."); await reload(); } catch (err) { setError(err instanceof Error ? err.message : "Review failed"); } finally { setBusy(false); } }}>
            <Field label="Review decision"><select name="decision" required className={inputClass}><option value="">Select decision</option><option value="VERIFIED">Verified independently</option><option value="REJECTED">Rejected</option></select></Field>
            <Field label="Verification evidence and reason"><input name="reason" required minLength={15} maxLength={2000} className={inputClass} /></Field>
            <Field label="Type REVIEW CREDENTIAL"><input name="confirmation" required pattern="REVIEW CREDENTIAL" autoComplete="off" className={inputClass} /></Field>
            <Button disabled={busy} type="submit" className="self-end">Record review</Button>
          </form></article>)}</section>}
      {(tab === "Features" || tab === "Documents") && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search policies" placeholder="Search resource or policy key" className="min-h-11 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div><Button onClick={() => edit("new")}><Plus className="mr-2 size-4" />Create {tab === "Documents" ? "document" : "feature"} policy</Button></div>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{tab === "Documents" ? "Policies govern template and document operations. Signed records remain intact; restrictions never delete or rewrite them." : "Applicable policies intersect with facility permissions. An enabled module never overrides patient confidentiality, professional verification or tenant isolation."}</div>
        {!items.length && <div className="space-y-3 rounded-xl border border-dashed p-8 text-center"><Layers3 className="mx-auto size-6 text-muted-foreground" /><h2 className="font-semibold">No matching policies</h2><p className="text-sm text-muted-foreground">Existing access checks remain in force until you publish an additional restriction.</p></div>}
        <div className="space-y-3">{items.slice(page * 10, page * 10 + 10).map((p) => <article key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-sm font-semibold">{human(p.resource)}</h2><span className="rounded-md bg-muted px-2 py-1 text-xs">{human(p.mode)}</span><span className="text-xs text-muted-foreground">Revision {p.revision}</span></div><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{p.key}</p><p className="mt-2 text-xs text-muted-foreground">Accounts: {p.rules.accountTypes.join(", ") || "All"} · Facilities: {p.rules.facilityTypes.join(", ") || "All"}</p><p className="mt-2 break-words text-sm">{p.reason}</p></div><Button variant="outline" onClick={() => edit(p)}>Review & revise</Button></article>)}</div>
        <div className="flex justify-between gap-3 text-sm"><span>{items.length} current policies</span><div className="flex gap-2"><Button variant="outline" onClick={() => setPage(page - 1)} disabled={!page}>Previous</Button><Button variant="outline" onClick={() => setPage(page + 1)} disabled={(page + 1) * 10 >= items.length}>Next</Button></div></div>
        {tab === "Features" && <details className="rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-medium">Registered module catalogue</summary><div className="mt-4 flex flex-wrap gap-2">{MODULES.map((m) => <span key={m} className="rounded-md bg-muted px-2 py-1 text-xs">{human(m)}</span>)}</div></details>}
      </section>}
      {tab === "Security" && <section className="space-y-5"><h2 className="font-semibold">Privileged access boundary</h2><div className="rounded-xl border bg-card p-5 text-sm"><p>{data.security.clinicalAccess}. Patient confidentiality and regulated professional authorization remain independent.</p><p className="mt-3 text-muted-foreground">MFA freshness is checked on every master-control API request. Grants are provisioned through the audited operator procedure, not client metadata or facility roles.</p><p className="mt-3 text-muted-foreground">{data.security.storage}. No fabricated storage or infrastructure health statistics are shown.</p></div><h3 className="text-sm font-semibold">Privileged administrator grants</h3>{data.grants.map((g) => <article className="min-w-0 rounded-xl border p-4 text-sm" key={g.userId}><p className="font-medium">{g.user.name}</p><p className="break-all text-muted-foreground">{g.user.email}</p><p className="mt-2 text-xs">{g.revokedAt ? "Revoked" : g.expiresAt && new Date(g.expiresAt) <= new Date() ? "Expired" : "Active"} · {g.expiresAt ? `Expires ${new Date(g.expiresAt).toLocaleDateString()}` : "No grant expiry"}</p></article>)}</section>}
      {tab === "Audit trail" && <section className="space-y-4"><h2 className="font-semibold">Tamper-evident administrative events</h2><p className="text-sm text-muted-foreground">Changes and their audit event commit in the same transaction. Database-generated SHA-256 hashes chain each event to its predecessor.</p>{data.audit.map((a) => <article key={a.sequence} className="min-w-0 space-y-2 rounded-xl border p-4 text-sm"><p className="font-semibold">{human(a.action)}</p><p className="text-xs text-muted-foreground">#{a.sequence} · {new Date(a.occurredAt).toLocaleString()}</p><p className="break-all font-mono text-xs text-muted-foreground">{a.resourceId}</p><p className="break-all font-mono text-xs text-muted-foreground">SHA-256 {a.hash}</p></article>)}{!data.audit.length && <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">Privileged activity will appear here after the first audited change.</p>}</section>}
    </>}
    <Dialog open={editor !== null} onOpenChange={(v) => { if (!v) setEditor(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="size-5" />{existing ? "Review policy revision" : "Create access policy"}</DialogTitle><DialogDescription>Review the target population and impact. Publish a new revision to reverse a restriction; existing records are preserved.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form key={existing?.id ?? "new"} className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
        try {
          const rules = { accountTypes: csv(f.get("accounts")), facilityTypes: csv(f.get("facilities")), facilityIds: csv(f.get("facilityIds")), roles: csv(f.get("roles")), countries: csv(f.get("countries")).map((c) => c.toUpperCase()), subscriptionPlans: csv(f.get("plans")), startsAt: f.get("start") ? new Date(String(f.get("start"))).toISOString() : null, endsAt: f.get("end") ? new Date(String(f.get("end"))).toISOString() : null, deniedActions: f.getAll("denied") };
          await apiClient.post("/admin/control", { action: "POLICY", key: f.get("key"), kind, resource: f.get("resource"), mode, rules, expectedRevision: existing?.revision ?? 0, reason: f.get("reason"), confirmation: f.get("confirmation") });
          setEditor(null); setNotice("Policy revision published. Availability changes are enforced on the next request."); await reload();
        } catch (err) { setError(err instanceof Error ? err.message : "Policy could not be saved"); } finally { setBusy(false); }
      }}>
        <Field label="Policy key"><input className={inputClass} name="key" required pattern="[a-zA-Z0-9_.:\-]{2,100}" defaultValue={existing?.key} readOnly={Boolean(existing)} placeholder="hospital.lab.availability" /></Field>
        <Field label="Policy type"><select className={inputClass} value={kind} disabled={Boolean(existing)} onChange={(e) => setKind(e.target.value)}><option value="FEATURE">Feature availability</option><option value="DOCUMENT">Document access</option></select></Field>
        <Field label="Resource">{kind === "FEATURE" ? <select className={inputClass} name="resource" defaultValue={existing?.resource}>{MODULES.map((m) => <option key={m}>{m}</option>)}</select> : <input name="resource" className={inputClass} defaultValue={existing?.resource ?? "*"} required placeholder="* or template code" />}</Field>
        <Field label="Availability"><select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>{["ENABLED", "DISABLED", "READ_ONLY", "RESTRICTED"].map((m) => <option key={m}>{m}</option>)}</select></Field>
        <details className="rounded-lg border p-4 sm:col-span-2" open><summary className="cursor-pointer text-sm font-semibold">Target population & restrictions</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Account types (comma separated)"><input name="accounts" className={inputClass} defaultValue={defaults.accountTypes.join(", ")} placeholder="PATIENT, DOCTOR, HOSPITAL" /></Field><Field label="Facility types"><input name="facilities" className={inputClass} defaultValue={defaults.facilityTypes.join(", ")} placeholder="HOSPITAL, LABORATORY" /></Field>
          <Field label="Selected facility UUIDs"><input name="facilityIds" className={inputClass} defaultValue={defaults.facilityIds.join(", ")} /></Field><Field label="Allowed global roles"><input name="roles" className={inputClass} defaultValue={defaults.roles.join(", ")} placeholder="DOCTOR, LAB_SCIENTIST" /></Field>
          <Field label="Allowed country codes"><input name="countries" className={inputClass} defaultValue={defaults.countries.join(", ")} placeholder="NG, DE" /></Field><Field label="Required subscription plan UUIDs"><input name="plans" className={inputClass} defaultValue={defaults.subscriptionPlans.join(", ")} /></Field>
          <Field label="Available from"><input type="datetime-local" name="start" className={inputClass} defaultValue={defaults.startsAt?.slice(0, 16)} /></Field><Field label="Available until"><input type="datetime-local" name="end" className={inputClass} defaultValue={defaults.endsAt?.slice(0, 16)} /></Field>
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Block operations (restricted mode)</legend><div className="flex flex-wrap gap-3">{["VIEW", "CREATE", "EDIT", "APPROVE", "SIGN", "DOWNLOAD", "PRINT"].map((a) => <label className="flex min-h-11 items-center gap-2 text-xs" key={a}><input type="checkbox" name="denied" value={a} defaultChecked={defaults.deniedActions.includes(a as PolicyRules["deniedActions"][number])} />{a}</label>)}</div></fieldset>
        </div></details>
        <Field label="Reason for this revision"><textarea className={inputClass} name="reason" minLength={15} maxLength={2000} required /></Field><Field label="Type APPLY POLICY to confirm"><input className={inputClass} name="confirmation" required autoComplete="off" /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">Empty account/facility selectors target everyone. Role, country, dates and subscription conditions are enforced in restricted mode. A facility subscription is not inferred from an owner&apos;s doctor plan.</p>
        <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Publishing…" : `Publish revision ${(existing?.revision ?? 0) + 1}`}</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}
