"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { KeyRound, Plus, RefreshCw, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { ADMIN_SECTIONS, SECTION_VERBS, type AdminSection } from "@/lib/superadmin/permissions";

type Role = { id: string; key: string; name: string; description: string; departmentId: string | null; system: boolean; active: boolean; department?: { name: string } | null; permissions: string[]; _count?: { assignments?: number } };
type Assignment = { id: string; reason: string; expiresAt: string | null; createdAt: string; user: { id: string; name: string; email: string }; role: { id: string; key: string; name: string }; assignedBy: { name: string } };
type Override = { id: string; permissionKey: string; effect: string; reason: string; expiresAt: string | null; createdAt: string; user: { name: string; email: string }; createdBy: { name: string } };
type RolesData = { roles: Role[]; assignments: Assignment[]; overrides: Override[] };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
function human(s: string) { return s.toLowerCase().replaceAll("_", " "); }

export function RoleBuilder() {
  const [data, setData] = useState<RolesData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"Roles" | "Assignments" | "Overrides">("Roles");
  const [editor, setEditor] = useState<Role | "new" | null>(null);
  const editing = editor !== null && editor !== "new" ? editor : null;
  const [assignFor, setAssignFor] = useState<Role | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<RolesData>("/admin/roles")); }
    catch (e) { setError(e instanceof Error ? e.message : "Role data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await apiClient.post("/admin/roles", payload); setNotice(message); await reload(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); return false; }
    finally { setBusy(false); }
  };

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><KeyRound className="size-4" />Access & Permission Control</p>
        <h1 className="text-xl font-bold">Roles & Permissions</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create unlimited configurable roles. Each module carries independently configurable permissions — a support officer can view a facility account without ever seeing its patients&#39; medical records.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
        <Button onClick={() => setEditor("new")}><Plus className="mr-2 size-4" />Create role</Button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading roles…</div>}
    {data && <>
      <nav aria-label="Role sections" className="flex flex-wrap gap-2 border-b pb-3">
        {(["Roles", "Assignments", "Overrides"] as const).map((t) => <Button key={t} variant={tab === t ? "default" : "ghost"} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</Button>)}
      </nav>

      {tab === "Roles" && <section className="space-y-3">
        {data.roles.map((r) => <article key={r.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{r.name}</h3>
              <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "active" : "inactive"}</Badge>
              {r.system && <Badge variant="outline">system</Badge>}
              <span className="font-mono text-xs text-muted-foreground">{r.key}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.description || "No description"}</p>
            <p className="mt-2 text-xs text-muted-foreground">{r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"} · {r.department?.name ?? "No department"}{r._count?.assignments !== undefined ? ` · ${r._count.assignments} active assignment${r._count.assignments === 1 ? "" : "s"}` : ""}</p>
            <p className="mt-2 flex flex-wrap gap-1">{r.permissions.slice(0, 12).map((p) => <span key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{p}</span>)}
              {r.permissions.length > 12 && <span className="text-[10px] text-muted-foreground">+{r.permissions.length - 12} more</span>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditor(r)}><Pencil className="mr-1.5 size-3.5" />Edit</Button>
            <Button variant="outline" size="sm" onClick={() => setAssignFor(r)}><UserPlus className="mr-1.5 size-3.5" />Assign</Button>
            {!r.system && <Button variant="outline" size="sm" disabled={busy || (r._count?.assignments ?? 0) > 0} title={(r._count?.assignments ?? 0) > 0 ? "Revoke assignments first" : undefined} onClick={() => void act({ action: "DELETE_ROLE", id: r.id }, "Role deleted.")}><Trash2 className="mr-1.5 size-3.5" />Delete</Button>}
          </div>
        </article>)}
      </section>}

      {tab === "Assignments" && <section className="space-y-3">
        {data.assignments.map((a) => <article key={a.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">{a.user.name} <span className="font-normal text-muted-foreground">· {a.user.email}</span></p>
            <p className="mt-1 text-muted-foreground">{a.role.name} · assigned by {a.assignedBy.name} · {new Date(a.createdAt).toLocaleDateString()}{a.expiresAt ? ` · expires ${new Date(a.expiresAt).toLocaleDateString()}` : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "REVOKE_ROLE", assignmentId: a.id, reason: "Revoked from the Roles & Permissions console." }, "Role assignment revoked. Access changes take effect immediately.")}>Revoke</Button>
        </article>)}
        {!data.assignments.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No active role assignments. Assign a role from the Roles tab.</p>}
      </section>}

      {tab === "Overrides" && <section className="space-y-4">
        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "CREATE_OVERRIDE", userId: f.get("userId"), permissionKey: f.get("permissionKey"), effect: f.get("effect"), reason: f.get("reason"), expiresAt: null }, "Override recorded."); e.currentTarget.reset(); }}>
          <Field label="User ID (UUID)"><input name="userId" required pattern="[0-9a-f-]{36}" className={inputClass} /></Field>
          <Field label="Permission key"><input name="permissionKey" required pattern="[A-Z_]+:[A-Z_]+" className={inputClass} placeholder="USERS:VIEW" /></Field>
          <Field label="Effect"><select name="effect" className={inputClass}><option value="GRANT">GRANT</option><option value="DENY">DENY</option></select></Field>
          <Field label="Reason"><input name="reason" required minLength={15} className={inputClass} /></Field>
          <Button type="submit" disabled={busy} className="self-end">Record override</Button>
        </form>
        <div className="space-y-3">
          {data.overrides.map((o) => <article key={o.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{o.user.name} <Badge variant={o.effect === "DENY" ? "destructive" : "default"} className="ml-1">{o.effect}</Badge></p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{o.permissionKey} · by {o.createdBy.name} · {new Date(o.createdAt).toLocaleDateString()}{o.expiresAt ? ` · expires ${new Date(o.expiresAt).toLocaleDateString()}` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">{o.reason}</p>
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: "DELETE_OVERRIDE", id: o.id, reason: "Removed from the Roles & Permissions console." }, "Override removed.")}><X className="mr-1.5 size-3.5" />Remove</Button>
          </article>)}
          {!data.overrides.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No permission overrides. Overrides are approved exceptions on top of role permissions; DENY always wins.</p>}
        </div>
      </section>}
    </>}

    <Dialog open={editor !== null} onOpenChange={(v) => { if (!v) setEditor(null); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit role: ${editing.name}` : "Create a custom role"}</DialogTitle>
          <DialogDescription>Pick exactly what this role may do. Permissions combine additively across a user&#39;s roles; a DENY override always wins. Roles never confer clinical privileges.</DialogDescription>
        </DialogHeader>
        <RoleEditor existing={editing} busy={busy} error={error} onSave={async (payload) => {
          const ok = editing
            ? await act({ action: "UPDATE_ROLE", id: editing.id, ...payload }, "Role updated. Permission changes take effect immediately.")
            : await act({ action: "CREATE_ROLE", ...payload }, "Role created.");
          if (ok) setEditor(null);
        }} />
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(assignFor)} onOpenChange={(v) => { if (!v) setAssignFor(null); }}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Assign role: {assignFor?.name}</DialogTitle>
          <DialogDescription>Privileged roles additionally require Super Admin action or an approved ASSIGN_PRIVILEGED_ROLE request.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
          try {
            await apiClient.post("/admin/roles", { action: "ASSIGN_ROLE", userId: f.get("userId"), roleId: assignFor!.id, reason: f.get("reason"), expiresAt: f.get("expiresAt") ? new Date(String(f.get("expiresAt"))).toISOString() : null });
            setAssignFor(null); setNotice("Role assigned. Access changes take effect immediately."); await reload();
          } catch (err) { setError(err instanceof Error ? err.message : "Assignment failed"); }
          finally { setBusy(false); }
        }}>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Field label="User ID (UUID)"><input name="userId" required pattern="[0-9a-f-]{36}" className={inputClass} /></Field>
          <Field label="Reason"><textarea name="reason" required minLength={15} maxLength={2000} className={inputClass} /></Field>
          <Field label="Assignment expires (optional)"><input name="expiresAt" type="datetime-local" className={inputClass} /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Assigning…" : "Assign role"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function RoleEditor({ existing, busy, error, onSave }: {
  existing: Role | null; busy: boolean; error: string;
  onSave: (payload: { key?: string; name: string; description: string; departmentId: string | null; permissions: string[]; active?: boolean }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(existing?.permissions ?? []));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleSection = (section: AdminSection, on: boolean) => setSelected((s) => {
    const n = new Set(s);
    SECTION_VERBS[section].forEach((v) => n.delete(`${section}:${v}`));
    if (on) SECTION_VERBS[section].forEach((v) => n.add(`${section}:${v}`));
    return n;
  });
  return <form className="grid gap-4" onSubmit={(e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void onSave({
      ...(existing ? {} : { key: String(f.get("key") ?? "").toUpperCase() }),
      name: String(f.get("name") ?? ""), description: String(f.get("description") ?? ""),
      departmentId: String(f.get("departmentId") || "") || null,
      permissions: [...selected],
      ...(existing ? { active: f.get("active") === "on" } : {}),
    });
  }}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {!existing && <Field label="Role key (unique, e.g. NIGHT_DESK_OFFICER)"><input name="key" required pattern="[A-Z][A-Z0-9_]{1,60}" className={inputClass} /></Field>}
      <Field label="Role name"><input name="name" required minLength={2} maxLength={120} className={inputClass} defaultValue={existing?.name} /></Field>
      <Field label="Description"><input name="description" maxLength={1000} className={inputClass} defaultValue={existing?.description} /></Field>
      {existing && <Field label="Active"><label className="flex min-h-11 items-center gap-2 text-sm font-normal"><input type="checkbox" name="active" defaultChecked={existing.active} /> Role is active</label></Field>}
    </div>
    <fieldset className="space-y-2 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">Permissions per module</legend>
      <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
        {ADMIN_SECTIONS.map((section) => {
          const verbs = SECTION_VERBS[section];
          const allOn = verbs.every((v) => selected.has(`${section}:${v}`));
          return <div key={section} className="rounded-lg border p-2">
            <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={allOn} onChange={(e) => toggleSection(section, e.target.checked)} /> {human(section)}
              <span className="ml-auto text-xs font-normal text-muted-foreground">{verbs.filter((v) => selected.has(`${section}:${v}`)).length}/{verbs.length}</span>
            </label>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-6">
              {verbs.map((verb) => <label key={verb} className="flex min-h-8 items-center gap-1.5 text-xs">
                <input type="checkbox" checked={selected.has(`${section}:${verb}`)} onChange={() => toggle(`${section}:${verb}`)} /> {human(verb)}
              </label>)}
            </div>
          </div>;
        })}
      </div>
    </fieldset>
    <Button type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : "Create role"}</Button>
  </form>;
}
