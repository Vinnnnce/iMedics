"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel, apiClient, useDashboardMutation } from "./common";
import type { WorkspaceRole } from "@/lib/workspace/types";
const destination = { PATIENT: "/doctors", DOCTOR: "/doctor/consultations", LAB_SCIENTIST: "/lab/bookings", ADMIN: "/admin/dashboard#care-workspace" };
export function EngagementPanel({ ready, role }: { ready: boolean; role: WorkspaceRole }) {
  const mutation = useDashboardMutation();
  const [enabled, setEnabled] = useState(false), [variants, setVariants] = useState({ home: "A", dashboard: "A" });
  const [report, setReport] = useState<{ experiment: string; variant: string; event: string; accounts: number }[]>([]);
  return <Panel title="Your next action">
    <p className="text-sm text-muted-foreground">{role === "PATIENT" ? variants.dashboard === "B" ? "Start with a booking, then prepare your intake." : "Review your care tasks and book a visit when you are ready." : "Review your operational queue and choose the next action."}</p>
    <Link className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={destination[role]} onClick={() => {
      if (enabled) void Promise.all(["homepage-cta", "dashboard-engagement"].map(experiment => apiClient.post("/workspace/experiments", { experiment, event: "engagement", consent: true }))).catch(() => undefined);
    }}>{role === "PATIENT" ? variants.home === "B" ? "Choose your next appointment" : "Find a doctor" : role === "DOCTOR" ? "Open consultations" : role === "LAB_SCIENTIST" ? "Open booking queue" : "Review operations"}</Link>
    <p className="text-xs text-muted-foreground">Optional first-party A/B testing on the signed-in home/dashboard only. No clinical content or third-party tracker.</p>{mutation.errorUI}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!ready || mutation.busy} onChange={event => {
      const checked = event.target.checked;
      void mutation.run(async () => {
        if (checked) {
          const [home, dashboard] = await Promise.all(["homepage-cta", "dashboard-engagement"].map(experiment => apiClient.post<{ variant: string }>("/workspace/experiments", { experiment, event: "exposure", consent: true })));
          setVariants({ home: home.variant, dashboard: dashboard.variant }); setEnabled(true);
        } else { await apiClient.delete("/workspace/experiments", { confirm: true }); setEnabled(false); setVariants({ home: "A", dashboard: "A" }); }
      }, checked ? "Optional measurement enabled" : "Measurement disabled and prior events deleted");
    }} />I opt in to measuring these CTA variants and engagement. Unchecking deletes my experiment events.</label>
    <p className="text-xs text-muted-foreground">One event per account, experiment, and UTC day. Booking-request conversions are server-recorded only after opt-in, not paid conversions or treatment outcomes.</p>
    {role === "ADMIN" && <>
      <Button variant="outline" disabled={!ready || mutation.busy} onClick={() => void mutation.run(async () => setReport(await apiClient.get("/workspace/experiments")), "Experiment aggregates loaded")}>View 30-day experiment aggregates</Button>
      {report.length > 0 && <ul className="space-y-2 text-xs">{report.map(row => <li key={`${row.experiment}-${row.variant}-${row.event}`}>{row.experiment} · {row.variant} · {row.event}: {row.accounts} accounts</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Counts are not a significance test or evidence of causal lift. Clinical features and care priority are never varied.</p>
    </>}
  </Panel>;
}
