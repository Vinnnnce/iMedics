"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

export interface ReferralRow {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  service: { name: string; price: number; currency: string } | null;
  doctor: { name: string; specialty: string | null };
  patient: { name: string; caseNumber: string };
}

const STATUS_LABEL: Record<string, string> = { PENDING: "New", ACCEPTED: "Accepted", DECLINED: "Declined", FULFILLED: "Fulfilled" };

/** The facility's referral inbox with accept / decline / fulfil actions. */
export function ReferralsInbox({ referrals }: { referrals: ReferralRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (id: string, status: "ACCEPTED" | "DECLINED" | "FULFILLED") => {
    setBusy(true); setError("");
    try {
      await apiClient.patch(`/facility/referrals/${id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the referral");
    } finally {
      setBusy(false);
    }
  };

  if (referrals.length === 0) {
    return <p className="text-sm text-muted-foreground">No referrals yet. Doctors on Medic1905 can refer patients to your services.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {referrals.map((r) => (
        <Card key={r.id} className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {r.patient.name} · case {r.patient.caseNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  From Dr. {r.doctor.name}{r.doctor.specialty ? ` (${r.doctor.specialty})` : ""} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={r.status === "PENDING" ? "secondary" : "outline"} className="rounded-lg text-xs">
                {STATUS_LABEL[r.status] ?? r.status}
              </Badge>
            </div>
            {r.service && (
              <p className="text-sm">
                {r.service.name} · {formatMoney(r.service.price.toString(), r.service.currency)}
              </p>
            )}
            {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
            {r.status === "PENDING" && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => act(r.id, "ACCEPTED")}>Accept</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, "DECLINED")}>Decline</Button>
              </div>
            )}
            {r.status === "ACCEPTED" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, "FULFILLED")}>Mark fulfilled</Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
