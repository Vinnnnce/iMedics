"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkspaceData } from "@/lib/workspace/types";
import { Panel, ItemTable, apiClient, useDashboardMutation } from "./common";
import { DocumentsPanel } from "./documents";
import { TaskPanel } from "./tasks";

function CaseSearch() {
  const [message, setMessage] = useState("");
  const mutation = useDashboardMutation();
  return <Panel title="Find your case"><form className="space-y-3" onSubmit={event => {
    event.preventDefault(); const search = String(new FormData(event.currentTarget).get("case"));
    void mutation.run(async () => {
      const response = await apiClient.get<{ patients: { caseNumber: string }[] }>(`/patients?search=${encodeURIComponent(search)}&limit=10`);
      setMessage(response.patients.length ? `Your case: ${response.patients.map(patient => patient.caseNumber).join(", ")}` : "No matching case in your account.");
    }, "Case search completed");
  }}><FormField label="Case number" required hint="Search is restricted to records linked to your account."><Input name="case" required maxLength={100} /></FormField>
    <Button variant="outline" disabled={mutation.busy}>Search my records</Button><p role="status" className="text-sm">{message}</p>{mutation.errorUI}
  </form></Panel>;
}
export function PrevisitIntake({ data }: { data: WorkspaceData }) {
  const mutation = useDashboardMutation();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    await mutation.run(async () => {
      await apiClient.post("/workspace/intake", { appointmentId: fields.get("appointment"), reason: fields.get("reason"),
        medications: fields.get("medications") || "", allergies: fields.get("allergies") || "", consent: fields.get("consent") === "on" });
    }, "Pre-visit intake saved for your clinician");
  }
  return <Panel title="Prepare for your next visit"><p className="text-sm text-muted-foreground">Tell your clinician what you want to discuss. This form does not diagnose, prescribe, or make clinical decisions.</p>
    <form className="space-y-3" onSubmit={save}>
      <label className="block space-y-2 text-sm">Upcoming appointment<select name="appointment" required className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Select appointment</option>{data.appointments.map(appointment => <option key={appointment.id} value={appointment.id}>{appointment.title} · {appointment.at && new Date(appointment.at).toLocaleDateString()}</option>)}</select></label>
      {(["reason", "medications", "allergies"] as const).map(field => <FormField key={field} label={field === "reason" ? "What would you like to discuss?" : field === "medications" ? "Current medications" : "Allergies"} required={field === "reason"}>
        <textarea name={field} required={field === "reason"} maxLength={3000} rows={3} className="w-full rounded-lg border border-input bg-background p-3 text-sm" />
      </FormField>)}
      <label className="flex gap-2 text-sm"><input name="consent" type="checkbox" required />I consent to sharing this intake with my treating clinician.</label>
      {mutation.errorUI}<Button variant="outline" disabled={!data.extensionsReady || !data.appointments.length || mutation.busy}>Save intake</Button>
    </form>
  </Panel>;
}
export function PatientCareSections({ data }: { data: WorkspaceData }) {
  return <section id="care-workspace" aria-label="Manage your care" className="space-y-6">
    {data.alerts.length > 0 && <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4"><h2 className="font-semibold">A result requires prompt attention</h2>
      <p className="text-sm">Contact your care team promptly to review the verified result. No automated treatment decision has been made.</p><Link className="text-sm underline" href="/patient/results">Review results</Link></div>}
    <div className="grid gap-4 min-[390px]:grid-cols-2">
      <Panel title="Messages"><p className="text-2xl font-bold">{data.unreadMessages}</p><p className="text-sm text-muted-foreground">Unread secure messages</p><Link className="text-sm underline" href="/patient/consult">Open secure conversations</Link></Panel>
      <Panel title="Payments"><p className="text-2xl font-bold">{data.metrics.find(metric => metric.label === "Pending payments")?.value ?? "0"}</p><p className="text-sm text-muted-foreground">Outstanding payment records</p><Link className="text-sm underline" href="/payments">Manage payments and receipts</Link></Panel>
    </div>
    <Tabs defaultValue="care"><TabsList className="max-w-full flex-wrap"><TabsTrigger value="care">Care tasks</TabsTrigger><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="intake">Pre-visit intake</TabsTrigger></TabsList>
      <TabsContent value="care"><div className="grid gap-4 lg:grid-cols-2"><TaskPanel initialTasks={data.tasks} ready={data.extensionsReady} role="PATIENT" /><CaseSearch /></div></TabsContent>
      <TabsContent value="records"><DocumentsPanel ready={data.extensionsReady} /></TabsContent>
      <TabsContent value="results"><Panel title="Result status tracking"><ItemTable items={data.results} title="Results" exportSection="results" /><p className="text-xs text-muted-foreground">Unverified numerical results and unreviewed AI interpretations are not released here.</p></Panel></TabsContent>
      <TabsContent value="timeline"><Panel title="Health timeline"><ItemTable items={data.timeline} title="Timeline" exportSection="timeline" /></Panel></TabsContent>
      <TabsContent value="intake"><PrevisitIntake data={data} /></TabsContent>
    </Tabs>
    <Panel title="Your next steps">{data.insights.length ? <ul className="space-y-3">{data.insights.map(insight => <li key={insight.id}><p className="text-sm font-medium">{insight.title}</p><p className="text-xs text-muted-foreground">{insight.subtitle}</p>{insight.href && <Link href={insight.href} className="text-sm underline">Review</Link>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No care reminders found in your latest records.</p>}</Panel>
  </section>;
}
