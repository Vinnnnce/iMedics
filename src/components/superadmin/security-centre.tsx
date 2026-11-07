"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Siren, RefreshCw, Plus, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type Incident = {
  id: string; kind: string; severity: string; title: string; description: string; status: string;
  createdAt: string; updatedAt: string; resolvedAt: string | null; resolution: string | null;
  reportedBy: { name: string; email: string }; assignedTo: { name: string; email: string } | null;
};
type Grant = { userId: string; grantedBy: string; reason: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; user: { name: string; email: string } };
type SecurityData = { incidents: Incident[]; grants: Grant[]; auditEvents7d: number };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
const severityTone: Record<string, "default" | "secondary" | "warning" | "destructive"> = { LOW: "secondary", MEDIUM: "default", HIGH: "warning", CRITICAL: "destructive" };
const statusTone: Record<string, "default" | "secondary" | "warning" | "destructive"> = { OPEN: "destructive", INVESTIGATING: "warning", CONTAINED: "default", RESOLVED: "secondary" };
const human = (s: string) => s.toLowerCase().replaceAll("_", " ");

export function SecurityCentre() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<SecurityData>("/admin/security-incidents")); }
    catch (e) { setError(e instanceof Error ? e.message : "Security data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await apiClient.post("/admin/security-incidents", payload); setNotice(message); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const activeGrants = (data?.grants ?? []).filter((g) => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > new Date()));

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Siren className="size-4" />Security, Compliance & System Operations</p>
        <h1 className="text-xl font-bold">Security Centre</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Track security and privacy incidents, review privileged grants and monitor administrative activity. Privileged users must use multi-factor authentication; master-control writes require a fresh MFA session.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 size-4" />Report incident</Button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading security overview…</div>}
    {data && <>
      <section aria-label="Security posture" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Open incidents</p><p className="mt-2 text-xl font-semibold tabular-nums">{data.incidents.filter((i) => i.status !== "RESOLVED").length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Critical / high</p><p className="mt-2 text-xl font-semibold tabular-nums">{data.incidents.filter((i) => i.status !== "RESOLVED" && ["HIGH", "CRITICAL"].includes(i.severity)).length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Active Super Admin grants</p><p className="mt-2 text-xl font-semibold tabular-nums">{activeGrants.length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Audit events (7 days)</p><p className="mt-2 text-xl font-semibold tabular-nums">{data.auditEvents7d.toLocaleString()}</p></div>
      </section>

      <section aria-label="Incidents" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Incident register</h2>
        {data.incidents.map((i) => <article key={i.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold">{i.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{human(i.kind)} · reported by {i.reportedBy.name} · {new Date(i.createdAt).toLocaleString()}{i.assignedTo ? ` · assigned to ${i.assignedTo.name}` : ""}</p>
              <p className="mt-2 text-sm">{i.description}</p>
              {i.resolution && <p className="mt-2 rounded-lg bg-muted p-2 text-sm">Resolution: {i.resolution}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5"><Badge variant={severityTone[i.severity] ?? "secondary"}>{i.severity}</Badge><Badge variant={statusTone[i.status] ?? "secondary"}>{i.status.toLowerCase()}</Badge></div>
          </div>
          {i.status !== "RESOLVED" && <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            void act({ action: "UPDATE_INCIDENT", id: i.id, status: f.get("status"), resolution: f.get("resolution") || undefined, assignedToId: f.get("assignedToId") || undefined }, "Incident updated.");
          }}>
            <label className="grid gap-1 text-xs font-medium">Status<select name="status" className={inputClass} defaultValue={i.status}>{["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"].map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-medium">Resolution summary (required to resolve)<input name="resolution" className={inputClass} defaultValue={i.resolution ?? ""} /></label>
            <Button type="submit" size="sm" disabled={busy} className="self-end">Update</Button>
          </form>}
        </article>)}
        {!data.incidents.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No security incidents recorded. Report suspicious activity as soon as it is noticed.</p>}
      </section>

      <section aria-label="Privileged grants" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Privileged administrator grants</h2>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground"><LockKeyhole className="size-4" />Emergency access is never invisible</p>
          <p className="mt-2">Break-glass access to patient records requires a legitimate reason, identity verification, narrow scope, a time limit, alerts and mandatory audit review. The platform owner has no unaudited route around patient privacy controls.</p>
        </div>
        {data.grants.map((g) => <article key={g.userId} className="rounded-xl border p-4 text-sm">
          <p className="font-medium">{g.user.name} <span className="text-muted-foreground">· {g.user.email}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{g.revokedAt ? "Revoked" : g.expiresAt && new Date(g.expiresAt) <= new Date() ? "Expired" : "Active"} · granted by {g.grantedBy} · {new Date(g.createdAt).toLocaleDateString()}{g.expiresAt ? ` · expires ${new Date(g.expiresAt).toLocaleDateString()}` : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">{g.reason}</p>
        </article>)}
      </section>
    </>}

    <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogHeader><DialogTitle>Report a security incident</DialogTitle>
          <DialogDescription>Record suspicious logins, privilege misuse, policy violations or data-export concerns. Every record is audited.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
          try {
            await apiClient.post("/admin/security-incidents", { action: "CREATE_INCIDENT", kind: f.get("kind"), severity: f.get("severity"), title: f.get("title"), description: f.get("description") });
            setOpen(false); setNotice("Incident recorded."); await reload();
          } catch (err) { setError(err instanceof Error ? err.message : "Could not record the incident"); }
          finally { setBusy(false); }
        }}>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Field label="Kind"><select name="kind" required className={inputClass}>{["SUSPICIOUS_LOGIN", "PRIVILEGE_MISUSE", "DATA_EXPORT", "BREACH_INVESTIGATION", "POLICY_VIOLATION", "OTHER"].map((k) => <option key={k} value={k}>{human(k)}</option>)}</select></Field>
          <Field label="Severity"><select name="severity" required className={inputClass}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></Field>
          <Field label="Title"><input name="title" required minLength={5} maxLength={160} className={inputClass} /></Field>
          <Field label="What happened"><textarea name="description" required minLength={15} maxLength={4000} className={inputClass} /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record incident"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
