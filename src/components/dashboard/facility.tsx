"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { DataTable } from "@/components/shared/data-table";
import { Panel, ItemTable, useDashboardMutation, apiClient } from "./common";
import type { WorkspaceData } from "@/lib/workspace/types";
import { EngagementPanel } from "./engagement";
interface Analytics {
  resources: { id: string; name: string; kind: string; capacity: number; active: boolean; assignments: number; booked_hours: number; calendarUtilizationPercent: number }[];
  assignments: { id: string; name: string; kind: string; starts_at: string; ends_at: string; booking_id: string }[];
  revenue: { currency: string; status: string; amount: number; count: number }[];
  turnaround: { sample: number; medianHours: number | null; p90Hours: number | null; basis: string }; utilizationBasis: string;
}
export function FacilitySections({ data }: { data: WorkspaceData }) {
  const mutation = useDashboardMutation();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const load = async () => setAnalytics(await apiClient.get<Analytics>(`/workspace/facility-analytics?${new URLSearchParams(Object.entries(range).filter(([, value]) => Boolean(value)))}`));
  async function resource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    await mutation.run(async () => { await apiClient.post("/workspace/operations", { action: "resource", kind: fields.get("kind"), name: fields.get("name"), capacity: Number(fields.get("capacity")) }); await load(); form.reset(); }, "Resource created");
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    await mutation.run(async () => { await apiClient.post("/workspace/operations", { action: "assign", bookingId: fields.get("booking"), resourceId: fields.get("resource"), startsAt: new Date(String(fields.get("starts"))).toISOString(), endsAt: new Date(String(fields.get("ends"))).toISOString() }); await load(); }, "Resource allocated");
  }
  return <section id="care-workspace" aria-label="Facility operations" className="space-y-6">{mutation.errorUI}
    <Tabs defaultValue="bookings"><TabsList className="max-w-full flex-wrap"><TabsTrigger value="bookings">Bookings</TabsTrigger><TabsTrigger value="results">Result queue</TabsTrigger><TabsTrigger value="services">Services</TabsTrigger><TabsTrigger value="analytics">Workload and revenue</TabsTrigger></TabsList>
      <TabsContent value="bookings"><Panel title="Booking management"><ItemTable items={data.appointments} title="Bookings" exportSection="appointments" actions={booking => <div className="flex flex-wrap gap-2">
        {["Requested", "Confirmed"].includes(booking.status) && <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => void mutation.run(async () => { await apiClient.patch(`/facility-bookings/${booking.id}`, { status: booking.status === "Requested" ? "CONFIRMED" : "COMPLETED" }); }, "Booking updated")}>{booking.status === "Requested" ? "Confirm" : "Complete"}</Button>}
        {["Requested", "Confirmed"].includes(booking.status) && <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => {
          if (window.confirm("Cancel this booking? This may initiate a refund under the payment policy.")) void mutation.run(async () => { await apiClient.patch(`/facility-bookings/${booking.id}`, { status: "CANCELLED" }); }, "Booking cancelled");
        }}>Cancel</Button>}
      </div>} /></Panel></TabsContent>
      <TabsContent value="results"><Panel title="Result queue"><p className="text-xs text-muted-foreground">Only your uploaded results are listed. Open lab orders are restricted to patients linked to this facility by a booking or your prior uploads.</p><ItemTable items={data.results} title="Results" exportSection="results" /><Link href="/lab/upload" className="text-sm underline">Upload a result</Link></Panel></TabsContent>
      <TabsContent value="services"><Panel title="Service catalogue"><ItemTable items={data.operations.filter(item => item.status !== "Revenue")} title="Services" /><Link href="/lab/services" className="text-sm underline">Manage services, pricing, and turnaround targets</Link></Panel></TabsContent>
      <TabsContent value="analytics"><div className="space-y-4"><Panel title="Workload, rooms, turnaround, and revenue">
        <form onSubmit={event => { event.preventDefault(); void mutation.run(load, "Facility analytics loaded"); }} className="flex flex-wrap items-end gap-3">
          <FormField label="From date (UTC)"><Input type="date" value={range.from} max={range.to || undefined} onChange={e => setRange({ ...range, from: e.target.value })} /></FormField>
          <FormField label="To date (UTC)"><Input type="date" value={range.to} min={range.from || undefined} onChange={e => setRange({ ...range, to: e.target.value })} /></FormField>
          <Button variant="outline" disabled={!data.extensionsReady || mutation.busy}>Load analytics</Button>
        </form>
        {!analytics && <p className="text-sm text-muted-foreground">Load a date range to see real allocations. Defaults to the last 30 UTC calendar days.</p>}
        {analytics && <>
          <p className="text-xs text-muted-foreground">{analytics.utilizationBasis}</p>
          <DataTable rows={analytics.resources} rowKey={row => row.id} caption="Staff workload and room utilization" columns={[
            { id: "name", header: "Resource", cell: row => `${row.name} · ${row.kind}` },
            { id: "workload", header: "Assignments", cell: row => row.assignments },
            { id: "hours", header: "Booked hours", cell: row => Number(row.booked_hours).toFixed(1) },
            { id: "utilization", header: "Calendar utilization", cell: row => `${row.calendarUtilizationPercent}%` },
          ]} />
          <p className="text-sm">Turnaround median: {analytics.turnaround.medianHours?.toFixed(1) ?? "Not available"}h · P90: {analytics.turnaround.p90Hours?.toFixed(1) ?? "Not available"}h · {analytics.turnaround.sample} records.</p>
          <p className="text-xs text-muted-foreground">{analytics.turnaround.basis}</p>
          <DataTable rows={analytics.revenue} rowKey={row => `${row.currency}-${row.status}`} caption="Facility revenue by currency and status" columns={[
            { id: "currency", header: "Currency", cell: row => row.currency }, { id: "status", header: "Status", cell: row => row.status },
            { id: "amount", header: "Amount", cell: row => row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
          ]} />
          <p className="text-xs text-muted-foreground">Successful and refund-pending charges are reported separately from refunded amounts. These are gross ledger values, not payouts or net earnings.</p>
        </>}
      </Panel><div className="grid gap-4 lg:grid-cols-2"><Panel title="Add a staff or room resource"><form onSubmit={resource} className="space-y-3">
        <FormField label="Resource name" required><Input name="name" required maxLength={100} /></FormField>
        <label className="block space-y-2 text-sm">Resource type<select name="kind" className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="STAFF">Staff</option><option value="ROOM">Room</option></select></label>
        <FormField label="Concurrent capacity" required><Input type="number" name="capacity" min={1} max={100} defaultValue={1} required /></FormField>
        <Button variant="outline" disabled={!data.extensionsReady || mutation.busy}>Create resource</Button>
      </form><p className="text-xs text-muted-foreground">Staff resources are workload labels, not account invitations or access grants.</p></Panel>
      <Panel title="Allocate a booking"><form className="space-y-3" onSubmit={assign}>
        <label className="block space-y-2 text-sm">Open booking<select required name="booking" className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Choose booking</option>{data.appointments.filter(booking => ["Requested", "Confirmed"].includes(booking.status)).map(booking => <option value={booking.id} key={booking.id}>{booking.title} · {booking.subtitle}</option>)}</select></label>
        <label className="block space-y-2 text-sm">Active resource<select required name="resource" className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Load analytics and choose resource</option>{analytics?.resources.filter(resource => resource.active).map(resource => <option key={resource.id} value={resource.id}>{resource.name} · capacity {resource.capacity}</option>)}</select></label>
        <FormField label="Start (device time)" required><Input name="starts" type="datetime-local" required /></FormField><FormField label="End (device time)" required><Input name="ends" type="datetime-local" required /></FormField>
        <Button variant="outline" disabled={!data.extensionsReady || mutation.busy || !analytics}>Allocate resource</Button>
      </form></Panel></div>
      {analytics && <Panel title="Current allocations"><DataTable rows={analytics.assignments} rowKey={row => row.id} caption="Resource allocations" columns={[
        { id: "resource", header: "Resource", cell: row => row.name }, { id: "time", header: "Time", cell: row => `${new Date(row.starts_at).toLocaleString()} – ${new Date(row.ends_at).toLocaleString()}` },
        { id: "actions", header: "Actions", cell: row => <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => {
          if (window.confirm("Remove this resource allocation? The booking itself will not be cancelled.")) void mutation.run(async () => { await apiClient.post("/workspace/operations", { action: "unassign", id: row.id }); await load(); }, "Allocation removed");
        }}>Unassign</Button> },
      ]} /></Panel>}
      </div></TabsContent>
    </Tabs>
    <EngagementPanel role="LAB_SCIENTIST" ready={data.extensionsReady} />
  </section>;
}
