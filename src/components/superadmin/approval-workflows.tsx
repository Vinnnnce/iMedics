"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ClipboardCheck, RefreshCw, Plus, CheckCircle2, X, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type Workflow = { id: string; actionKey: string; name: string; description: string; approverRoleKey: string; secondApproverRoleKey: string | null; requiresReauth: boolean; active: boolean; _count: { requests: number } };
type Decision = { decision: string; reason: string; createdAt: string; decider: { name: string; email: string } };
type Request = { id: string; actionKey: string; payload: unknown; reason: string; status: string; createdAt: string; decidedAt: string | null; requester: { id: string; name: string; email: string }; workflow: { name: string; approverRoleKey: string; secondApproverRoleKey: string | null }; decisions: Decision[] };
type ApprovalsData = { workflows: Workflow[]; requests: Request[]; actionable: { id: string; canDecide: boolean }[] };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
const statusTone: Record<string, "default" | "secondary" | "destructive" | "outline"> = { PENDING: "secondary", APPROVED: "default", REJECTED: "destructive", CANCELLED: "outline" };

export function ApprovalWorkflows() {
  const [data, setData] = useState<ApprovalsData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"Requests" | "Workflows">("Requests");
  const [editor, setEditor] = useState<Workflow | "new" | null>(null);
  const editing = editor !== null && editor !== "new" ? editor : null;

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<ApprovalsData>("/admin/approvals")); }
    catch (e) { setError(e instanceof Error ? e.message : "Approval data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await apiClient.post("/admin/approvals", payload); setNotice(message); await reload(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); return false; }
    finally { setBusy(false); }
  };

  const actionableFor = (id: string) => data?.actionable.find((a) => a.id === id)?.canDecide ?? false;
  const pending = data?.requests.filter((r) => r.status === "PENDING") ?? [];
  const decided = data?.requests.filter((r) => r.status !== "PENDING") ?? [];

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ClipboardCheck className="size-4" />Access & Permission Control</p>
        <h1 className="text-xl font-bold">Approval Workflows</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure gates for sensitive actions. The requester can never approve their own request, and dual-approval workflows require two distinct approvers holding the configured roles.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
        {tab === "Workflows" && <Button onClick={() => setEditor("new")}><Plus className="mr-2 size-4" />New workflow</Button>}
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading approvals…</div>}
    {data && <>
      <nav aria-label="Approval sections" className="flex flex-wrap gap-2 border-b pb-3">
        {(["Requests", "Workflows"] as const).map((t) => <Button key={t} variant={tab === t ? "default" : "ghost"} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}{t === "Requests" && pending.length ? ` (${pending.length})` : ""}</Button>)}
      </nav>

      {tab === "Requests" && <section className="space-y-4">
        {pending.length > 0 && <h2 className="text-sm font-semibold text-muted-foreground">Awaiting decision</h2>}
        {pending.map((r) => <article key={r.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold">{r.workflow.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Requested by {r.requester.name} ({r.requester.email}) · {new Date(r.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-sm">{r.reason}</p>
              {r.decisions.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{r.decisions.map((d) => `${d.decider.name} ${d.decision.toLowerCase()}d`).join(" · ")}{r.workflow.secondApproverRoleKey && r.decisions.length === 1 ? " · second approval still required" : ""}</p>}
            </div>
            <Badge variant={statusTone[r.status] ?? "secondary"}>{r.status.toLowerCase()}</Badge>
          </div>
          {actionableFor(r.id) && <div className="flex flex-wrap gap-2">
            <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "DECIDE", requestId: r.id, decision: "APPROVE", reason: f.get("reason") }, "Request approved."); }}>
              <input name="reason" required minLength={15} placeholder="Approval rationale" className={`${inputClass} min-w-0 flex-1`} />
              <Button type="submit" size="sm" disabled={busy} className="self-start"><CheckCircle2 className="mr-1.5 size-3.5" />Approve</Button>
            </form>
            <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "DECIDE", requestId: r.id, decision: "REJECT", reason: f.get("reason") }, "Request rejected."); }}>
              <input name="reason" required minLength={15} placeholder="Rejection rationale" className={`${inputClass} min-w-0 flex-1`} />
              <Button type="submit" size="sm" variant="destructive" disabled={busy} className="self-start"><X className="mr-1.5 size-3.5" />Reject</Button>
            </form>
          </div>}
        </article>)}
        {!pending.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No requests are awaiting a decision.</p>}
        {decided.length > 0 && <>
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Recent decisions</h2>
          {decided.slice(0, 10).map((r) => <article key={r.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-4 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{r.workflow.name}</p>
              <p className="mt-1 text-muted-foreground">{r.requester.name} · {new Date(r.createdAt).toLocaleDateString()} · {r.decisions.map((d) => `${d.decider.name} ${d.decision.toLowerCase()}d`).join(", ") || "—"}</p>
            </div>
            <Badge variant={statusTone[r.status] ?? "secondary"}>{r.status.toLowerCase()}</Badge>
          </article>)}
        </>}
      </section>}

      {tab === "Workflows" && <section className="space-y-3">
        {data.workflows.map((w) => <article key={w.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{w.name}</h3>
              <Badge variant={w.active ? "default" : "secondary"}>{w.active ? "active" : "inactive"}</Badge>
              {w.secondApproverRoleKey && <Badge variant="outline">dual approval</Badge>}
              {w.requiresReauth && <Badge variant="outline">re-auth</Badge>}</div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{w.actionKey}</p>
            <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">Approvers: {w.approverRoleKey.replaceAll("_", " ").toLowerCase()}{w.secondApproverRoleKey ? ` then ${w.secondApproverRoleKey.replaceAll("_", " ").toLowerCase()}` : ""} · {w._count.requests} request{w._count.requests === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditor(w)}><Pencil className="mr-1.5 size-3.5" />Edit</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "DELETE_WORKFLOW", id: w.id }, "Workflow deleted.")}><Trash2 className="mr-1.5 size-3.5" />Delete</Button>
          </div>
        </article>)}
      </section>}
    </>}

    <Dialog open={editor !== null} onOpenChange={(v) => { if (!v) setEditor(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit workflow: ${editing.name}` : "New approval workflow"}</DialogTitle>
          <DialogDescription>Choose the action key this gate applies to and which roles must approve. Dual approval requires two distinct approvers.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
          const payload = {
            action: "UPSERT_WORKFLOW", ...(editing ? { id: editing.id } : {}),
            actionKey: String(f.get("actionKey") ?? "").toUpperCase(), name: String(f.get("name") ?? ""),
            description: String(f.get("description") ?? ""), approverRoleKey: String(f.get("approverRoleKey") ?? "").toUpperCase(),
            secondApproverRoleKey: f.get("secondApproverRoleKey") ? String(f.get("secondApproverRoleKey")).toUpperCase() : null,
            requiresReauth: f.get("requiresReauth") === "on", active: f.get("active") === "on",
          };
          const ok = await act(payload, editing ? "Workflow updated." : "Workflow created.");
          if (ok) setEditor(null);
          setBusy(false);
        }}>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <Field label="Action key (e.g. EXPORT_SENSITIVE_DATA)"><input name="actionKey" required pattern="[A-Z][A-Z0-9_]{2,60}" className={inputClass} defaultValue={editing?.actionKey ?? ""} /></Field>
          <Field label="Name"><input name="name" required minLength={2} maxLength={120} className={inputClass} defaultValue={editing?.name ?? ""} /></Field>
          <Field label="Description"><input name="description" maxLength={1000} className={inputClass} defaultValue={editing?.description ?? ""} /></Field>
          <Field label="First approver role key"><input name="approverRoleKey" required pattern="[A-Z][A-Z0-9_]{1,60}" className={inputClass} defaultValue={editing?.approverRoleKey ?? ""} placeholder="DEPUTY_SUPER_ADMIN" /></Field>
          <Field label="Second approver role key (optional)"><input name="secondApproverRoleKey" pattern="[A-Z][A-Z0-9_]{1,60}" className={inputClass} defaultValue={editing?.secondApproverRoleKey ?? ""} placeholder="SUPER_ADMIN" /></Field>
          <div className="grid gap-2 text-sm font-medium">
            <span className="text-sm font-medium">Behaviour</span>
            <label className="flex min-h-11 items-center gap-2 text-sm font-normal"><input type="checkbox" name="requiresReauth" defaultChecked={editing?.requiresReauth ?? true} /> Require re-authentication</label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-normal"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Workflow active</label>
          </div>
          <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Saving…" : "Save workflow"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
