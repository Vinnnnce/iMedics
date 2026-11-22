"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Printer, Send, Sparkles, TriangleAlert } from "lucide-react";
import type { InvestigationItemStatus, InvestigationPriority } from "@prisma/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api-client";
import { REPORT_FORMAT_LABEL, STATUS_LABEL } from "@/lib/investigations/constants";
import { workflowSteps } from "@/lib/investigations/workflow";
import { FlagBadge, PriorityBadge, StatusBadge, fieldClass } from "./badges";
import { TrendChart } from "./trend-chart";

interface Observation { id: string; analyteCode: string | null; name: string; valueNumeric: number | null; valueText: string | null; unit: string | null; refText: string | null; flag: string | null; isCritical: boolean }
interface Released {
  id: string; version: number; releasedAt: string | null; clinicalIndication: string | null; technique: string | null; findings: string | null; impression: string | null; conclusion: string | null; recommendations: string | null;
  reporterName: string | null; reporterCredentials: string | null; amendmentReason: string | null; observations: Observation[]; media: { id: string; fileName: string; mimeType: string; description: string | null; dicomModality: string | null }[];
  interpretations: { id: string; note: string; followUpTitle: string | null; followUpDueAt: string | null; createdAt: string }[];
}
interface AlertEvent { id: string; kind: string; note: string | null; createdAt: string }
interface Item {
  id: string; domain: "LABORATORY" | "DIAGNOSTIC"; nameSnapshot: string; isCustom: boolean; departmentKey: string; status: InvestigationItemStatus; priority: InvestigationPriority; dueAt: string | null; scheduledAt: string | null;
  catalogueItemId: string | null; reportFormat: keyof typeof REPORT_FORMAT_LABEL; instructions: string | null; customDetails: Record<string, string> | null;
  performingFacility: { id: string; laboratoryName: string | null; city: string | null; state: string | null } | null;
  history: { id: string; toStatus: InvestigationItemStatus; note: string | null; createdAt: string }[];
  specimens: { id: string; accessionNumber: string; status: string; rejectionReason: string | null }[];
  results: { id: string; version: number; status: string; alerts: { id: string; status: string; summary: string | null; escalationLevel: number; events: AlertEvent[] }[] }[];
  released: Released | null;
}
interface Order {
  id: string; orderNumber: string; domain: "LABORATORY" | "DIAGNOSTIC"; status: string; priority: InvestigationPriority; clinicalIndication: string | null; diagnosis: string | null; submittedAt: string | null;
  patient: { id: string; firstName: string; lastName: string; caseNumber: string }; requestedBy: { name: string }; items: Item[];
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => apiClient.get<{ order: Order }>(`/investigations/orders/${orderId}`).then((r) => setOrder(r.order)).catch(() => setError("Order not found or you do not have access.")), [orderId]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!order) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-xs text-muted-foreground">{order.orderNumber} · {order.domain === "LABORATORY" ? "Laboratory" : "Diagnostic"} order</p>
            <h2 className="text-xl font-semibold">{order.patient.firstName} {order.patient.lastName} <span className="text-sm font-normal text-muted-foreground">{order.patient.caseNumber}</span></h2>
            {order.clinicalIndication && <p className="mt-1 text-sm text-muted-foreground">Indication: {order.clinicalIndication}</p>}
          </div>
          <div className="flex items-center gap-2"><PriorityBadge priority={order.priority} /><Badge variant="outline">{order.status.replace("_", " ").toLowerCase()}</Badge></div>
        </CardContent>
      </Card>
      {order.items.map((item) => <ItemCard key={item.id} item={item} patientId={order.patient.id} onChange={load} />)}
    </div>
  );
}

function ItemCard({ item, patientId, onChange }: { item: Item; patientId: string; onChange: () => void }) {
  const alert = item.results.flatMap((r) => r.alerts)[0];
  const open = alert && alert.status !== "ACKNOWLEDGED" && alert.status !== "RESOLVED";
  const steps = workflowSteps(item.domain);
  const idx = steps.indexOf(item.status);
  const [ackNote, setAckNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); onChange(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Action failed"); } finally { setBusy(false); }
  };

  const cancellable = ["NEW_REQUEST", "REFERRAL_PENDING", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT"].includes(item.status);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{item.nameSnapshot} {item.isCustom && <Badge variant="outline" className="ml-1">Custom</Badge>}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {item.performingFacility ? `${item.performingFacility.laboratoryName}${item.performingFacility.city ? `, ${item.performingFacility.city}` : ""}` : "No facility assigned"} · {item.departmentKey.replace(/-/g, " ")}
              {item.scheduledAt && <> · Appointment {new Date(item.scheduledAt).toLocaleString()}</>}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>
        {/* Progress */}
        <ol className="flex flex-wrap gap-1" aria-label="Progress">
          {steps.map((s, i) => <li key={s} title={STATUS_LABEL[s]} className={`h-1.5 min-w-4 flex-1 rounded-full ${idx >= i ? "bg-primary" : "bg-muted"}`} />)}
        </ol>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>Critical result - acknowledgement required</AlertTitle>
            <AlertDescription className="space-y-2 text-destructive/90">
              <p>{alert.summary ?? "Critical value reported"}. Please review the result and acknowledge that you have acted on it.</p>
              <div className="flex flex-wrap gap-2"><Input className="max-w-sm bg-background" placeholder="Note (optional)" value={ackNote} onChange={(e) => setAckNote(e.target.value)} />
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => apiClient.post(`/investigations/alerts/${alert.id}/acknowledge`, { note: ackNote || undefined }), "Critical result acknowledged")}>Acknowledge</Button></div>
            </AlertDescription>
          </Alert>
        )}

        {item.status === "REFERRAL_PENDING" && <ReferPanel item={item} onDone={onChange} />}
        {item.specimens.some((s) => s.status === "REJECTED" || s.status === "RECOLLECTION_REQUESTED") && (
          <Alert variant="warning"><TriangleAlert aria-hidden /><AlertTitle>Specimen issue</AlertTitle><AlertDescription>{item.specimens.filter((s) => s.rejectionReason).map((s) => `${s.accessionNumber}: ${s.rejectionReason}`).join(" · ")}</AlertDescription></Alert>
        )}

        {item.released ? <ReleasedReport item={item} released={item.released} patientId={patientId} onChange={onChange} /> : (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">The report will appear here once it has been verified, signed and released by the facility. Drafts and unverified results are never shown.</p>
        )}

        <details className="group rounded-lg border">
          <summary className="cursor-pointer select-none p-2.5 text-sm font-medium">Status history ({item.history.length})</summary>
          <ol className="space-y-2 border-t p-3">
            {item.history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden /><div><p className="font-medium">{STATUS_LABEL[h.toStatus]}</p><p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}{h.note ? ` · ${h.note}` : ""}</p></div></li>
            ))}
          </ol>
          {alert && alert.events.length > 0 && (
            <div className="border-t p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Critical alert trail</p>
              <ul className="space-y-1 text-xs">{alert.events.map((e) => <li key={e.id}>{new Date(e.createdAt).toLocaleString()} - {e.kind.toLowerCase()}{e.note ? ` (${e.note})` : ""}</li>)}</ul></div>
          )}
        </details>

        {cancellable && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling this investigation?"); if (reason && reason.trim().length >= 3) void run(() => apiClient.post(`/investigations/items/${item.id}/cancel`, { reason }), "Investigation cancelled"); }}>Cancel investigation</Button>
        )}
      </CardContent>
    </Card>
  );
}

function ReferPanel({ item, onDone }: { item: Item; onDone: () => void }) {
  const [options, setOptions] = useState<{ facilityId: string; name: string; city: string | null }[]>([]);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!item.catalogueItemId) return;
    apiClient.get<{ items: { facilities: { facilityId: string; name: string; city: string | null }[] }[] }>(`/investigations/catalogue?domain=${item.domain}&ids=${item.catalogueItemId}`).then((r) => setOptions(r.items[0]?.facilities ?? [])).catch(() => undefined);
  }, [item.catalogueItemId, item.domain]);
  return (
    <Alert variant="warning">
      <Send aria-hidden />
      <AlertTitle>Waiting for a facility</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>No facility has accepted this request. Refer it to a participating facility to keep it moving; it is not dropped.</p>
        {options.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <select aria-label="Refer to facility" className={`${fieldClass} max-w-xs`} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a facility...</option>{options.map((o) => <option key={o.facilityId} value={o.facilityId}>{o.name}{o.city ? `, ${o.city}` : ""}</option>)}</select>
            <Input className="max-w-xs" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" disabled={!to} onClick={() => apiClient.post(`/investigations/items/${item.id}/refer`, { toFacilityId: to, reason: reason || undefined }).then(() => { toast.success("Referral sent"); onDone(); }).catch((e) => toast.error(e instanceof ApiError ? e.message : "Referral failed"))}>Refer</Button>
          </div>
        ) : <p className="text-xs">No participating facility currently offers this service.</p>}
      </AlertDescription>
    </Alert>
  );
}

function ReleasedReport({ item, released, patientId, onChange }: { item: Item; released: Released; patientId: string; onChange: () => void }) {
  const [trend, setTrend] = useState<{ code: string; name: string } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const [followTitle, setFollowTitle] = useState("");
  const [followDue, setFollowDue] = useState("");
  const [saving, setSaving] = useState(false);

  const openMedia = async (mediaId: string) => {
    try { const r = await apiClient.get<{ url: string }>(`/investigations/items/${item.id}/media/${mediaId}`); window.open(r.url, "_blank", "noopener"); } catch { toast.error("Could not open the file"); }
  };
  const pdf = `/api/investigations/items/${item.id}/report`;

  return (
    <div className="space-y-4 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><FileText className="size-4 text-success" aria-hidden />{REPORT_FORMAT_LABEL[item.reportFormat]} {released.version > 1 && <Badge variant="warning">Amended v{released.version}</Badge>}</p>
          <p className="text-xs text-muted-foreground">Released {released.releasedAt ? new Date(released.releasedAt).toLocaleString() : ""}{released.reporterName ? ` · ${released.reporterName}${released.reporterCredentials ? `, ${released.reporterCredentials}` : ""}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a className={buttonVariants({ size: "sm", variant: "outline" })} href={pdf} target="_blank" rel="noreferrer"><ExternalLink aria-hidden />View report</a>
          <a className={buttonVariants({ size: "sm", variant: "outline" })} href={pdf} download><Download aria-hidden />PDF</a>
          <Button size="sm" variant="outline" onClick={() => { const w = window.open(pdf, "_blank"); w?.addEventListener("load", () => w.print()); }}><Printer aria-hidden />Print</Button>
          <Button size="sm" variant="secondary" disabled={aiBusy} onClick={async () => { setAiBusy(true); try { setSummary((await apiClient.post<{ summary: string }>("/investigations/ai-assist", { mode: "summarise", itemId: item.id })).summary); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Summary unavailable"); } finally { setAiBusy(false); } }}>{aiBusy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}Summarise</Button>
        </div>
      </div>
      {released.amendmentReason && <Alert variant="warning"><AlertTitle>Amended report</AlertTitle><AlertDescription>{released.amendmentReason}. Earlier versions are retained in the audit trail.</AlertDescription></Alert>}
      {summary && <Alert><Sparkles aria-hidden /><AlertTitle>AI-generated summary</AlertTitle><AlertDescription>{summary} <span className="block text-xs">Review the full report before acting on it.</span></AlertDescription></Alert>}

      {released.observations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-1.5 pr-3 font-medium">Test</th><th className="pr-3 font-medium">Result</th><th className="pr-3 font-medium">Unit</th><th className="pr-3 font-medium">Reference</th><th className="font-medium">Flag</th><th /></tr></thead>
            <tbody className="divide-y">
              {released.observations.map((o) => (
                <tr key={o.id} className={o.flag && o.flag !== "NORMAL" ? "bg-warning/5" : ""}>
                  <td className="py-1.5 pr-3 font-medium">{o.name}</td>
                  <td className={`pr-3 ${o.flag && o.flag !== "NORMAL" ? "font-semibold" : ""}`}>{o.valueNumeric ?? o.valueText}</td>
                  <td className="pr-3 text-muted-foreground">{o.unit}</td><td className="pr-3 text-muted-foreground">{o.refText}</td>
                  <td><FlagBadge flag={o.flag} /></td>
                  <td className="text-right">{o.valueNumeric != null && <Button size="xs" variant="ghost" onClick={() => setTrend(trend?.name === o.name ? null : { code: o.analyteCode ?? "", name: o.name })}>Compare</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {trend && <TrendChart patientId={patientId} analyteCode={trend.code || undefined} name={trend.name} />}

      {([["Clinical indication", released.clinicalIndication], ["Technique", released.technique], ["Findings", released.findings], ["Impression", released.impression], ["Conclusion", released.conclusion], ["Recommendations", released.recommendations]] as const).map(([label, text]) => text && (
        <section key={label}><h4 className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</h4><p className="whitespace-pre-wrap text-sm">{text}</p></section>
      ))}

      {released.media.length > 0 && (
        <section><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Images and attachments</h4>
          <ul className="flex flex-wrap gap-2">{released.media.map((m) => <li key={m.id}><Button size="sm" variant="outline" onClick={() => openMedia(m.id)}><ImageIcon aria-hidden />{m.fileName}{m.dicomModality ? ` (${m.dicomModality})` : ""}</Button></li>)}</ul></section>
      )}

      <section className="space-y-2 border-t pt-3">
        <h4 className="text-sm font-semibold">Clinical interpretation</h4>
        {released.interpretations.map((i) => <p key={i.id} className="rounded-lg bg-muted/50 p-2 text-sm">{i.note}{i.followUpTitle && <span className="mt-1 block text-xs text-muted-foreground">Follow-up: {i.followUpTitle}{i.followUpDueAt ? ` · due ${new Date(i.followUpDueAt).toLocaleDateString()}` : ""}</span>}</p>)}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor={`note-${item.id}`}>Add to the patient&apos;s record</Label><Textarea id={`note-${item.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your interpretation of this result" /></div>
          <div className="space-y-1"><Label htmlFor={`ft-${item.id}`}>Follow-up task (optional)</Label><Input id={`ft-${item.id}`} value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} placeholder="e.g. Repeat in 2 weeks" /></div>
          <div className="space-y-1"><Label htmlFor={`fd-${item.id}`}>Due</Label><Input id={`fd-${item.id}`} type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} /></div>
        </div>
        <Button size="sm" disabled={saving || note.trim().length < 3} onClick={async () => { setSaving(true); try { await apiClient.post(`/investigations/items/${item.id}/interpretation`, { note, followUpTitle: followTitle || undefined, followUpDueAt: followDue || undefined }); toast.success("Saved to the patient's case"); setNote(""); setFollowTitle(""); setFollowDue(""); onChange(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save"); } finally { setSaving(false); } }}>Save interpretation</Button>
      </section>
    </div>
  );
}
