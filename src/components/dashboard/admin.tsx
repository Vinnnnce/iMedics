"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { DashboardSkeleton, ErrorState } from "@/components/shared/async-state";
import { Panel, ItemTable, apiClient, useDashboardMutation, downloadCsv } from "./common";
import type { WorkspaceData, WorkspaceItem } from "@/lib/workspace/types";
import { EngagementPanel } from "./engagement";
interface Operations {
  disputes: { id: string; payment_id: string; status: string; reason: string; resolution: string | null; created_at: string }[];
  subscriptions: { id: string; owner_id: string; name: string; plan: string; status: string; renews_at: string | null }[];
  delivery: { completed: number; pending: number; needs_review: number }[];
}
export function AdminOperations({ users }: { users: { id: string; name: string }[] }) {
  const [data, setData] = useState<WorkspaceData | null>(null), [operations, setOperations] = useState<Operations | null>(null);
  const [error, setError] = useState(""), [selectedPayment, setSelectedPayment] = useState(""), [selectedDispute, setSelectedDispute] = useState("");
  const [health, setHealth] = useState<{ outboxInstalled: boolean; emailConfigured: boolean; pushConfigured: boolean; pending: number; exhausted: number } | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const mutation = useDashboardMutation();
  async function load() {
    const workspace = await apiClient.get<WorkspaceData>("/workspace"); setData(workspace);
    if (workspace.extensionsReady) setOperations(await apiClient.get<Operations>("/workspace/operations"));
    setHealth(await apiClient.get("/admin/notification-health")); setError("");
  }
  useEffect(() => {
    let active = true;
    Promise.all([apiClient.get<WorkspaceData>("/workspace"), apiClient.get<typeof health>("/admin/notification-health")]).then(async ([workspace, status]) => {
      const ops = workspace.extensionsReady ? await apiClient.get<Operations>("/workspace/operations") : null;
      if (active) { setData(workspace); setOperations(ops); setHealth(status); }
    }).catch(() => { if (active) setError("Administration workspace could not be loaded."); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); const form = event.currentTarget, fields = Object.fromEntries(new FormData(form));
    if (!window.confirm("Apply this sensitive administrative action? It will be recorded in the audit trail.")) return;
    await mutation.run(async () => {
      const body = action === "refund" ? { action, paymentId: selectedPayment, reason: fields.reason, confirm: fields.confirm === "on" }
        : action === "resolve" ? { action, id: selectedDispute, status: fields.status, resolution: fields.resolution }
        : { action, ownerId: fields.owner, plan: fields.plan, status: fields.status, ...(fields.renews ? { renewsAt: new Date(String(fields.renews)).toISOString() } : {}) };
      await apiClient.post("/workspace/operations", body); await load(); form.reset();
    }, "Administrative action recorded");
  }
  if (error) return <ErrorState detail={error} action={<Button variant="outline" onClick={() => void mutation.run(load, "Administration loaded")}>Retry</Button>} />;
  if (!data) return <DashboardSkeleton />;
  const disputes: WorkspaceItem[] = operations?.disputes.map(row => ({ id: row.id, title: `Payment ${row.payment_id.slice(0, 8)}`, subtitle: row.reason, status: row.status, at: row.created_at })) ?? [];
  return <section id="care-workspace" aria-label="Administrative operations" className="space-y-4">{mutation.errorUI}
    <Tabs defaultValue="payments"><TabsList className="max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"><TabsTrigger value="payments">Payments and refunds</TabsTrigger><TabsTrigger value="disputes">Disputes</TabsTrigger><TabsTrigger value="subscriptions">Subscriptions</TabsTrigger><TabsTrigger value="health">Compliance and health</TabsTrigger></TabsList>
      <TabsContent value="payments"><Panel title="Payment management"><ItemTable items={data.payments} title="Payments" exportSection="payments" actions={payment => payment.status === "Successful" ? <Button size="sm" variant="outline" onClick={() => setSelectedPayment(payment.id)}>Select for refund</Button> : <span className="text-xs text-muted-foreground">{payment.status}</span>} />
        <form className="space-y-3 border-t border-border pt-4" onSubmit={event => void submit(event, "refund")}>
          <p className="text-sm">Selected payment: {selectedPayment || "Select a successful payment above"}</p>
          <FormField label="Refund reason" required><Input name="reason" minLength={10} maxLength={2000} required /></FormField>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" required />I confirm this refund request. Gateway completion is not guaranteed until confirmed.</label>
          <Button type="submit" variant="outline" disabled={!selectedPayment || mutation.busy}>Request refund</Button>
        </form>
      </Panel></TabsContent>
      <TabsContent value="disputes"><Panel title="Dispute management"><ItemTable items={disputes} title="Disputes" actions={dispute => <Button variant="outline" size="sm" disabled={dispute.status === "RESOLVED"} onClick={() => setSelectedDispute(dispute.id)}>Review</Button>} />
        <form className="space-y-3" onSubmit={event => void submit(event, "resolve")}><p className="text-sm">Selected dispute: {selectedDispute || "Choose a dispute above"}</p>
          <label className="block space-y-2 text-sm">Decision<select name="status" className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="REVIEWING">Reviewing</option><option value="RESOLVED">Resolved</option></select></label>
          <FormField label="Resolution or review note" required><textarea name="resolution" minLength={5} maxLength={2000} required className="w-full rounded-lg border border-input bg-background p-3 text-sm" /></FormField>
          <Button type="submit" variant="outline" disabled={!data.extensionsReady || !selectedDispute || mutation.busy}>Record decision</Button>
        </form>
      </Panel></TabsContent>
      <TabsContent value="subscriptions"><Panel title="Subscription management"><ItemTable items={operations?.subscriptions.map(row => ({ id: row.id, title: row.name, subtitle: row.plan, status: row.status, at: row.renews_at ?? undefined })) ?? []} title="Subscriptions" />
        <form className="space-y-3" onSubmit={event => void submit(event, "subscription")}>
          <label className="block space-y-2 text-sm">Account<select name="owner" required className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Choose account</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <FormField label="Plan name" required><Input name="plan" required maxLength={80} /></FormField>
          <label className="block space-y-2 text-sm">Subscription status<select name="status" className="block h-10 w-full rounded-lg border border-input bg-background px-2">{["ACTIVE", "PAUSED", "CANCELLED"].map(status => <option key={status}>{status}</option>)}</select></label>
          <FormField label="Renewal date (device time)"><Input name="renews" type="datetime-local" /></FormField>
          <p className="text-xs text-muted-foreground">This manages entitlement records only. It does not charge a card, create recurring billing, or grant a clinical role.</p>
          <Button type="submit" variant="outline" disabled={!data.extensionsReady || mutation.busy}>Update subscription</Button>
        </form>
      </Panel></TabsContent>
      <TabsContent value="health"><Panel title="Compliance and platform health">
        <p className="text-sm">API and database reachable at {new Date(data.updatedAt).toLocaleString()}. This is an application snapshot, not an uptime guarantee or compliance certification.</p>
        <p className="text-sm">Delivery outbox: {health?.outboxInstalled ? "Installed" : "Not installed"} · Email configured: {health?.emailConfigured ? "Yes" : "No"} · Push configured: {health?.pushConfigured ? "Yes" : "No"}</p>
        <p className="text-sm">Pending delivery jobs: {health?.pending ?? "Unknown"} · Exhausted jobs: {health?.exhausted ?? "Unknown"}</p>
        <Button variant="outline" disabled={mutation.busy} onClick={() => void mutation.run(load, "Health snapshot refreshed")}>Refresh platform snapshot</Button>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          if (window.confirm("Export authorized audit metadata to this device? Keep the downloaded file secure.")) void mutation.run(
            () => downloadCsv(`/api/workspace/export?${new URLSearchParams(Object.entries(range).filter(([, value]) => Boolean(value)))}`, "medic1905-audit.csv"), "Audit export downloaded");
        }}><FormField label="Audit from (UTC)"><Input type="date" value={range.from} max={range.to || undefined} onChange={e => setRange({ ...range, from: e.target.value })} /></FormField>
          <FormField label="Audit to (UTC)"><Input type="date" value={range.to} min={range.from || undefined} onChange={e => setRange({ ...range, to: e.target.value })} /></FormField><Button type="submit" variant="outline">Export audit CSV</Button>
        </form><p className="text-xs text-muted-foreground">Exports omit clinical payloads, addresses, IPs, raw headers, and audit details. Verify encryption, retention, access reviews, and incident-response procedures in deployment infrastructure.</p>
      </Panel></TabsContent>
    </Tabs>
    <EngagementPanel role="ADMIN" ready={data.extensionsReady} />
  </section>;
}
