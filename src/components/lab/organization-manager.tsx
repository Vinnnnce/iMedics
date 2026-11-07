"use client";

import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Building2, Users, Network, ShieldCheck, History, Plus, Download, RefreshCw, Search, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { PROFESSIONAL_CATEGORIES, DEPARTMENT_SUGGESTIONS } from "@/lib/organization/catalogue";
import { ASSIGNABLE_ROLES, FACILITY_PERMISSIONS } from "@/lib/facility-staff";

const permissions: readonly string[] = FACILITY_PERMISSIONS;
const roles = ASSIGNABLE_ROLES;
export type StaffRow = { id: string; fullName: string; email: string; status: string; facilityRole: string; departmentId: string | null; reportsToId: string | null; professionalTitle: string | null; customCategory: string | null; specialty: string | null; accessLevel: string; permissions: string[]; departmentIds: string[]; invitationState: string; accessExpiresAt: string | null; credentials: { id: string; type: string; authority: string; verificationStatus: string; expiryDate: string | null }[] };
type Department = { id: string; name: string; code: string | null; parentId: string | null; leadStaffId: string | null; deputyStaffId: string | null; active: boolean; openingHours: string | null; description: string | null; _count: { staff: number; services: number } };
type Position = { id: string; title: string; category: string; rank: number; parentId: string | null; departmentId: string | null; active: boolean; appointments: { id: string; kind: string; staffId: string; staff: { fullName: string; status: string }; effectiveAt: string; endsAt: string | null }[] };
export type OrganizationData = { facility: { id: string; name: string }; departments: Department[]; staff: StaffRow[]; positions: Position[]; history: { id: string; effectiveAt: string; endsAt: string | null; kind: string; reason: string; staff: { fullName: string }; position: { title: string } }[]; audit: { sequence: string; action: string; occurredAt: string; resourceId: string; hash: string }[] };

export const fieldClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
export function Field({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{title}</label>{Children.map(children, (child) => isValidElement<{ id?: string }>(child) && ["input", "select", "textarea"].includes(String(child.type)) ? cloneElement(child, { id }) : child)}</div>;
}
function label(s: string) { return s.toLowerCase().replaceAll("_", " "); }
function Empty({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>; }

export function OrganizationManager({ facilities }: { facilities: { id: string; name: string }[] }) {
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [data, setData] = useState<OrganizationData | null>(null);
  const [tab, setTab] = useState("Departments");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"department" | "invite" | "position" | "appoint" | "staff" | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState("CUSTOM");
  const [category, setCategory] = useState("Medical");
  const [privileges, setPrivileges] = useState<{ id: string; permission: string; expiresAt: string; revokedAt: string | null }[]>([]);
  const [patientGrants, setPatientGrants] = useState<{ id: string; patientId: string; scope: string; expiresAt: string | null }[]>([]);
  const url = useCallback((path: string) => `${path}${path.includes("?") ? "&" : "?"}facilityId=${encodeURIComponent(facilityId)}`, [facilityId]);
  const reload = useCallback(async () => {
    if (!facilityId) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await apiClient.get<OrganizationData>(url("/facility/organization"))); }
    catch (e) { setData(null); setError(e instanceof Error ? e.message : "Unable to load organisation"); }
    finally { setLoading(false); }
  }, [facilityId, url]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) { setData(null); setSelected(null); setPage(0); void reload(); } }); return () => { active = false; }; }, [reload]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setPrivileges([]); setPatientGrants([]); } });
    if (selected && dialog === "staff") void apiClient.get<{ privileges: typeof privileges }>(url(`/facility/staff/${selected.id}/privileges`)).then((r) => { if (active) setPrivileges(r.privileges); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load clinical privileges"); });
    if (selected && tab === "Permissions") void apiClient.get<{ staff: { patientAccessGrants: typeof patientGrants } }>(url(`/facility/staff/${selected.id}/access`)).then((r) => { if (active) setPatientGrants(r.staff.patientAccessGrants); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load patient assignments"); });
    return () => { active = false; };
  // Selection changes must never reuse another staff member's grants.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, dialog, tab, url, data]);
  const mutate = async (path: string, body: unknown, method: "post" | "patch" | "delete" = "post") => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiClient[method]<{ message?: string }>(url(path), body);
      setNotice(result.message ?? "Changes saved and audited."); setDialog(null); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Changes could not be saved"); }
    finally { setBusy(false); }
  };
  const matchingStaff = useMemo(() => (data?.staff ?? []).filter((s) => (status === "ALL" || s.status === status) && `${s.fullName} ${s.email} ${s.professionalTitle ?? ""}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.fullName.localeCompare(b.fullName)), [data, status, search]);
  const visibleStaff = matchingStaff.slice(page * 12, page * 12 + 12);
  const staffOptions = data?.staff.filter((s) => s.status === "ACTIVE") ?? [];
  const staffName = (id: string | null) => data?.staff.find((s) => s.id === id)?.fullName ?? "Unassigned";
  const deptName = (id: string | null) => data?.departments.find((d) => d.id === id)?.name ?? "Facility-wide";
  function form(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)); }
  function exportChart() {
    const rows = [["Position", "Category", "Rank", "Reports to", "Department", "Occupants"], ...(data?.positions ?? []).map((p) => [p.title, p.category, String(p.rank), data?.positions.find((r) => r.id === p.parentId)?.title ?? "", deptName(p.departmentId), p.appointments.map((a) => a.staff.fullName).join("; ")])];
    // Prevent spreadsheet formula execution in exported user-controlled text.
    const csv = rows.map((row) => row.map((v) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = objectUrl; a.download = "medic1905-organisation.csv"; a.click(); URL.revokeObjectURL(objectUrl);
  }
  return <div className="mx-auto min-w-0 max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facility administration</p><h1 className="text-xl font-bold">Workforce & organisation</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">One organisational structure. Separate clinical privileges. Access stays within the selected facility.</p></div>
      <div className="flex w-full gap-2 sm:w-auto"><label className="min-w-0 flex-1"><span className="sr-only">Selected facility</span><select className={fieldClass} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><Button variant="outline" onClick={() => void reload()} disabled={loading} aria-label="Refresh organisation"><RefreshCw className="size-4" /></Button></div>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[["Active staff", data?.staff.filter((s) => s.status === "ACTIVE").length], ["Departments", data?.departments.filter((d) => d.active).length], ["Vacant positions", data?.positions.filter((p) => p.active && !p.appointments.some((a) => a.staff.status === "ACTIVE")).length], ["Pending invitations", data?.staff.filter((s) => s.status === "INVITED").length]].map(([title, value]) => <div key={title} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-xl font-semibold tabular-nums">{loading ? "…" : value ?? "Unavailable"}</p></div>)}
    </div>
    <nav aria-label="Organisation sections" className="flex flex-wrap gap-2 border-b pb-3">{[["Departments", Building2], ["Staff", Users], ["Hierarchy", Network], ["Permissions", ShieldCheck], ["History", History]].map(([name, Icon]) => { const I = Icon as typeof Users; return <Button key={String(name)} variant={tab === name ? "default" : "ghost"} onClick={() => { setTab(String(name)); setSearch(""); setPage(0); }} aria-pressed={tab === name}><I className="mr-2 size-4" />{String(name)}</Button>; })}</nav>
    {error && <div role="alert" className="break-words rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading facility records…</div>}
    {!loading && data && <>
      {tab === "Departments" && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Departments & subdepartments</h2><Button onClick={() => { setDepartment(null); setDialog("department"); }}><Plus className="mr-2 size-4" />Create department</Button></div>
        {!data.departments.length && <Empty>Create your first department to organise services, leadership and staff.</Empty>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.departments.map((d) => <article key={d.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground">{d.code ?? "No code"} {d.parentId ? ` / ${deptName(d.parentId)}` : ""}</p><h3 className="mt-1 break-words font-semibold">{d.name}</h3></div><span className="rounded-md bg-muted px-2 py-1 text-xs">{d.active ? "Active" : "Inactive"}</span></div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-muted-foreground">Head</dt><dd className="break-words">{staffName(d.leadStaffId)}</dd><dt className="text-muted-foreground">Deputy</dt><dd className="break-words">{staffName(d.deputyStaffId)}</dd><dt className="text-muted-foreground">Hours</dt><dd>{d.openingHours ?? "Not configured"}</dd></dl>
          <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>{d._count.staff} staff · {d._count.services} services</span><Button variant="outline" onClick={() => { setDepartment(d); setDialog("department"); }}>Manage<span className="sr-only"> {d.name}</span></Button></div>
        </article>)}</div>
      </section>}
      {tab === "Staff" && <section className="space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search staff" placeholder="Search staff, email or title" className="min-h-11 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div><select aria-label="Filter staff status" className={`${fieldClass} w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{["ALL", "ACTIVE", "INVITED", "SUSPENDED", "ON_LEAVE", "TERMINATED"].map((s) => <option key={s}>{s}</option>)}</select><Button onClick={() => setDialog("invite")}><Mail className="mr-2 size-4" />Invite professional</Button></div>
        <div className="space-y-3">{visibleStaff.map((s) => <article key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
          <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{s.fullName}</h3><p className="break-all text-sm text-muted-foreground">{s.email}</p><p className="mt-2 text-xs text-muted-foreground">{s.professionalTitle ?? label(s.facilityRole)} · {deptName(s.departmentId)}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="rounded-md bg-muted px-2 py-1 text-xs">{s.status === "INVITED" ? s.invitationState : label(s.status)}</span><Button variant="outline" onClick={() => { setSelected(s); setDialog("staff"); }}>Manage<span className="sr-only"> {s.fullName}</span></Button></div>
        </article>)}</div>
        {!matchingStaff.length && <Empty>No staff match this view. Change the filters or invite a professional.</Empty>}
        <div className="flex items-center justify-between gap-3 text-sm"><span>{matchingStaff.length} records · Page {page + 1}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={(page + 1) * 12 >= matchingStaff.length} onClick={() => setPage(page + 1)}>Next</Button></div></div>
      </section>}
      {tab === "Hierarchy" && <section className="space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="text-base font-semibold">Reporting structure</h2><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportChart}><Download className="mr-2 size-4" />Export chart</Button><Button variant="outline" onClick={() => setDialog("appoint")}>Appoint staff</Button><Button onClick={() => setDialog("position")}><Plus className="mr-2 size-4" />Add position</Button></div></div>
        <p className="text-sm text-muted-foreground">Rank and appointment describe accountability. They never grant prescribing, signing or result approval rights.</p>
        {!data.positions.length && <Empty>Create an executive or departmental position, then appoint an authorised staff member.</Empty>}
        <ul className="space-y-3">{data.positions.map((p) => <li key={p.id} className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{p.category} · Rank {p.rank} · {deptName(p.departmentId)}</p><h3 className="mt-1 font-semibold">{p.title}</h3><p className="mt-1 text-sm text-muted-foreground">Reports to: {data.positions.find((r) => r.id === p.parentId)?.title ?? "Governing authority / root"}</p></div><span className="rounded-md bg-muted px-2 py-1 text-xs">{p.appointments.some((a) => a.staff.status === "ACTIVE") ? "Appointed" : "Vacant"}</span></div>
          {p.appointments.map((a) => <div key={a.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><span>{a.staff.fullName} · {label(a.kind)} · {label(a.staff.status)}</span><Button variant="outline" disabled={busy} onClick={() => void mutate("/facility/organization", { action: "END_APPOINTMENT", id: a.id, reason: "Appointment ended by facility administrator" })}>End appointment</Button></div>)}
        </li>)}</ul>
      </section>}
      {tab === "Permissions" && <section className="space-y-5">
        <div><h2 className="text-base font-semibold">Roles & permission matrix</h2><p className="mt-2 text-sm text-muted-foreground">Select a staff member to review role inheritance and save individual overrides. Regulated actions additionally require a verified credential and a separate clinical privilege.</p></div>
        <Field title="Staff member"><select className={fieldClass} value={selected?.id ?? ""} onChange={(e) => { const s = data.staff.find((r) => r.id === e.target.value) ?? null; setSelected(s); setAllowed(s?.permissions ?? []); setAccessLevel(s?.accessLevel ?? "CUSTOM"); }}><option value="">Select staff member</option>{data.staff.filter((s) => s.status !== "TERMINATED").map((s) => <option value={s.id} key={s.id}>{s.fullName} / {label(s.facilityRole)}</option>)}</select></Field>
        {selected && <form className="space-y-5" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}/access`, { accessLevel, departmentIds: f.department ? [String(f.department)] : [], accessExpiresAt: f.expiry ? new Date(String(f.expiry)).toISOString() : null, permissionOverrides: { add: allowed, remove: permissions.filter((p) => !allowed.includes(p)) } }, "patch"); }}>
          <div className="grid gap-4 sm:grid-cols-3"><Field title="Access level"><select className={fieldClass} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>{["NONE", "READ_ONLY", "LIMITED", "STANDARD", "EXTENDED", "DEPARTMENT", "FULL", "CUSTOM"].map((r) => <option key={r}>{r}</option>)}</select></Field><Field title="Department restriction"><select name="department" className={fieldClass} defaultValue={selected.departmentIds[0] ?? ""}><option value="">No department</option>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field title="Access expiry (optional)"><input name="expiry" type="datetime-local" className={fieldClass} /></Field></div>
          <fieldset disabled={selected.facilityRole === "OWNER" || accessLevel !== "CUSTOM"} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-3"><legend className="px-2 text-sm font-medium">Effective permissions / custom overrides</legend>{permissions.map((p) => <label key={p} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 shrink-0 accent-current" checked={allowed.includes(p)} onChange={(e) => setAllowed(e.target.checked ? [...allowed, p] : allowed.filter((r) => r !== p))} /><span>{label(p)}</span></label>)}</fieldset>
          <Button disabled={busy || selected.facilityRole === "OWNER"} type="submit">{busy ? "Saving…" : "Save access configuration"}</Button>
        </form>}
      </section>}
      {tab === "Permissions" && selected && <section className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">Patient assignments and revocation</h3>
        <p className="text-sm text-muted-foreground">The patient must already be linked to this facility. Patient access does not confer clinical privileges.</p>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}/access`, { action: "GRANT", patientId: f.patientId, scope: f.scope, expiresInHours: Number(f.hours), justification: f.reason }); }}>
          <Field title="Patient ID"><input name="patientId" required pattern="[0-9a-fA-F-]{36}" className={fieldClass} /></Field><Field title="Scope"><select name="scope" className={fieldClass}><option value="CARE_TEAM">Care team</option><option value="DEPARTMENT">Department assignment</option><option value="TEMPORARY">Temporary authorization</option></select></Field>
          <Field title="Temporary expiry in hours"><input name="hours" type="number" defaultValue={24} min={1} max={168} required className={fieldClass} /></Field><Field title="Authorization justification"><input name="reason" required minLength={15} maxLength={500} className={fieldClass} /></Field><Button type="submit" disabled={busy}>Assign patient access</Button>
        </form>
        {patientGrants.map((g) => <form key={g.id} className="grid gap-3 rounded-lg bg-muted p-3 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}/access`, { action: "REVOKE", patientId: g.patientId, justification: f.reason }); }}><div className="min-w-0 sm:col-span-2"><p className="break-all text-sm">{g.patientId} · {label(g.scope)}</p><p className="mt-1 text-xs text-muted-foreground">{g.expiresAt ? `Expires ${new Date(g.expiresAt).toLocaleString()}` : "No scheduled expiry"}</p></div><Field title="Revocation reason"><input name="reason" required minLength={15} className={fieldClass} /></Field><Button disabled={busy} type="submit" variant="outline" className="self-end">Revoke assignment</Button></form>)}
      </section>}
      {tab === "History" && <section className="space-y-6"><h2 className="text-base font-semibold">Appointments & tamper-evident activity</h2>
        <div className="space-y-3">{data.history.map((h) => <div key={h.id} className="rounded-xl border p-4 text-sm"><p className="font-medium">{h.staff.fullName} / {h.position.title}</p><p className="mt-1 text-muted-foreground">{label(h.kind)} · {new Date(h.effectiveAt).toLocaleDateString()} · {h.endsAt ? `Ends ${new Date(h.endsAt).toLocaleDateString()}` : "Open-ended"}</p><p className="mt-2">{h.reason}</p></div>)}</div>
        <ol className="space-y-3">{data.audit.map((a) => <li key={a.sequence} className="min-w-0 border-b pb-3 text-sm"><p className="font-medium">{label(a.action)}</p><p className="mt-1 text-xs text-muted-foreground">#{a.sequence} · {new Date(a.occurredAt).toLocaleString()}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">SHA-256 {a.hash}</p></li>)}</ol>
        {!data.audit.length && <Empty>Audited organisation changes will appear here.</Empty>}
      </section>}
    </>}
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-2xl"><DialogHeader><DialogTitle>{dialog === "department" ? department ? "Manage department" : "Create department" : dialog === "invite" ? "Invite professional" : dialog === "position" ? "Create ranked position" : dialog === "appoint" ? "Appoint staff member" : "Manage staff member"}</DialogTitle><DialogDescription>Changes apply only to the selected facility and are recorded in the audit trail.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {dialog === "department" && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate(department ? `/facility/departments/${department.id}` : "/facility/departments", { name: f.name, code: f.code || null, parentId: f.parent || null, leadStaffId: f.head || null, deputyStaffId: f.deputy || null, openingHours: f.hours || null, description: f.description || null, ...(department ? { active: f.active === "on" } : {}) }, department ? "patch" : "post"); }}>
        <Field title="Department name"><input className={fieldClass} name="name" list="department-names" required minLength={2} defaultValue={department?.name} /><datalist id="department-names">{DEPARTMENT_SUGGESTIONS.map((s) => <option key={s}>{s}</option>)}</datalist></Field>
        <Field title="Department code"><input className={fieldClass} name="code" maxLength={30} defaultValue={department?.code ?? ""} /></Field>
        <Field title="Parent department"><select className={fieldClass} name="parent" defaultValue={department?.parentId ?? ""}><option value="">Top-level department</option>{data?.departments.filter((d) => d.id !== department?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field title="Operating hours"><input className={fieldClass} name="hours" placeholder="Mon–Fri 08:00–18:00" defaultValue={department?.openingHours ?? ""} /></Field>
        {["head", "deputy"].map((name) => <Field key={name} title={name === "head" ? "Department head" : "Deputy department head"}><select className={fieldClass} name={name} defaultValue={(name === "head" ? department?.leadStaffId : department?.deputyStaffId) ?? ""}><option value="">Unassigned</option>{staffOptions.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></Field>)}
        <Field title="Description"><textarea className={fieldClass} name="description" defaultValue={department?.description ?? ""} /></Field>
        {department && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={department.active} />Department active</label>}
        <Button disabled={busy} type="submit" className="sm:col-span-2">{busy ? "Saving…" : "Save department"}</Button>
      </form>}
      {dialog === "invite" && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate("/facility/staff", { email: f.email, fullName: f.name, facilityRole: f.role, departmentId: f.department || null, customCategory: f.customCategory || category, professionalTitle: f.title, specialty: f.specialty, employmentType: f.engagement, expiryDays: Number(f.expiry) }); }}>
        <Field title="Full name"><input name="name" className={fieldClass} minLength={2} required /></Field><Field title="Professional email"><input name="email" type="email" className={fieldClass} required /></Field>
        <Field title="Professional category"><select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>{Object.keys(PROFESSIONAL_CATEGORIES).map((c) => <option key={c}>{c}</option>)}<option>Custom</option></select></Field>
        {category === "Custom" && <Field title="Custom professional category"><input required name="customCategory" maxLength={120} className={fieldClass} /></Field>}
        <Field title="Job title"><input name="title" list="professional-titles" className={fieldClass} required /><datalist id="professional-titles">{(PROFESSIONAL_CATEGORIES[category] ?? []).map((t) => <option key={t}>{t}</option>)}</datalist></Field>
        <Field title="Authorization role"><select name="role" className={fieldClass}>{roles.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></Field>
        <Field title="Department"><select name="department" className={fieldClass}><option value="">Unassigned</option>{data?.departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field title="Specialty (optional)"><input name="specialty" className={fieldClass} /></Field><Field title="Engagement type"><select name="engagement" className={fieldClass}>{["FULL_TIME", "PART_TIME", "LOCUM", "CONTRACT", "VOLUNTEER"].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field title="Invitation expiry (days)"><input name="expiry" type="number" min={1} max={30} defaultValue={7} className={fieldClass} required /></Field>
        <p className="text-xs text-muted-foreground">Existing accounts are reused on acceptance. New invitations start with assigned-patient access, not all patient records.</p>
        <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Sending…" : "Send invitation"}</Button>
      </form>}
      {dialog === "position" && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate("/facility/organization", { action: "POSITION", title: f.title, category: f.category, rank: Number(f.rank), departmentId: f.department || null, parentId: f.parent || null }); }}>
        <Field title="Position title"><input name="title" required minLength={2} className={fieldClass} /></Field><Field title="Professional category"><input name="category" list="categories" required className={fieldClass} /><datalist id="categories">{Object.keys(PROFESSIONAL_CATEGORIES).map((c) => <option key={c}>{c}</option>)}</datalist></Field>
        <Field title="Rank (lower is senior)"><input name="rank" type="number" min={0} max={999} defaultValue={10} required className={fieldClass} /></Field><Field title="Reports to position"><select name="parent" className={fieldClass}><option value="">Root / governing authority</option>{data?.positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
        <Field title="Department"><select name="department" className={fieldClass}><option value="">Facility-wide</option>{data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Button disabled={busy} type="submit" className="sm:col-span-2">Create position</Button>
      </form>}
      {dialog === "appoint" && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate("/facility/organization", { action: "APPOINT", positionId: f.position, staffId: f.staff, kind: f.kind, effectiveAt: new Date(String(f.start)).toISOString(), endsAt: f.end ? new Date(String(f.end)).toISOString() : null, reason: f.reason }); }}>
        <Field title="Position"><select name="position" required className={fieldClass}><option value="">Select position</option>{data?.positions.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field><Field title="Staff member"><select name="staff" required className={fieldClass}><option value="">Select staff</option>{staffOptions.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></Field>
        <Field title="Appointment type"><select name="kind" className={fieldClass}>{["SUBSTANTIVE", "ACTING", "DEPUTY"].map((r) => <option key={r}>{r}</option>)}</select></Field><Field title="Effective date"><input type="datetime-local" name="start" required className={fieldClass} /></Field><Field title="End date (optional)"><input type="datetime-local" name="end" className={fieldClass} /></Field><Field title="Appointment reason"><textarea name="reason" minLength={15} required className={fieldClass} /></Field>
        <Button disabled={busy} type="submit" className="sm:col-span-2">Record appointment</Button>
      </form>}
      {dialog === "staff" && selected && <div className="space-y-5"><p className="font-semibold">{selected.fullName}<span className="mt-1 block break-all text-sm font-normal text-muted-foreground">{selected.email}</span></p>
        {selected.status === "INVITED" ? <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void mutate(`/facility/staff/${selected.id}`, { resendInvite: true }, "patch")}>Resend invitation</Button><Button variant="outline" disabled={busy} onClick={() => void mutate(`/facility/staff/${selected.id}`, { cancelInvite: true }, "patch")}>Cancel invitation</Button></div> : <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}`, { departmentId: f.department || null, reportsToId: f.manager || null, professionalTitle: f.title, ...(selected.facilityRole !== "OWNER" ? { facilityRole: f.role, status: f.status } : {}) }, "patch"); }}>
          <Field title="Job title"><input name="title" defaultValue={selected.professionalTitle ?? ""} className={fieldClass} /></Field><Field title="Status"><select name="status" defaultValue={selected.status} disabled={selected.facilityRole === "OWNER"} className={fieldClass}>{["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"].map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field title="Authorization role (independent of rank)"><select name="role" defaultValue={selected.facilityRole} disabled={selected.facilityRole === "OWNER"} className={fieldClass}>{(selected.facilityRole === "OWNER" ? ["OWNER"] : roles).map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></Field>
          <Field title="Department"><select name="department" defaultValue={selected.departmentId ?? ""} className={fieldClass}><option value="">Unassigned</option>{data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field title="Reporting manager"><select name="manager" defaultValue={selected.reportsToId ?? ""} className={fieldClass}><option value="">No reporting manager</option>{staffOptions.filter((s) => s.id !== selected.id).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></Field>
          <Button disabled={busy || selected.facilityRole === "OWNER"} type="submit" className="sm:col-span-2">Save staff changes</Button>
        </form>}
        <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Professional credentials</h3>{selected.credentials.length ? selected.credentials.map((c) => <div key={c.id} className="rounded-lg bg-muted p-3 text-sm">{label(c.type)} · {label(c.verificationStatus)}<p className="mt-1 text-xs text-muted-foreground">{c.authority} · {c.expiryDate ? `Expires ${new Date(c.expiryDate).toLocaleDateString()}` : "Expiry not recorded"}</p></div>) : <p className="text-sm text-muted-foreground">No credentials recorded. Add and review credentials in the facility credential centre before granting clinical privileges.</p>}</div>
        <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}/privileges`, { credentialId: f.credential, permission: f.permission, expiresAt: new Date(String(f.expiry)).toISOString(), reason: f.reason, confirmation: f.confirmation }); }}>
          <h3 className="text-sm font-semibold sm:col-span-2">Grant a separately verified clinical privilege</h3>
          <p className="text-xs text-muted-foreground sm:col-span-2">Only the accountable facility owner can grant a privilege. A verified credential must remain valid for the entire grant period. Job title and appointment do not confer this permission.</p>
          <Field title="Verified credential"><select name="credential" required className={fieldClass}><option value="">Select credential</option>{selected.credentials.filter((c) => c.verificationStatus === "VERIFIED").map((c) => <option key={c.id} value={c.id}>{label(c.type)} · {c.authority}</option>)}</select></Field>
          <Field title="Clinical action"><select name="permission" required className={fieldClass}>{["VERIFY_RESULTS", "RELEASE_RESULTS", "REVIEW_DOCUMENTS", "SIGN_DOCUMENTS", "APPROVE_DOCUMENTS", "ORDER_MEDICATIONS", "REVIEW_MEDICATIONS", "ADMINISTER_MEDICATIONS"].map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
          <Field title="Privilege expiry"><input type="datetime-local" required name="expiry" className={fieldClass} /></Field><Field title="Authorization reason"><input name="reason" minLength={15} required className={fieldClass} /></Field>
          <Field title="Type GRANT CLINICAL PRIVILEGE"><input name="confirmation" pattern="GRANT CLINICAL PRIVILEGE" required autoComplete="off" className={fieldClass} /></Field><Button disabled={busy} type="submit" className="self-end">Grant privilege</Button>
        </form>
        <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Clinical privilege history</h3>{!privileges.length && <p className="text-sm text-muted-foreground">No separately authorized clinical privileges.</p>}
          {privileges.map((p) => <div key={p.id} className="space-y-3 rounded-lg border p-3"><p className="text-sm">{label(p.permission)} · {p.revokedAt ? "Revoked" : new Date(p.expiresAt) <= new Date() ? "Expired" : "Current"}<span className="mt-1 block text-xs text-muted-foreground">Expires {new Date(p.expiresAt).toLocaleString()}</span></p>{!p.revokedAt && <form className="flex flex-wrap gap-3" onSubmit={(e) => { const f = form(e); void mutate(`/facility/staff/${selected.id}/privileges`, { id: p.id, reason: f.reason }, "delete"); }}><Field title="Revocation reason"><input name="reason" required minLength={15} className={fieldClass} /></Field><Button disabled={busy} variant="outline" type="submit" className="self-end">Revoke clinical privilege</Button></form>}</div>)}
        </section>
      </div>}
    </DialogContent></Dialog>
  </div>;
}
