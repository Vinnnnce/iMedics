"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface EarningsResponse {
  totals: Array<{ currency: string; gross: number; commission: number; earnings: number; refunded: number }>;
  monthly: Array<{ month: string; currency: string; gross: number; commission: number; earnings: number; refunded: number }>;
  transactions: Array<{
    id: string;
    kind: string;
    description: string;
    amount: number;
    commission: number | null;
    earnings: number | null;
    currency: string;
    status: string;
    receiptNumber: string | null;
    paidAt: string | null;
    refundedAt: string | null;
    createdAt: string;
    payerName: string;
  }>;
}

/** A provider's earnings and transaction history: their share of each settled charge, net of commission. */
export function EarningsView() {
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiClient.get<EarningsResponse>("/earnings"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your earnings");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Every currency the provider earned in gets its own totals; amounts are never mixed. */}
      {data.totals.map((totals) => (
        <div key={totals.currency} className="space-y-2">
          {data.totals.length > 1 && <p className="text-xs text-muted-foreground">{totals.currency}</p>}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total earnings</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatMoney(totals.earnings, totals.currency)}</p></CardContent>
            </Card>
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Gross volume</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatMoney(totals.gross, totals.currency)}</p></CardContent>
            </Card>
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Platform commission</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatMoney(totals.commission, totals.currency)}</p></CardContent>
            </Card>
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Refunded</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatMoney(totals.refunded, totals.currency)}</p></CardContent>
            </Card>
          </div>
        </div>
      ))}

      {data.monthly.length > 0 && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-lg">By month</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Refunded</TableHead>
                  <TableHead>Your earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monthly.map((row) => (
                  <TableRow key={`${row.month}-${row.currency}`}>
                    <TableCell>{row.month}{data.monthly.length > 1 && data.totals.length > 1 ? ` (${row.currency})` : ""}</TableCell>
                    <TableCell>{formatMoney(row.gross, row.currency)}</TableCell>
                    <TableCell>{formatMoney(row.commission, row.currency)}</TableCell>
                    <TableCell>{formatMoney(row.refunded, row.currency)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(row.earnings, row.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-lg">Transactions</CardTitle></CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Your share</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.paidAt ?? t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{t.payerName}</TableCell>
                    <TableCell>{formatMoney(t.amount, t.currency)}</TableCell>
                    <TableCell>{t.earnings === null ? "—" : formatMoney(t.earnings, t.currency)}</TableCell>
                    <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
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
