"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

export interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  facilityRole: string;
  status: string;
  accessLevel: string;
  customCategory: string | null;
  department: { name: string } | null;
  branch: { name: string } | null;
  publicProfileVisible: boolean;
  profileConsent: boolean;
  bookingEligible: boolean;
  professionalTitle: string | null;
  specialty: string | null;
  userId: string | null;
  acceptedAt: string | null;
  lastLoginAt: string | null;
  credentials: { id: string; type: string; expiryDate: string | null; verificationStatus: string }[];
}

interface Option { id: string; name: string }

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner / Administrator", FACILITY_MANAGER: "Facility manager", DOCTOR: "Doctor",
  LAB_SCIENTIST: "Laboratory scientist", LAB_TECHNICIAN: "Lab technician", LAB_ASSISTANT: "Lab assistant",
  PHLEBOTOMIST: "Phlebotomist", NURSE: "Nurse", RADIOGRAPHER: "Radiographer / Sonographer",
  RECEPTIONIST: "Receptionist", ACCOUNTANT: "Accountant", COMPLIANCE_OFFICER: "Compliance officer",
};
const STATUS_LABEL: Record<string, string> = { INVITED: "Invited", ACTIVE: "Active", SUSPENDED: "Suspended", ON_LEAVE: "On leave" };
const ROLES = ["FACILITY_MANAGER", "DOCTOR", "LAB_SCIENTIST", "LAB_TECHNICIAN", "LAB_ASSISTANT", "PHLEBOTOMIST", "NURSE", "RADIOGRAPHER", "RADIOLOGIST", "DIAGNOSTIC_SPECIALIST", "PHARMACIST", "SURGEON", "DEPARTMENT_HEAD", "RECEPTIONIST", "ACCOUNTANT", "BILLING_OFFICER", "INSURANCE_OFFICER", "MEDICAL_RECORDS_OFFICER", "COMPLIANCE_OFFICER"];
const ROLE_LABELS_EXTRA: Record<string, string> = {
  RADIOLOGIST: "Radiologist", DIAGNOSTIC_SPECIALIST: "Diagnostic specialist", PHARMACIST: "Pharmacist",
  SURGEON: "Surgeon", DEPARTMENT_HEAD: "Department head", BILLING_OFFICER: "Billing officer",
  INSURANCE_OFFICER: "Insurance officer", MEDICAL_RECORDS_OFFICER: "Medical records officer",
};
const ACCESS_LEVELS: { value: string; label: string; hint: string }[] = [
  { value: "NONE", label: "No access", hint: "no facility access" },
  { value: "READ_ONLY", label: "Read only", hint: "authorized view operations only" },
  { value: "LIMITED", label: "Limited", hint: "only patients explicitly assigned below" },
  { value: "STANDARD", label: "Standard", hint: "role defaults (care-relationship based)" },
  { value: "EXTENDED", label: "Extended", hint: "standard plus assigned departments" },
  { value: "DEPARTMENT", label: "Department", hint: "assigned departments only" },
  { value: "FULL", label: "Full facility", hint: "all patients with a care relationship here" },
  { value: "CUSTOM", label: "Custom", hint: "role defaults plus permission overrides" },
];
const STATUSES = ["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"];
const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Per-staff access control: level, custom category, patient grants, break-glass audit. */
function StaffAccessControl({ staffId, accessLevel, customCategory, canManageStaff, apiBase }: {
  staffId: string;
  accessLevel: string;
  customCategory: string | null;
  canManageStaff: boolean;
  apiBase: { patch: (url: string, body: Record<string, unknown>) => Promise<unknown>; get: (url: string) => Promise<unknown>; post: (url: string, body: Record<string, unknown>) => Promise<unknown>; refresh: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<{ id: string; patientId: string; scope: string; expiresAt: string | null }[] | null>(null);
  const [error, setError] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [scope, setScope] = useState("CARE_TEAM");
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState("");

  const loadGrants = async () => {
    try {
      const data = await apiBase.get(`/facility/staff/${staffId}/access`) as { staff?: { patientAccessGrants?: typeof grants } };
      setGrants(data.staff?.patientAccessGrants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const setAccessLevel = async (level: string) => {
    setError(""); setMessage("");
    try {
      await apiBase.patch(`/facility/staff/${staffId}/access`, { accessLevel: level });
      apiBase.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const setCustomCategory = async (category: string) => {
    setError("");
    try {
      await apiBase.patch(`/facility/staff/${staffId}/access`, { customCategory: category || null });
      apiBase.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMessage("");
    try {
      if (justification.trim().length < 15) throw new Error("Enter an access-change justification of at least 15 characters.");
      const lookup = await apiBase.get(`/facility/patients?n=${encodeURIComponent(caseNumber.trim().toUpperCase())}`) as { patient?: { id: string; firstName: string; lastName: string } };
      if (!lookup.patient) throw new Error("No patient matches that case number");
      await apiBase.post(`/facility/staff/${staffId}/access`, { action: "GRANT", patientId: lookup.patient.id, scope, justification: justification.trim() });
      setMessage(`Access granted to ${lookup.patient.firstName} ${lookup.patient.lastName}.`);
      setCaseNumber("");
      setJustification("");
      await loadGrants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const revoke = async (patientId: string) => {
    setError(""); setMessage("");
    try {
      if (justification.trim().length < 15) throw new Error("Enter an access-change justification of at least 15 characters.");
      await apiBase.post(`/facility/staff/${staffId}/access`, { action: "REVOKE", patientId, justification: justification.trim() });
      setMessage("Access revoked.");
      setJustification("");
      await loadGrants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!canManageStaff) return null;

  return (
    <div className="border-t pt-3">
      <button type="button" className="text-sm font-medium text-muted-foreground" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && grants === null) void loadGrants(); }} data-testid={`button-access-${staffId}`}>
        {open ? "Hide" : "Show"} access control
      </button>
      {open && (
        <div className="mt-3 space-y-3" data-testid={`section-access-${staffId}`}>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`access-${staffId}`}>Patient access level</Label>
              <select id={`access-${staffId}`} className={select} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
                {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label} — {a.hint}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`category-${staffId}`}>Custom staff category</Label>
              <Input id={`category-${staffId}`} maxLength={120} placeholder="e.g. Sonographer" defaultValue={customCategory ?? ""} onBlur={(e) => e.target.value !== (customCategory ?? "") && setCustomCategory(e.target.value)} />
            </div>
          </div>
          <form onSubmit={grant} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`grant-case-${staffId}`}>Assign patient by case number</Label>
              <Input id={`grant-case-${staffId}`} required minLength={6} maxLength={30} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="Case number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`grant-scope-${staffId}`}>Scope</Label>
              <select id={`grant-scope-${staffId}`} className={select} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="CARE_TEAM">Care team (no expiry)</option>
                <option value="DEPARTMENT">Department</option>
                <option value="TEMPORARY">Temporary (24h)</option>
              </select>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor={`grant-reason-${staffId}`}>Grant or revocation justification</Label>
              <Input id={`grant-reason-${staffId}`} required minLength={15} maxLength={500} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Reason for this access change" />
            </div>
            <Button type="submit" variant="outline">Grant access</Button>
          </form>
          {grants === null ? <p className="text-xs text-muted-foreground">Loading assigned patients…</p> : grants.length === 0 ? (
            <p className="text-xs text-muted-foreground">No patients assigned directly. Access depends on the level above.</p>
          ) : (
            <ul className="space-y-1 text-xs" data-testid={`list-grants-${staffId}`}>
              {grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded-lg border px-2 py-1">
                  <span>{g.patientId.slice(0, 8)} · {g.scope}{g.expiresAt ? ` · expires ${new Date(g.expiresAt).toLocaleString()}` : ""}</span>
                  <button type="button" className="text-destructive hover:underline" onClick={() => revoke(g.patientId)}>Revoke</button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            A staff account alone never grants access to every patient. LIMITED staff reach only the patients assigned here;
            every assignment and revocation is audited.
            Enter a fresh justification above before granting or revoking access.
          </p>
        </div>
      )}
    </div>
  );
}

/** Break-glass audit panel: every emergency access grant with justification. */
export function BreakGlassPanel({ apiBase }: { apiBase: { get: (url: string) => Promise<unknown> } }) {
  const [grants, setGrants] = useState<{
    id: string; justification: string; grantedAt: string; expiresAt: string; closedAt: string | null;
    staff: { fullName: string } | null; patient: { caseNumber: string; firstName: string; lastName: string } | null;
  }[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiBase.get("/facility/break-glass") as { grants?: typeof grants };
        setGrants(data.grants ?? []);
      } catch {
        setGrants([]);
      }
    };
    void load();
  }, [apiBase]);

  return (
    <Card className="beeline-card">
      <CardHeader><CardTitle className="text-base">Emergency (break-glass) access audit</CardTitle></CardHeader>
      <CardContent>
        {grants === null ? <p className="text-sm text-muted-foreground">Loading…</p> : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No break-glass access has been granted at this facility.</p>
        ) : (
          <ul className="space-y-2 text-xs" data-testid="list-breakglass">
            {grants.map((g) => (
              <li key={g.id} className="rounded-lg border p-2">
                <div className="font-medium">
                  {g.staff?.fullName ?? "Staff member"} → {g.patient?.firstName ?? ""} {g.patient?.lastName ?? ""} ({g.patient?.caseNumber ?? ""})
                </div>
                <div className="text-muted-foreground">{g.justification}</div>
                <div className="text-muted-foreground">
                  Granted {new Date(g.grantedAt).toLocaleString()} · expires {new Date(g.expiresAt).toLocaleString()}
                  {g.closedAt ? ` · closed ${new Date(g.closedAt).toLocaleString()}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Invite, assign roles, suspend and publish staff. */
export function StaffManager({ staff, departments, branches, canManageStaff }: { staff: StaffRow[]; departments: Option[]; branches: Option[]; canManageStaff: boolean }) {
  const router = useRouter();
  const apiBase = {
    get: (url: string) => apiClient.get(url),
    post: (url: string, body: Record<string, unknown>) => apiClient.post(url, body),
    patch: (url: string, body: Record<string, unknown>) => apiClient.patch(url, body),
    refresh: () => router.refresh(),
  };
  const [form, setForm] = useState({ email: "", fullName: "", facilityRole: "LAB_SCIENTIST", departmentId: "", branchId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setBusy(true);
    try {
      const res = await apiClient.post<{ message: string }>("/facility/staff", {
        email: form.email, fullName: form.fullName, facilityRole: form.facilityRole,
        departmentId: form.departmentId || null, branchId: form.branchId || null,
      });
      setSuccess(res.message);
      setForm({ email: "", fullName: "", facilityRole: "LAB_SCIENTIST", departmentId: "", branchId: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invitation");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      await apiClient.patch(`/facility/staff/${id}`, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-600">{success}</p>}

      {canManageStaff && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Add staff member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={invite} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="staff-name">Full name</Label>
                  <Input id="staff-name" required maxLength={120} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="staff-email">Work email</Label>
                  <Input id="staff-email" type="email" required maxLength={120} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="staff-role">Role</Label>
                  <select id="staff-role" className={select} value={form.facilityRole} onChange={(e) => setForm((f) => ({ ...f, facilityRole: e.target.value }))}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? ROLE_LABELS_EXTRA[r] ?? r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="staff-department">Department (optional)</Label>
                  <select id="staff-department" className={select} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">—</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="staff-branch">Branch (optional)</Label>
                  <select id="staff-branch" className={select} value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                    <option value="">—</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The staff member receives a single-use invitation link to this email. They sign in with their own
                account and password — Medic1905 never sets passwords on their behalf.
              </p>
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {staff.length === 0 && <p className="text-sm text-muted-foreground">No staff yet. Invite your first team member above.</p>}

      {staff.map((s) => (
        <Card key={s.id} className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{s.fullName}</p>
                <p className="text-xs text-muted-foreground">{s.email}{s.department ? ` · ${s.department.name}` : ""}{s.branch ? ` · ${s.branch.name}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-lg text-xs">{ROLE_LABEL[s.facilityRole] ?? s.facilityRole}</Badge>
                <Badge variant={s.status === "ACTIVE" ? "default" : s.status === "INVITED" ? "outline" : "destructive"} className="rounded-lg text-xs">{STATUS_LABEL[s.status] ?? s.status}</Badge>
                {s.profileConsent && s.publicProfileVisible && <Badge variant="outline" className="rounded-lg text-xs">Public profile</Badge>}
              </div>
            </div>

            {canManageStaff && s.facilityRole !== "OWNER" && (
              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <div className="space-y-1">
                  <Label htmlFor={`role-${s.id}`}>Role</Label>
                  <select id={`role-${s.id}`} className={select} value={s.facilityRole} onChange={(e) => patch(s.id, { facilityRole: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? ROLE_LABELS_EXTRA[r] ?? r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`status-${s.id}`}>Status</Label>
                  <select id={`status-${s.id}`} className={select} value={s.status} onChange={(e) => patch(s.id, { status: e.target.value })}>
                    {STATUSES.map((st) => <option key={st} value={st}>{st === "TERMINATED" ? "Terminate" : STATUS_LABEL[st]}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.publicProfileVisible} onChange={(e) => patch(s.id, { publicProfileVisible: e.target.checked })} className="h-4 w-4" />
                  Show in public directory
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.bookingEligible} onChange={(e) => patch(s.id, { bookingEligible: e.target.checked })} className="h-4 w-4" />
                  Bookable by patients
                </label>
              </div>
            )}

            {s.facilityRole !== "OWNER" && (
              <StaffAccessControl staffId={s.id} accessLevel={s.accessLevel} customCategory={s.customCategory} canManageStaff={canManageStaff} apiBase={apiBase} />
            )}

            {s.facilityRole === "OWNER" && (
              <p className="text-xs text-muted-foreground">The owner role is managed by Medic1905.</p>
            )}

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <p>Directory consent: {s.profileConsent ? "given" : "not given"}</p>
              <p>Account: {s.userId ? "linked" : "not linked yet"}</p>
              <p>Last active: {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : "—"}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
