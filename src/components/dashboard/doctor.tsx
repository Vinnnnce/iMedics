"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { StatusChip } from "@/components/shared/status-chip";
import { Panel, ItemTable, apiClient, useDashboardMutation } from "./common";
import { TaskPanel } from "./tasks";
import { DocumentsPanel } from "./documents";
import type { WorkspaceData } from "@/lib/workspace/types";
interface Context {
  history: { chiefComplaint: string | null; drugAllergies: unknown; currentDrugs: unknown } | null;
  consultations: { diagnosis: string | null; createdAt: string }[]; results: { panelType: string; testDate: string }[];
  intake: { reason: string; medications: string; allergies: string } | null;
}
export function DoctorCareSections({ data }: { data: WorkspaceData }) {
  const next = data.appointments.find(appointment => appointment.at && appointment.at >= data.updatedAt);
  const [context, setContext] = useState<Context | null>(null);
  const [reminders, setReminders] = useState<{ id: string; due_at: string; delivered_at: string | null }[]>([]);
  const mutation = useDashboardMutation();
  async function followup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    await mutation.run(async () => { await apiClient.post("/workspace/followups", { consultationId: fields.get("consultation"), dueAt: new Date(String(fields.get("due"))).toISOString() }); }, "Follow-up reminder scheduled");
  }
  return <section id="care-workspace" aria-label="Clinical workspace" className="space-y-6">
    {mutation.errorUI}
    <div className="grid gap-4 lg:grid-cols-2"><Panel title="Next patient">
      {next ? <><h3 className="font-semibold">{next.title}</h3><p className="text-sm text-muted-foreground">{next.subtitle} · Case {next.caseNumber}</p>
        <p className="text-sm">{next.at && new Date(next.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} WAT</p>
        <Button variant="outline" disabled={mutation.busy || !next.patientId} onClick={() => void mutation.run(async () => setContext(await apiClient.get<Context>(`/workspace/clinical-context?patientId=${next.patientId}`)), "Authorized clinical context loaded")}>Review next-patient context</Button>
        {context && <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
          <p><strong>Presenting concern:</strong> {context.history?.chiefComplaint || "No recorded chief complaint"}</p>
          <p><strong>Allergies:</strong> {context.history?.drugAllergies ? JSON.stringify(context.history.drugAllergies) : "Not documented. Confirm with patient."}</p>
          <p><strong>Current medications:</strong> {context.history?.currentDrugs ? JSON.stringify(context.history.currentDrugs) : "Not documented. Confirm with patient."}</p>
          {context.intake && <><p><strong>Patient intake:</strong> {context.intake.reason}</p><p>Patient-reported allergies: {context.intake.allergies || "Not provided"}</p><p>Patient-reported medications: {context.intake.medications || "Not provided"}</p></>}
          <p>{context.results.length} recent verified results · {context.consultations.length} recent finalized consultations.</p>
        </div>}
        <Link className="block text-sm underline" href="/doctor/consultations">Open structured consultation and ICD-10 workflow</Link>
      </> : <p className="text-sm text-muted-foreground">No upcoming patients in the loaded schedule.</p>}
    </Panel><Panel title="Practice status"><p className="text-sm"><strong>Availability:</strong> {data.availability}</p><p className="text-sm"><strong>Subscription:</strong> {data.subscription}</p>
      {data.operations.filter(item => item.status === "Earnings").map(item => <p key={item.id} className="text-sm"><strong>{item.title}</strong> · {item.subtitle}</p>)}
      <div className="flex flex-wrap gap-4"><Link href="/doctor/schedule" className="text-sm underline">Manage availability</Link><Link href="/payments" className="text-sm underline">Earnings and payments</Link></div>
      <p className="text-xs text-muted-foreground">Subscription records are administrator-managed; no automatic billing is initiated here.</p>
    </Panel></div>
    <Tabs defaultValue="schedule"><TabsList className="max-w-full flex-wrap"><TabsTrigger value="schedule">Schedule</TabsTrigger><TabsTrigger value="tasks">Clinical tasks</TabsTrigger><TabsTrigger value="alerts">Clinical alerts</TabsTrigger><TabsTrigger value="messages">Messages</TabsTrigger><TabsTrigger value="documents">Shared records</TabsTrigger><TabsTrigger value="followups">Follow-ups</TabsTrigger></TabsList>
      <TabsContent value="schedule"><Panel title="Today's schedule and upcoming visits"><ItemTable items={data.appointments} title="Appointments" exportSection="appointments" /></Panel></TabsContent>
      <TabsContent value="tasks"><div className="space-y-4"><TaskPanel initialTasks={data.tasks} ready={data.extensionsReady} role="DOCTOR" /><Panel title="Documentation to complete"><ItemTable items={data.operations.filter(item => item.status === "Draft")} title="Draft consultations" /></Panel></div></TabsContent>
      <TabsContent value="alerts"><Panel title="Clinical alerts"><ItemTable items={[...data.alerts, ...data.results.filter(result => result.status !== "Verified")]} title="Clinical alerts" /></Panel></TabsContent>
      <TabsContent value="messages"><Panel title="Secure patient communication"><p className="text-sm">{data.unreadMessages} unread messages</p><ItemTable items={data.messages} title="Conversations" /></Panel></TabsContent>
      <TabsContent value="documents"><DocumentsPanel ready={data.extensionsReady} recipient /></TabsContent>
      <TabsContent value="followups"><Panel title="Follow-up automation"><p className="text-sm text-muted-foreground">Schedule a reminder for an existing finalized consultation. This does not book a visit or make a clinical decision.</p>
        <form className="space-y-3" onSubmit={followup}>
          <label className="block space-y-2 text-sm">Finalized consultation<select name="consultation" required className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Choose consultation</option>{data.timeline.filter(item => item.title === "Consultation" && item.status === "Finalized").map(item => <option key={item.id} value={item.id}>{item.at && new Date(item.at).toLocaleDateString()} · {item.id.slice(0, 8)}</option>)}</select></label>
          <FormField label="Reminder date and time (your device time)" required><Input type="datetime-local" name="due" required /></FormField>
          <Button variant="outline" disabled={!data.extensionsReady || mutation.busy}>Schedule reminder</Button>
        </form><p className="text-xs text-muted-foreground">Delivery uses the configured cron worker, recipient preferences, email, and enrolled push devices.</p>
        <Button variant="outline" disabled={!data.extensionsReady || mutation.busy} onClick={() => void mutation.run(async () => setReminders(await apiClient.get("/workspace/followups")), "Follow-ups loaded")}>Load scheduled reminders</Button>
        {reminders.map(reminder => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3" key={reminder.id}><p className="text-sm">{new Date(reminder.due_at).toLocaleString()} · {reminder.delivered_at ? "Queued for delivery" : "Scheduled"}</p>
          {!reminder.delivered_at && <Button variant="outline" size="sm" disabled={mutation.busy} onClick={() => {
            if (window.confirm("Cancel this follow-up reminder?")) void mutation.run(async () => {
              await apiClient.delete("/workspace/followups", { id: reminder.id });
              setReminders(rows => rows.filter(row => row.id !== reminder.id));
            }, "Reminder cancelled");
          }}>Cancel reminder</Button>}
        </div>)}
      </Panel></TabsContent>
    </Tabs>
    <Panel title="Review suggestions"><p className="text-xs text-muted-foreground">Reminder-priority signals and schedule-gap suggestions are rules, not calibrated predictions. Visits are never moved automatically.</p>
      <ul className="space-y-3">{data.insights.map(insight => <li key={insight.id} className="space-y-1 rounded-lg border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{insight.title}</p><StatusChip>{insight.status}</StatusChip></div><p className="text-xs text-muted-foreground">{insight.subtitle}</p>{insight.href && <Link href={insight.href} className="text-sm underline">Review</Link>}</li>)}</ul>
    </Panel>
  </section>;
}
