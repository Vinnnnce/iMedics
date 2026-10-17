"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface RunSummary {
  id: string;
  date: string;
  provider: string;
  status: string;
  localCount: number;
  gatewayCount: number;
  localAmountMinor: number;
  gatewayAmountMinor: number;
  openDiscrepancies: number;
}

interface Discrepancy {
  id: string;
  type: string;
  severity: string;
  paymentId: string | null;
  providerReference: string | null;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  resolvedAt: string | null;
}

/** Daily reconciliation between Medic1905's records and the gateway's reports. */
export function ReconciliationView() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<{ run: RunSummary; discrepancies: Discrepancy[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ runs: RunSummary[] }>("/admin/reconciliation");
      setRuns(data.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reconciliation runs");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const open = async (run: RunSummary) => {
    setError("");
    try {
      const data = await apiClient.get<{ run: { discrepancies: Discrepancy[] } }>(`/admin/reconciliation?runId=${run.id}`);
      setSelected({ run, discrepancies: data.run.discrepancies });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the run");
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/admin/reconciliation", {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the reconciliation");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (discrepancy: Discrepancy) => {
    setBusy(true);
    try {
      await apiClient.patch("/admin/reconciliation", { id: discrepancy.id });
      if (selected) await open(selected.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark the finding as handled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Compares yesterday&#39;s payment records with the gateway&#39;s report. The scheduled job runs this daily; alerts are sent
          for missing webhooks, mismatched amounts, duplicate payments and failed settlements.
        </p>
        <Button onClick={runNow} disabled={busy}>
          Run for yesterday
        </Button>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reconciliation runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Local amount</TableHead>
                  <TableHead>Gateway amount</TableHead>
                  <TableHead>Open findings</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{run.date}</TableCell>
                    <TableCell>{run.localCount}</TableCell>
                    <TableCell>{run.gatewayCount}</TableCell>
                    <TableCell>{formatMoney(run.localAmountMinor / 100, "NGN")}</TableCell>
                    <TableCell>{formatMoney(run.gatewayAmountMinor / 100, "NGN")}</TableCell>
                    <TableCell className={run.openDiscrepancies > 0 ? "font-medium text-destructive" : ""}>
                      {run.openDiscrepancies}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => open(run)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Findings for {selected.run.date}</CardTitle>
          </CardHeader>
          <CardContent>
            {selected.discrepancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No differences found.</p>
            ) : (
              <div className="space-y-3">
                {selected.discrepancies.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {d.type.toLowerCase().replace(/_/g, " ")}{" "}
                          <span className="text-xs text-muted-foreground">({d.severity.toLowerCase()})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reference {d.providerReference ?? "—"}
                          {d.paymentId ? ` · payment ${d.paymentId}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expected {JSON.stringify(d.expected)} · actual {JSON.stringify(d.actual)}
                        </p>
                      </div>
                      {d.resolvedAt ? (
                        <span className="text-xs text-muted-foreground">Handled</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => resolve(d)} disabled={busy}>
                          Mark handled
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
