"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface RefundRecord {
  id: string;
  status: string;
  reason: string;
  amount: number;
  currency: string;
  autoApproved: boolean;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: string;
  requestedByEmail: string;
  payment: { id: string; kind: string; description: string; payerName: string };
}

/** The admin refund queue: patient requests waiting for a decision, and recent outcomes. */
export function RefundQueue() {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ refunds: RefundRecord[] }>("/admin/refunds");
      setRefunds(data.refunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the refund queue");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const decide = async (refund: RefundRecord, approve: boolean) => {
    setBusy(refund.id);
    setError("");
    try {
      await apiClient.post(`/admin/refunds/${refund.id}`, { approve });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the decision");
    } finally {
      setBusy("");
    }
  };

  const pending = refunds.filter((r) => r.status === "PENDING");
  const decided = refunds.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Awaiting decision ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No refund requests waiting for review.</p>
          ) : (
            <div className="space-y-4">
              {pending.map((refund) => (
                <div key={refund.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {formatMoney(refund.amount, refund.currency)} — {refund.payment.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested by {refund.requestedBy} ({refund.requestedByEmail}) ·{" "}
                        {new Date(refund.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-x-2">
                      <Button size="sm" onClick={() => decide(refund, true)} disabled={busy === refund.id}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decide(refund, false)} disabled={busy === refund.id}>
                        Reject
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-muted-foreground">Reason: {refund.reason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {decided.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decided.slice(0, 20).map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell>{new Date(refund.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{refund.requestedBy}</TableCell>
                    <TableCell>{formatMoney(refund.amount, refund.currency)}</TableCell>
                    <TableCell>{refund.status.toLowerCase().replace("_", " ")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {refund.autoApproved ? "Policy / cancellation" : "Patient request"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
