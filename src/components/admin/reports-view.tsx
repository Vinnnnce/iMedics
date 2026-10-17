"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface ReportsResponse {
  overview: Array<{
    currency: string;
    grossVolume: number;
    commissionRevenue: number;
    refundedTotal: number;
    refundedCount: number;
    subscriptionRevenue: number;
    subscriptionCharges: number;
  }>;
  revenue: Array<{ month: string; currency: string; commission: number; subscriptionRevenue: number; refunded: number }>;
  earnings: Array<{ payeeId: string; name: string; currency: string; earnings: number; charges: number }>;
  refunds: {
    byStatus: Array<{ status: string; currency: string; count: number; amount: number }>;
    processedRefunds: Array<{ currency: string; count: number; amount: number }>;
  };
  usageByPlan: Array<{
    id: string;
    code: string;
    name: string;
    monthlyPrice: number;
    currency: string;
    consultationAllowance: number | null;
    activeSubscriptions: number;
    monthlyRevenue: number;
    consultationsUsed: number;
    averageUsage: number;
  }>;
}

/** Platform revenue, provider earnings, refunds, subscription revenue and usage by plan. */
export function ReportsView() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<ReportsResponse>("/admin/reports")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reports"));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {data.overview.map((row) => (
        <Card key={row.currency} className="beeline-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{row.currency} at a glance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5 text-sm">
            <div><p className="text-lg font-bold">{formatMoney(row.grossVolume, row.currency)}</p><p className="text-xs text-muted-foreground">Gross volume</p></div>
            <div><p className="text-lg font-bold">{formatMoney(row.commissionRevenue, row.currency)}</p><p className="text-xs text-muted-foreground">Commission revenue</p></div>
            <div><p className="text-lg font-bold">{formatMoney(row.subscriptionRevenue, row.currency)}</p><p className="text-xs text-muted-foreground">Subscription revenue</p></div>
            <div><p className="text-lg font-bold">{formatMoney(row.refundedTotal, row.currency)}</p><p className="text-xs text-muted-foreground">Refunded ({row.refundedCount})</p></div>
          </CardContent>
        </Card>
      ))}
      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Active subscriptions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{data.usageByPlan.reduce((sum, plan) => sum + plan.activeSubscriptions, 0)}</p>
          <p className="text-xs text-muted-foreground">across {data.usageByPlan.length} plans</p>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-lg">Revenue by month</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Subscriptions</TableHead>
                <TableHead>Refunded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.revenue.map((row) => (
                <TableRow key={`${row.month}-${row.currency}`}>
                  <TableCell>{row.month}</TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell>{formatMoney(row.commission, row.currency)}</TableCell>
                  <TableCell>{formatMoney(row.subscriptionRevenue, row.currency)}</TableCell>
                  <TableCell>{formatMoney(row.refunded, row.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-lg">Provider earnings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Charges</TableHead>
                <TableHead>Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.earnings.map((row) => (
                <TableRow key={`${row.payeeId}-${row.currency}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.charges}</TableCell>
                  <TableCell>{formatMoney(row.earnings, row.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-lg">Subscriptions and usage by plan</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Monthly revenue</TableHead>
                <TableHead>Consultations used</TableHead>
                <TableHead>Avg per doctor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.usageByPlan.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>{formatMoney(plan.monthlyPrice, plan.currency)}</TableCell>
                  <TableCell>{plan.activeSubscriptions}</TableCell>
                  <TableCell>{formatMoney(plan.monthlyRevenue, plan.currency)}</TableCell>
                  <TableCell>
                    {plan.consultationsUsed}
                    {plan.consultationAllowance !== null ? ` of ${plan.activeSubscriptions * plan.consultationAllowance}` : ""}
                  </TableCell>
                  <TableCell>{plan.averageUsage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-lg">Refunds by status</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.refunds.byStatus.map((row) => (
                <TableRow key={`${row.status}-${row.currency}`}>
                  <TableCell>{row.status.toLowerCase().replace("_", " ")}</TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell>{formatMoney(row.amount, row.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
