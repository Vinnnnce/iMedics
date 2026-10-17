"use client";

import { useState } from "react";
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
const ROLES = ["FACILITY_MANAGER", "DOCTOR", "LAB_SCIENTIST", "LAB_TECHNICIAN", "LAB_ASSISTANT", "PHLEBOTOMIST", "NURSE", "RADIOGRAPHER", "RECEPTIONIST", "ACCOUNTANT", "COMPLIANCE_OFFICER"];
const STATUSES = ["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"];
const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Invite, assign roles, suspend and publish staff. */
export function StaffManager({ staff, departments, branches, canManageStaff }: { staff: StaffRow[]; departments: Option[]; branches: Option[]; canManageStaff: boolean }) {
  const router = useRouter();
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
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
