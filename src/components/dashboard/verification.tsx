"use client";

import { useEffect, useState } from "react";

interface DoctorRow {
  userId: string;
  name: string;
  specialty: string | null;
  verificationStatus: string;
  identityVerification: string | null;
  licenseVerification: string | null;
  qualificationVerification: string | null;
}

const DIMENSIONS = [
  { key: "identityVerification", label: "Identity" },
  { key: "licenseVerification", label: "Licence" },
  { key: "qualificationVerification", label: "Qualifications" },
] as const;

const field = "bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none";

/**
 * Admin-side per-doctor verification: identity, licence and qualification decisions are recorded
 * separately from the account-level verified flag. Documents and audit history stay private.
 */
export function AdminVerification() {
  const [doctors, setDoctors] = useState<DoctorRow[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/doctors/verification")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load doctors");
        return res.json();
      })
      .then((data: { doctors: DoctorRow[] }) => {
        if (!cancelled) setDoctors(data.doctors);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load doctors");
          setDoctors([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (userId: string, dimension: string, status: string) => {
    setSaving(userId + dimension);
    setError("");
    try {
      const res = await fetch("/api/admin/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, [dimension]: status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to record the decision");
      setDoctors((prev) => (prev ? prev.map((d) => (d.userId === userId ? { ...d, [dimension]: status } : d)) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the decision");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="stat-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Doctor verification</h3>
        <p className="text-sm text-muted-foreground">
          Record identity, licence and qualification decisions separately. Evidence documents and the audit
          history remain admin-only; the doctor is notified of each decision.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {doctors === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {doctors?.length === 0 && <p className="text-sm text-muted-foreground">No doctors on the platform yet.</p>}
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Account</th>
              <th>Identity</th>
              <th>Licence</th>
              <th>Qualifications</th>
            </tr>
          </thead>
          <tbody>
            {doctors?.map((doctor) => (
              <tr key={doctor.userId}>
                <td>
                  <p className="text-sm font-medium">{doctor.name}</p>
                  <p className="text-xs text-muted-foreground">{doctor.specialty ?? "—"}</p>
                </td>
                <td>
                  <span className={`status-badge ${doctor.verificationStatus === "VERIFIED" ? "bg-muted text-foreground" : "bg-foreground/10 text-warning"}`}>
                    {doctor.verificationStatus}
                  </span>
                </td>
                {DIMENSIONS.map((dimension) => (
                  <td key={dimension.key}>
                    <select
                      className={field}
                      value={doctor[dimension.key] ?? ""}
                      disabled={saving === doctor.userId + dimension.key}
                      onChange={(e) => save(doctor.userId, dimension.key, e.target.value)}
                      data-testid={`select-${dimension.key}-${doctor.userId}`}
                    >
                      <option value="">Not assessed</option>
                      <option value="PENDING">Pending</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
