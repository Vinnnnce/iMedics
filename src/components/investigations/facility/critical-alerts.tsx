"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface AlertRow {
  id: string; status: string; summary: string | null; escalationLevel: number; createdAt: string; acknowledgedAt: string | null;
  events: { id: string; kind: string; note: string | null; createdAt: string }[];
  result: { item: { id: string; nameSnapshot: string; order: { orderNumber: string; requestedBy: { name: string }; patient: { firstName: string; lastName: string; caseNumber: string } } } };
}

export function CriticalAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  useEffect(() => { apiClient.get<{ alerts: AlertRow[] }>("/facility/investigations/alerts").then((r) => setAlerts(r.alerts)).catch(() => setAlerts([])); }, []);
  if (!alerts) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading...</div>;
  if (alerts.length === 0) return <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">No critical-result alerts.</p>;
  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const open = a.status === "SENT" || a.status === "ESCALATED";
        const item = a.result.item;
        return (
          <Card key={a.id} className={open ? "border-destructive/40" : ""}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">{open && <TriangleAlert className="size-4 text-destructive" aria-hidden />}<Link className="hover:underline" href={`/lab/results-reports/items/${item.id}`}>{item.nameSnapshot}</Link> - {item.order.patient.firstName} {item.order.patient.lastName}</p>
                  <p className="text-xs text-muted-foreground">{item.order.orderNumber} · Ordering doctor: {item.order.requestedBy.name} · {a.summary}</p>
                </div>
                <Badge variant={open ? "destructive" : "success"}>{a.status === "ACKNOWLEDGED" ? "Acknowledged" : a.status === "ESCALATED" ? `Escalated (level ${a.escalationLevel})` : a.status === "SENT" ? "Awaiting acknowledgement" : a.status.toLowerCase()}</Badge>
              </div>
              <ol className="space-y-0.5 text-xs text-muted-foreground">{a.events.map((e) => <li key={e.id}>{new Date(e.createdAt).toLocaleString()} - {e.kind.toLowerCase()}{e.note ? ` (${e.note})` : ""}</li>)}</ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
