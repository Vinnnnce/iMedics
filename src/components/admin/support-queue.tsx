"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

export interface QueueTicket {
  id: string;
  reference: string;
  type: string;
  typeLabel: string;
  status: string;
  priority: string;
  subject: string;
  message: string;
  contactName: string | null;
  contactEmail: string;
  signedIn: boolean;
  assignedToMe: boolean;
  assigned: boolean;
  overdue: boolean;
  slaDueAt: string;
  createdAt: string;
  incidentLinked: boolean;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"] as const;

/** Admin work queue for support tickets: assign, re-prioritise, change status, add an internal note. */
export function SupportQueue({ tickets }: { tickets: QueueTicket[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      await apiClient.patch("/admin/support/tickets", { id, ...patch });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the ticket");
    } finally {
      setBusy(null);
    }
  }

  if (tickets.length === 0) return <p className="text-sm text-muted-foreground">No open tickets.</p>;

  return (
    <ul className="space-y-3">
      {tickets.map((t) => (
        <li key={t.id}>
          <Card className={t.overdue ? "border-destructive/60" : undefined}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.reference}</span>
                <Badge variant={t.priority === "URGENT" || t.priority === "HIGH" ? "destructive" : "secondary"}>{t.priority.toLowerCase()}</Badge>
                <Badge variant="outline">{t.typeLabel}</Badge>
                <Badge variant="outline">{t.status.replaceAll("_", " ").toLowerCase()}</Badge>
                {t.overdue && <Badge variant="destructive">response overdue</Badge>}
                {t.incidentLinked && <Badge variant="outline">security incident opened</Badge>}
              </div>
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.message}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.contactName ?? "Anonymous"} · <a className="underline underline-offset-2" href={`mailto:${t.contactEmail}?subject=${encodeURIComponent(`Re: ${t.reference}`)}`}>{t.contactEmail}</a>
                {t.signedIn ? " · signed-in account" : " · visitor"} · received {new Date(t.createdAt).toLocaleString()} · first response due {new Date(t.slaDueAt).toLocaleString()}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {!t.assignedToMe && <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => update(t.id, { assignToMe: true })}>{t.assigned ? "Take over" : "Assign to me"}</Button>}
                <label className="sr-only" htmlFor={`status-${t.id}`}>Status</label>
                <select id={`status-${t.id}`} value={t.status} disabled={busy === t.id} onChange={(e) => update(t.id, { status: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLowerCase()}</option>)}
                </select>
                <label className="sr-only" htmlFor={`priority-${t.id}`}>Priority</label>
                <select id={`priority-${t.id}`} value={t.priority} disabled={busy === t.id} onChange={(e) => update(t.id, { priority: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
                  {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
