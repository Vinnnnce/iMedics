"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Plus, RefreshCw, UsersRound, TriangleAlert, Ban, Undo2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type Department = { id: string; name: string; description: string; parentId: string | null; rank: number; active: boolean; _count: { memberships: number; teams: number } };
type Team = { id: string; name: string; description: string; departmentId: string | null; active: boolean; leaderMembershipId: string | null; _count: { memberships: number } };
type Membership = {
  id: string; userId: string; title: string; responsibilities: string; status: string; startsAt: string; endsAt: string | null; accessExpired: boolean;
  user: { id: string; name: string; email: string; role: string; status: string };
  department: { id: string; name: string } | null; team: { id: string; name: string } | null;
  reportsTo: { id: string; title: string; user: { name: string; email: string } } | null;
  roleAssignments: { id: string; reason: string; expiresAt: string | null; createdAt: string; role: { id: string; key: string; name: string } }[];
};
type RoleLite = { id: string; key: string; name: string };
type TeamData = { departments: Department[]; teams: Team[]; memberships: Membership[]; roles: RoleLite[] };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
const statusTone: Record<string, "default" | "secondary" | "destructive"> = { ACTIVE: "default", SUSPENDED: "destructive", ENDED: "secondary" };

export function TeamManager() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"Members" | "Departments" | "Teams">("Members");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [transferFor, setTransferFor] = useState<Membership | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<TeamData>("/admin/team")); }
    catch (e) { setError(e instanceof Error ? e.message : "Team data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await apiClient.post("/admin/team", payload); setNotice(message); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const memberships = (data?.memberships ?? []).filter((m) =>
    `${m.user.name} ${m.user.email} ${m.title} ${m.department?.name ?? ""} ${m.team?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const expired = (m: Membership) => m.accessExpired;

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><UsersRound className="size-4" />Team & Workforce</p>
        <h1 className="text-xl font-bold">Admin Team Management</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Build the internal team: departments, teams, reporting lines, responsibilities and bounded access windows. Suspending or ending a membership revokes console access immediately.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 size-4" />Add team member</Button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading the administrative team…</div>}
    {data && <>
      <nav aria-label="Team sections" className="flex flex-wrap gap-2 border-b pb-3">
        {(["Members", "Departments", "Teams"] as const).map((t) => <Button key={t} variant={tab === t ? "default" : "ghost"} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</Button>)}
      </nav>

      {tab === "Members" && <section className="space-y-4">
        <Input aria-label="Search team members" placeholder="Search name, email, title, department or team" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 sm:max-w-sm" />
        <div className="space-y-3">
          {memberships.map((m) => <article key={m.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{m.user.name}</h3>
                <p className="break-all text-sm text-muted-foreground">{m.user.email} · {m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.department?.name ?? "No department"} · {m.team?.name ?? "No team"}{m.reportsTo ? ` · reports to ${m.reportsTo.user.name}` : ""}</p>
                {m.responsibilities && <p className="mt-2 text-sm">{m.responsibilities}</p>}
                {m.roleAssignments.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{m.roleAssignments.map((a) => <Badge key={a.id} variant="outline">{a.role.name}</Badge>)}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={expired(m) ? "secondary" : statusTone[m.status] ?? "secondary"}>{expired(m) ? "ACCESS EXPIRED" : m.status}</Badge>
                {m.endsAt && <p className="text-xs text-muted-foreground">Access ends {new Date(m.endsAt).toLocaleDateString()}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {m.status === "ACTIVE" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "SET_MEMBER_STATUS", id: m.id, status: "SUSPENDED", reason: "Suspended from the Super Admin console pending review." }, "Membership suspended. Console access is revoked.")}><Ban className="mr-1.5 size-3.5" />Suspend</Button>}
              {m.status === "SUSPENDED" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "SET_MEMBER_STATUS", id: m.id, status: "ACTIVE", reason: "Reinstated after review from the Super Admin console." }, "Membership reactivated.")}><Undo2 className="mr-1.5 size-3.5" />Reactivate</Button>}
              {m.status !== "ENDED" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "SET_MEMBER_STATUS", id: m.id, status: "ENDED", reason: "Responsibilities ended from the Super Admin console." }, "Membership ended.")}>End membership</Button>}
              <Button variant="outline" size="sm" onClick={() => setTransferFor(m)}><ArrowRightLeft className="mr-1.5 size-3.5" />Transfer responsibilities</Button>
            </div>
          </article>)}
          {!memberships.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No administrative team members yet. Add the first team member to delegate console responsibilities.</p>}
        </div>
      </section>}

      {tab === "Departments" && <section className="space-y-4">
        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "CREATE_DEPARTMENT", name: f.get("name"), description: f.get("description"), rank: 500 }, "Department created."); e.currentTarget.reset(); }}>
          <Field label="New department name"><input name="name" required minLength={2} maxLength={120} className={inputClass} placeholder="e.g. Data & Analytics" /></Field>
          <Field label="Description"><input name="description" maxLength={500} className={inputClass} placeholder="What this department owns" /></Field>
          <Button type="submit" disabled={busy} className="self-end"><Plus className="mr-2 size-4" />Create</Button>
        </form>
        <div className="space-y-3">
          {data.departments.map((d) => <article key={d.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <h3 className="font-semibold">{d.name}{!d.active && <Badge variant="secondary" className="ml-2">inactive</Badge>}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.description || "No description"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d._count.memberships} member{d._count.memberships === 1 ? "" : "s"} · {d._count.teams} team{d._count.teams === 1 ? "" : "s"}</p>
            </div>
            {d.active && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "UPDATE_DEPARTMENT", id: d.id, active: false }, "Department deactivated.")}>Deactivate</Button>}
            {!d.active && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "UPDATE_DEPARTMENT", id: d.id, active: true }, "Department reactivated.")}>Reactivate</Button>}
          </article>)}
        </div>
      </section>}

      {tab === "Teams" && <section className="space-y-4">
        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "CREATE_TEAM", name: f.get("name"), description: f.get("description"), departmentId: f.get("departmentId") || null }, "Team created."); e.currentTarget.reset(); }}>
          <Field label="New team name"><input name="name" required minLength={2} maxLength={120} className={inputClass} placeholder="e.g. Verification Desk" /></Field>
          <Field label="Description"><input name="description" maxLength={500} className={inputClass} /></Field>
          <Field label="Department"><select name="departmentId" className={inputClass}><option value="">—</option>{data.departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Button type="submit" disabled={busy} className="self-end"><Plus className="mr-2 size-4" />Create</Button>
        </form>
        <div className="space-y-3">
          {data.teams.map((t) => <article key={t.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <h3 className="font-semibold">{t.name}{!t.active && <Badge variant="secondary" className="ml-2">inactive</Badge>}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.description || "No description"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.departments.find((d) => d.id === t.departmentId)?.name ?? "No department"} · {t._count.memberships} member{t._count.memberships === 1 ? "" : "s"}</p>
            </div>
            {t.active && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "UPDATE_TEAM", id: t.id, active: false }, "Team deactivated.")}>Deactivate</Button>}
            {!t.active && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "UPDATE_TEAM", id: t.id, active: true }, "Team reactivated.")}>Reactivate</Button>}
          </article>)}
        </div>
      </section>}
    </>}

    <Dialog open={addOpen} onOpenChange={(v) => { if (!v) setAddOpen(false); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>Add an existing Medic1905 administrator by email, define their title, responsibilities, reporting line and access window. The account must already hold the platform ADMIN role.</DialogDescription></DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
          try {
            await apiClient.post("/admin/team", {
              action: "ADD_MEMBER", email: f.get("email"), title: f.get("title"), responsibilities: f.get("responsibilities"),
              departmentId: f.get("departmentId") || null, teamId: f.get("teamId") || null,
              reportsToId: f.get("reportsToId") || null, endsAt: f.get("endsAt") ? new Date(String(f.get("endsAt"))).toISOString() : null,
            });
            setAddOpen(false); setNotice("Team member added. Assign roles in Roles & Permissions."); await reload();
          } catch (err) { setError(err instanceof Error ? err.message : "Could not add the member"); }
          finally { setBusy(false); }
        }}>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <Field label="Email (existing admin account)"><input name="email" type="email" required className={inputClass} placeholder="colleague@medic1905.example" /></Field>
          <Field label="Job title"><input name="title" required minLength={2} maxLength={120} className={inputClass} placeholder="e.g. User Management Officer" /></Field>
          <Field label="Department"><select name="departmentId" className={inputClass}><option value="">—</option>{data?.departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Team"><select name="teamId" className={inputClass}><option value="">—</option>{data?.teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Reports to"><select name="reportsToId" className={inputClass}><option value="">—</option>{data?.memberships.filter((m) => m.status === "ACTIVE").map((m) => <option key={m.id} value={m.id}>{m.user.name} · {m.title}</option>)}</select></Field>
          <Field label="Access expires (optional)"><input name="endsAt" type="datetime-local" className={inputClass} /></Field>
          <Field label="Responsibilities"><textarea name="responsibilities" maxLength={2000} className={inputClass} placeholder="What this member is responsible for" /></Field>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="w-full">{busy ? "Adding…" : "Add member"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(transferFor)} onOpenChange={(v) => { if (!v) setTransferFor(null); }}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Transfer responsibilities</DialogTitle>
          <DialogDescription>Move open role assignments and direct reports from {transferFor?.user.name} to another active member.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
          try {
            await apiClient.post("/admin/team", { action: "TRANSFER", fromMembershipId: transferFor!.id, toMembershipId: f.get("to"), note: f.get("note") });
            setTransferFor(null); setNotice("Responsibilities transferred."); await reload();
          } catch (err) { setError(err instanceof Error ? err.message : "Transfer failed"); }
          finally { setBusy(false); }
        }}>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Field label="Receiving member"><select name="to" required className={inputClass}>{data?.memberships.filter((m) => m.status === "ACTIVE" && m.id !== transferFor?.id).map((m) => <option key={m.id} value={m.id}>{m.user.name} · {m.title}</option>)}</select></Field>
          <Field label="Reason for the transfer"><textarea name="note" required minLength={15} maxLength={2000} className={inputClass} /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Transferring…" : "Transfer"}</Button>
        </form>
      </DialogContent>
    </Dialog>

    <p className="flex items-start gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground"><TriangleAlert className="mt-0.5 size-4 shrink-0" />Team membership never grants clinical privileges. Prescribing, approving results and signing clinical reports require separate professional verification and facility privileges.</p>
  </div>;
}
