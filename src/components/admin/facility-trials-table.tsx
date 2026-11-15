"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";

export interface TrialRow {
  facilityId: string; name: string; kind: string; status: string; phase: string;
  endsAt: string | null; daysLeft: number | null; planName: string | null;
}

const PHASE: Record<string, { label: string; urgent?: boolean }> = {
  TRIAL: { label: "Trial" }, PAID: { label: "Paid" }, GRACE: { label: "Grace period", urgent: true },
  READ_ONLY: { label: "Read-only", urgent: true }, FREE_UNTIL_PLANS: { label: "Trial over, no plans on sale" }, UNMETERED: { label: "No plan" },
};
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

/** Every facility's plan state, soonest to end first, with a support tool to extend a trial. */
export function FacilityTrialsTable({ rows }: { rows: TrialRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [days, setDays] = useState("14");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function extend(facilityId: string) {
    setBusy(true);
    try {
      await apiClient.patch("/admin/facility-subscriptions", { facilityId, days: Number(days), reason });
      toast.success("Trial extended");
      setOpen(null);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extend the trial");
    } finally { setBusy(false); }
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No facilities have a subscription yet. Trials start when a facility is verified.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((r) => {
        const phase = PHASE[r.phase] ?? { label: r.phase };
        return (
          <li key={r.facilityId} className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-muted-foreground">{r.kind.replaceAll("_", " ").toLowerCase()}{r.planName ? ` · ${r.planName}` : ""}</p>
              </div>
              <Badge variant={phase.urgent ? "destructive" : "secondary"}>{phase.label}</Badge>
              <span className="text-muted-foreground">{r.daysLeft !== null ? `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} left · ends ${date(r.endsAt)}` : `ended ${date(r.endsAt)}`}</span>
              <Button size="sm" variant="outline" onClick={() => setOpen(open === r.facilityId ? null : r.facilityId)}>Extend trial</Button>
            </div>
            {open === r.facilityId && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
                <label className="text-xs">Add
                  <select value={days} onChange={(e) => setDays(e.target.value)} className="ml-2 h-9 rounded-lg border border-input bg-background px-2 text-sm">
                    {["7", "14", "30", "60", "90"].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </label>
                <label className="min-w-[14rem] flex-1 text-xs">Reason (recorded in the audit log)
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={500} placeholder="Why is this facility getting more time?" />
                </label>
                <Button size="sm" disabled={busy || reason.trim().length < 10} onClick={() => extend(r.facilityId)}>{busy ? "Saving…" : "Extend"}</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
