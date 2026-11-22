"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Barcode, CheckCircle2, FilePlus2, Loader2, Plus, QrCode, Trash2, TriangleAlert, Upload } from "lucide-react";
import type { InvestigationItemStatus, InvestigationPriority } from "@prisma/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api-client";
import { evaluateFlag } from "@/lib/investigations/flags";
import { REPORT_FORMAT_LABEL, STATUS_LABEL } from "@/lib/investigations/constants";
import { workflowSteps } from "@/lib/investigations/workflow";
import { FlagBadge, PriorityBadge, StatusBadge } from "../badges";

type Status = InvestigationItemStatus;
interface Analyte { code: string; name: string; loincCode: string | null; ucumUnit: string | null; refLow: number | null; refHigh: number | null; criticalLow: number | null; criticalHigh: number | null }
interface Obs { analyteCode: string | null; name: string; loincCode: string | null; valueNumeric: number | null; valueText: string | null; unit: string | null; refLow: number | null; refHigh: number | null; criticalLow?: number | null; criticalHigh?: number | null; flag: string | null }
interface ResultRow {
  id: string; version: number; status: string; clinicalIndication: string | null; technique: string | null; findings: string | null; impression: string | null; conclusion: string | null; recommendations: string | null;
  reporterName: string | null; reporterCredentials: string | null; enteredById: string | null; amendmentReason: string | null; patientVisible: boolean; isCurrent: boolean; observations: Obs[];
}
interface Detail {
  item: {
    id: string; domain: "LABORATORY" | "DIAGNOSTIC"; nameSnapshot: string; isCustom: boolean; departmentKey: string; status: Status; priority: InvestigationPriority; reportFormat: keyof typeof REPORT_FORMAT_LABEL; instructions: string | null;
    specimenType: string | null; bodySite: string | null; scheduledAt: string | null; schedulingNotes: string | null; dueAt: string | null; customDetails: Record<string, string> | null;
    order: { orderNumber: string; clinicalIndication: string | null; diagnosis: string | null; clinicalNotes: string | null; clinicalSnapshot: { allergies?: unknown[] } | null; requestedBy: { name: string }; patient: { firstName: string; lastName: string; caseNumber: string; gender: string; dateOfBirth: string } };
    catalogue: { preparation: string | null; indicationGuidance: string | null } | null;
    history: { id: string; toStatus: Status; note: string | null; createdAt: string }[];
    specimens: { id: string; accessionNumber: string; barcode: string; status: string; rejectionReason: string | null; collectedAt: string | null; receivedAt: string | null }[];
    media: { id: string; fileName: string; mimeType: string; sizeBytes: number; description: string | null; dicomModality: string | null; studyInstanceUid: string | null }[];
    results: ResultRow[];
  };
  analytes: Analyte[];
  previous: { analyteCode: string; valueNumeric: number | null; valueText: string | null; unit: string | null; flag: string | null; result: { releasedAt: string | null } }[];
  nextStatuses: Status[];
  permissions: string[];
}

export function ItemWorkspace({ itemId, currentUserId }: { itemId: string; currentUserId: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => apiClient.get<Detail>(`/facility/investigations/items/${itemId}`).then(setD).catch(() => setError("Investigation not found for your facility.")), [itemId]);
  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await load(); return true; } catch (e) { toast.error(e instanceof ApiError ? e.message : "Action failed"); return false; } finally { setBusy(false); }
  }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!d) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading...</div>;

  const { item } = d;
  const can = (p: string) => d.permissions.includes(p);
  const steps = workflowSteps(item.domain);
  const idx = steps.indexOf(item.status);
  const p = item.order.patient;
  const working = item.results.find((r) => r.isCurrent) ?? null;
  const advance = (to: Status, extra: Record<string, unknown> = {}, ok?: string) => run(() => apiClient.post(`/facility/investigations/items/${itemId}/advance`, { action: "advance", to, ...extra }), ok);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{item.order.orderNumber} · requested by {item.order.requestedBy.name}</p>
              <h2 className="text-xl font-semibold">{item.nameSnapshot} {item.isCustom && <Badge variant="outline">Custom request</Badge>}</h2>
              <p className="text-sm text-muted-foreground">{p.firstName} {p.lastName} · {p.caseNumber} · {p.gender.toLowerCase()} · born {new Date(p.dateOfBirth).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2"><PriorityBadge priority={item.priority} /><StatusBadge status={item.status} /></div>
          </div>
          <ol className="flex gap-1" aria-label="Workflow progress">{steps.map((s, i) => <li key={s} title={STATUS_LABEL[s]} className={`h-1.5 flex-1 rounded-full ${idx >= i ? "bg-primary" : "bg-muted"}`} />)}</ol>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Clinical indication" value={item.order.clinicalIndication} /><Info label="Diagnosis" value={item.order.diagnosis} />
            <Info label="Specimen / site" value={[item.specimenType, item.bodySite].filter(Boolean).join(" · ")} /><Info label="Instructions" value={item.instructions} />
            <Info label="Clinical notes" value={item.order.clinicalNotes} />
            <div><p className="text-xs text-muted-foreground">Allergies</p>{(item.order.clinicalSnapshot?.allergies ?? []).length ? (item.order.clinicalSnapshot!.allergies as unknown[]).map((a) => <Badge key={String(a)} variant="warning" className="mr-1">{String(a)}</Badge>) : <p>None recorded</p>}</div>
          </div>
          {item.customDetails && <Alert><AlertTitle>Custom request details</AlertTitle><AlertDescription><dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{Object.entries(item.customDetails).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs capitalize">{k.replace(/([A-Z])/g, " $1")}</dt><dd className="text-foreground">{v}</dd></div>)}</dl></AlertDescription></Alert>}
        </CardContent>
      </Card>

      {/* Stage actions */}
      <StageActions d={d} busy={busy} can={can} advance={advance} run={run} itemId={itemId} />

      {item.domain === "LABORATORY" && item.specimens.length > 0 && <Specimens d={d} busy={busy} run={run} itemId={itemId} />}
      {item.domain === "DIAGNOSTIC" && !["NEW_REQUEST", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "PATIENT_PREPARATION", "CANCELLED"].includes(item.status) && <Media d={d} can={can("UPLOAD_MEDIA")} onDone={load} itemId={itemId} />}

      {working || ["ANALYSIS_COMPLETED", "RESULT_ENTERED", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT", "AWAITING_VERIFICATION"].includes(item.status) || item.status === "DELIVERED" || item.status === "RELEASED" ? (
        <ResultPanel key={`${working?.id}-${working?.status}-${item.status}`} d={d} working={working} can={can} busy={busy} run={run} itemId={itemId} currentUserId={currentUserId} />
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Status history</CardTitle></CardHeader>
        <CardContent><ol className="space-y-2">{item.history.map((h) => <li key={h.id} className="flex gap-3 text-sm"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden /><div><p className="font-medium">{STATUS_LABEL[h.toStatus]}</p><p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}{h.note ? ` · ${h.note}` : ""}</p></div></li>)}</ol></CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p>{value || "-"}</p></div>;
}

type RunFn = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

function StageActions({ d, busy, can, advance, run, itemId }: { d: Detail; busy: boolean; can: (p: string) => boolean; advance: (to: Status, extra?: Record<string, unknown>, ok?: string) => Promise<boolean>; run: RunFn; itemId: string }) {
  const { item } = d;
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const s = item.status;
  const canProcess = can("PROCESS_ORDERS");
  if (!canProcess) return null;

  const btn = (label: string, to: Status, ok?: string, variant: "default" | "outline" = "default") => <Button size="sm" variant={variant} disabled={busy} onClick={() => advance(to, {}, ok)}>{label}</Button>;
  const actions: React.ReactNode[] = [];

  if (s === "NEW_REQUEST") {
    actions.push(item.domain === "LABORATORY" ? btn("Accept - request sample", "AWAITING_SAMPLE", "Request accepted") : btn("Accept - awaiting appointment", "AWAITING_APPOINTMENT", "Request accepted"));
    actions.push(<Button key="decline" size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt("Why can this facility not perform it? The doctor will be told so they can refer it elsewhere."); if (reason && reason.trim().length >= 5) void run(() => apiClient.post(`/facility/investigations/items/${itemId}/advance`, { action: "decline", reason }), "Returned to the doctor for referral"); }}>Cannot perform</Button>);
  }
  if (s === "SAMPLE_RECEIVED") actions.push(btn("Assign to section", "ASSIGNED_TO_SECTION"));
  if (s === "ASSIGNED_TO_SECTION") actions.push(btn("Start processing", "PROCESSING"));
  if (s === "PROCESSING") actions.push(btn("Analysis completed", "ANALYSIS_COMPLETED"));
  if (s === "PATIENT_PREPARATION" || s === "APPOINTMENT_SCHEDULED") actions.push(btn("Patient checked in", "CHECKED_IN"));
  if (s === "APPOINTMENT_SCHEDULED") actions.push(btn("Patient preparation", "PATIENT_PREPARATION", undefined, "outline"));
  if (s === "CHECKED_IN") actions.push(btn("Start examination", "EXAM_IN_PROGRESS"));
  if (s === "EXAM_IN_PROGRESS") actions.push(btn("Examination completed", "EXAM_COMPLETED"));
  if (s === "EXAM_COMPLETED") actions.push(<Button key="aiq" size="sm" variant="outline" disabled={busy} onClick={() => advance("AWAITING_INTERPRETATION", {}, "Ready for interpretation")}>No images - go to reporting</Button>);
  if (s === "MEDIA_UPLOADED") actions.push(btn("Start interpretation", "AWAITING_INTERPRETATION"));
  if (item.media.length > 0 && s === "EXAM_COMPLETED") actions.push(btn("Images uploaded", "MEDIA_UPLOADED"));

  const scheduling = item.domain === "DIAGNOSTIC" && (s === "AWAITING_APPOINTMENT" || s === "APPOINTMENT_SCHEDULED");

  if (actions.length === 0 && !scheduling) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Next step</CardTitle>{item.catalogue?.preparation && <CardDescription>Preparation: {item.catalogue.preparation}</CardDescription>}</CardHeader>
      <CardContent className="space-y-3">
        {scheduling && (
          <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto] sm:items-end">
            <div className="space-y-1"><Label htmlFor="appt">Appointment</Label><Input id="appt" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="appt-notes">Preparation / notes for the patient</Label><Input id="appt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button size="sm" disabled={busy || !when} onClick={() => advance("APPOINTMENT_SCHEDULED", { scheduledAt: new Date(when).toISOString(), schedulingNotes: notes || undefined }, "Appointment scheduled")}>{s === "APPOINTMENT_SCHEDULED" ? "Reschedule" : "Schedule"}</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">{actions}</div>
        {s !== "CANCELLED" && ["NEW_REQUEST", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "SAMPLE_REJECTED"].includes(s) && (
          <Button size="xs" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { const note = window.prompt("Reason for cancelling?"); if (note && note.trim().length >= 3) void advance("CANCELLED", { note }, "Cancelled"); }}>Cancel investigation</Button>
        )}
      </CardContent>
    </Card>
  );
}

function Specimens({ d, busy, run, itemId }: { d: Detail; busy: boolean; run: RunFn; itemId: string }) {
  const act = (specimenId: string, action: "collect" | "receive" | "reject" | "recollect", reason?: string) => run(() => apiClient.post(`/facility/investigations/items/${itemId}/specimens`, { action, specimenId, reason }), action === "collect" ? "Specimen collected" : action === "receive" ? "Specimen accepted" : action === "reject" ? "Specimen rejected" : "Recollection requested");
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Specimens</CardTitle><CardDescription>Label tubes with the accession barcode. Rejections need a documented reason.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {d.item.specimens.map((sp) => (
          <div key={sp.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <BarcodeTag value={sp.barcode} />
              <div><p className="font-mono text-sm font-medium">{sp.accessionNumber}</p><p className="text-xs text-muted-foreground">{sp.status.replace(/_/g, " ").toLowerCase()}{sp.rejectionReason ? ` · ${sp.rejectionReason}` : ""}</p></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sp.status === "PENDING_COLLECTION" && <Button size="sm" disabled={busy} onClick={() => act(sp.id, "collect")}>Record collection</Button>}
              {sp.status === "COLLECTED" && <Button size="sm" disabled={busy} onClick={() => act(sp.id, "receive")}>Receive and accept</Button>}
              {(sp.status === "COLLECTED" || sp.status === "RECEIVED") && d.item.status !== "ASSIGNED_TO_SECTION" && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const r = window.prompt("Rejection reason (e.g. haemolysed, insufficient volume, mislabelled)"); if (r && r.trim().length >= 3) void act(sp.id, "reject", r); }}>Reject</Button>}
              {sp.status === "REJECTED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(sp.id, "recollect")}>Request recollection</Button>}
              <Button size="sm" variant="ghost" onClick={() => window.print()}><Barcode aria-hidden />Print label</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Code 39-style bars drawn from the barcode text so a label printout is scannable without extra libraries. */
function BarcodeTag({ value }: { value: string }) {
  const bars = useMemo(() => {
    const out: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of `*${value}*`) {
      const bits = ch.charCodeAt(0).toString(2).padStart(8, "0");
      for (const b of bits) { out.push({ x, w: b === "1" ? 2 : 1 }); x += b === "1" ? 3 : 2; }
      x += 2;
    }
    return { out, width: x };
  }, [value]);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={`0 0 ${bars.width} 28`} className="h-10 w-28" role="img" aria-label={`Barcode ${value}`}>{bars.out.filter((_, i) => i % 2 === 0).map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={28} className="fill-foreground" />)}</svg>
      <figcaption className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><QrCode className="size-3" aria-hidden />{value}</figcaption>
    </figure>
  );
}

function Media({ d, can, onDone, itemId }: { d: Detail; can: boolean; onDone: () => void; itemId: string }) {
  const [uploading, setUploading] = useState(false);
  const [modality, setModality] = useState("");
  const [study, setStudy] = useState("");
  const [desc, setDesc] = useState("");
  const locked = ["SIGNED", "RELEASED", "DELIVERED"].includes(d.item.status);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const mimeType = file.type || "application/octet-stream";
      const pre = await apiClient.post<{ key: string; uploadUrl: string; headers: Record<string, string> }>(`/facility/investigations/items/${itemId}/media`, { fileName: file.name, mimeType, sizeBytes: file.size });
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: pre.headers, body: file });
      if (!put.ok) throw new Error("Upload to storage failed");
      await apiClient.post(`/facility/investigations/items/${itemId}/media/confirm`, { key: pre.key, fileName: file.name, mimeType, description: desc || undefined, dicomModality: modality || undefined, studyInstanceUid: study || undefined });
      toast.success("File uploaded");
      setDesc("");
      onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Upload failed"); } finally { setUploading(false); }
  };
  const view = async (id: string) => { try { window.open((await apiClient.get<{ url: string }>(`/facility/investigations/items/${itemId}/media?mediaId=${id}`)).url, "_blank", "noopener"); } catch { toast.error("Could not open the file"); } };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Images and recordings</CardTitle><CardDescription>JPEG, PNG, WebP or PDF up to 15 MB. Add the DICOM modality and Study Instance UID where the study is stored in PACS.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {d.item.media.length > 0 && <ul className="space-y-1">{d.item.media.map((m) => <li key={m.id} className="flex items-center justify-between rounded-lg border p-2 text-sm"><span>{m.fileName}{m.dicomModality && <Badge variant="secondary" className="ml-2">DICOM {m.dicomModality}</Badge>}{m.description && <span className="ml-2 text-xs text-muted-foreground">{m.description}</span>}</span><Button size="xs" variant="outline" onClick={() => view(m.id)}>Open</Button></li>)}</ul>}
        {can && !locked && (
          <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1"><Label htmlFor="m-mod">DICOM modality</Label><Input id="m-mod" value={modality} onChange={(e) => setModality(e.target.value.toUpperCase())} placeholder="e.g. US" maxLength={16} /></div>
            <div className="space-y-1"><Label htmlFor="m-study">Study Instance UID</Label><Input id="m-study" value={study} onChange={(e) => setStudy(e.target.value)} placeholder="1.2.840..." /></div>
            <div className="space-y-1"><Label htmlFor="m-desc">Description</Label><Input id="m-desc" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <label className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm hover:bg-muted ${uploading ? "pointer-events-none opacity-60" : ""}`}>{uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}Upload<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} /></label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Result entry / report writing / verification / signing / release
// ---------------------------------------------------------------------------

interface ObsDraft { analyteCode: string | null; name: string; loincCode: string | null; value: string; unit: string; refLow: string; refHigh: string; criticalLow: string; criticalHigh: string }
const toNum = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

function ResultPanel({ d, working, can, busy, run, itemId, currentUserId }: { d: Detail; working: ResultRow | null; can: (p: string) => boolean; busy: boolean; run: RunFn; itemId: string; currentUserId: string }) {
  const { item } = d;
  const locked = !!working && ["SIGNED", "RELEASED", "SUPERSEDED"].includes(working.status);
  const awaiting = working?.status === "AWAITING_VERIFICATION";
  const editable = !locked && !awaiting && ["ANALYSIS_COMPLETED", "RESULT_ENTERED", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"].includes(item.status) || (!!working && working.status === "DRAFT");
  const isLab = item.reportFormat === "LAB_PANEL" || item.domain === "LABORATORY";

  const initialObs = (): ObsDraft[] => {
    if (working?.observations.length) return working.observations.map((o) => ({ analyteCode: o.analyteCode, name: o.name, loincCode: o.loincCode, value: o.valueNumeric != null ? String(o.valueNumeric) : (o.valueText ?? ""), unit: o.unit ?? "", refLow: o.refLow != null ? String(o.refLow) : "", refHigh: o.refHigh != null ? String(o.refHigh) : "", criticalLow: o.criticalLow != null ? String(o.criticalLow) : "", criticalHigh: o.criticalHigh != null ? String(o.criticalHigh) : "" }));
    return d.analytes.map((a) => ({ analyteCode: a.code, name: a.name, loincCode: a.loincCode, value: "", unit: a.ucumUnit ?? "", refLow: a.refLow != null ? String(a.refLow) : "", refHigh: a.refHigh != null ? String(a.refHigh) : "", criticalLow: a.criticalLow != null ? String(a.criticalLow) : "", criticalHigh: a.criticalHigh != null ? String(a.criticalHigh) : "" }));
  };
  const [obs, setObs] = useState<ObsDraft[]>(initialObs);
  const [text, setText] = useState({ clinicalIndication: working?.clinicalIndication ?? d.item.order.clinicalIndication ?? "", technique: working?.technique ?? "", findings: working?.findings ?? "", impression: working?.impression ?? "", conclusion: working?.conclusion ?? "", recommendations: working?.recommendations ?? "", reporterName: working?.reporterName ?? "", reporterCredentials: working?.reporterCredentials ?? "" });
  const [patientVisible, setPatientVisible] = useState(working?.patientVisible ?? true);
  const [reason, setReason] = useState("");
  const [statement, setStatement] = useState("I have reviewed this report and approve it for release.");
  const [returnNote, setReturnNote] = useState("");
  const prev = (code: string | null) => (code ? d.previous.find((p) => p.analyteCode === code) : undefined);

  const save = () => {
    const observations = obs.filter((o) => o.value.trim() !== "").map((o) => {
      const n = toNum(o.value);
      return { analyteCode: o.analyteCode ?? undefined, name: o.name, loincCode: o.loincCode ?? undefined, valueNumeric: n, valueText: n == null ? o.value : undefined, unit: o.unit || undefined, refLow: toNum(o.refLow), refHigh: toNum(o.refHigh), criticalLow: toNum(o.criticalLow), criticalHigh: toNum(o.criticalHigh) };
    });
    return run(() => apiClient.put(`/facility/investigations/items/${itemId}/result`, { ...text, reporterName: text.reporterName || undefined, reporterCredentials: text.reporterCredentials || undefined, patientVisible, observations }), "Saved");
  };
  const post = (body: Record<string, unknown>, ok: string) => run(() => apiClient.post(`/facility/investigations/items/${itemId}/result`, body), ok);

  const criticalCount = obs.filter((o) => evaluateFlag({ value: toNum(o.value), refLow: toNum(o.refLow), refHigh: toNum(o.refHigh), criticalLow: toNum(o.criticalLow), criticalHigh: toNum(o.criticalHigh) }).isCritical).length;
  const set = (k: keyof typeof text) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setText((t) => ({ ...t, [k]: e.target.value }));
  const status = working?.status;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><CardTitle className="text-base">{isLab ? "Results" : "Report"} - {REPORT_FORMAT_LABEL[item.reportFormat]}</CardTitle><CardDescription>{working ? `Version ${working.version} · ${status?.replace(/_/g, " ").toLowerCase()}` : "Not started"}{working?.amendmentReason ? ` · amendment: ${working.amendmentReason}` : ""}</CardDescription></div>
          {status && <Badge variant={status === "RELEASED" ? "success" : status === "AWAITING_VERIFICATION" ? "warning" : "outline"}>{status.replace(/_/g, " ").toLowerCase()}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalCount > 0 && <Alert variant="destructive"><TriangleAlert aria-hidden /><AlertTitle>{criticalCount} critical value{criticalCount === 1 ? "" : "s"}</AlertTitle><AlertDescription className="text-destructive/90">When this result is verified the ordering doctor is alerted immediately and must acknowledge it.</AlertDescription></Alert>}

        {isLab && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">Test</th><th className="pr-2 font-medium">Result</th><th className="pr-2 font-medium">Unit (UCUM)</th><th className="pr-2 font-medium">Ref. low</th><th className="pr-2 font-medium">Ref. high</th><th className="pr-2 font-medium">Crit. low / high</th><th className="pr-2 font-medium">Previous</th><th className="font-medium">Flag</th><th /></tr></thead>
              <tbody className="divide-y">
                {obs.map((o, i) => {
                  const f = evaluateFlag({ value: toNum(o.value), refLow: toNum(o.refLow), refHigh: toNum(o.refHigh), criticalLow: toNum(o.criticalLow), criticalHigh: toNum(o.criticalHigh) });
                  const pv = prev(o.analyteCode);
                  const upd = (k: keyof ObsDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setObs((cur) => cur.map((x, n) => (n === i ? { ...x, [k]: e.target.value } : x)));
                  return (
                    <tr key={i}>
                      <td className="py-1 pr-2">{o.analyteCode ? <span className="font-medium">{o.name}</span> : <Input aria-label="Test name" className="h-8" value={o.name} onChange={upd("name")} placeholder="Test name" disabled={!editable} />}</td>
                      <td className="pr-2"><Input aria-label={`${o.name} result`} className="h-8 w-24" value={o.value} onChange={upd("value")} disabled={!editable} /></td>
                      <td className="pr-2"><Input aria-label={`${o.name} unit`} className="h-8 w-24" value={o.unit} onChange={upd("unit")} disabled={!editable} /></td>
                      <td className="pr-2"><Input aria-label={`${o.name} reference low`} className="h-8 w-16" value={o.refLow} onChange={upd("refLow")} disabled={!editable} /></td>
                      <td className="pr-2"><Input aria-label={`${o.name} reference high`} className="h-8 w-16" value={o.refHigh} onChange={upd("refHigh")} disabled={!editable} /></td>
                      <td className="pr-2"><span className="flex gap-1"><Input aria-label={`${o.name} critical low`} className="h-8 w-14" value={o.criticalLow} onChange={upd("criticalLow")} disabled={!editable} /><Input aria-label={`${o.name} critical high`} className="h-8 w-14" value={o.criticalHigh} onChange={upd("criticalHigh")} disabled={!editable} /></span></td>
                      <td className="pr-2 text-xs text-muted-foreground">{pv ? `${pv.valueNumeric ?? pv.valueText}${pv.unit ? ` ${pv.unit}` : ""} (${pv.result.releasedAt ? new Date(pv.result.releasedAt).toLocaleDateString() : ""})` : "-"}</td>
                      <td><FlagBadge flag={f.flag} /></td>
                      <td>{editable && !o.analyteCode && <Button size="icon-xs" variant="ghost" aria-label="Remove row" onClick={() => setObs((cur) => cur.filter((_, n) => n !== i))}><Trash2 aria-hidden /></Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editable && <Button size="sm" variant="outline" className="mt-2" onClick={() => setObs((cur) => [...cur, { analyteCode: null, name: "", loincCode: null, value: "", unit: "", refLow: "", refHigh: "", criticalLow: "", criticalHigh: "" }])}><Plus aria-hidden />Add result row</Button>}
            {d.analytes.length > 0 && d.analytes.every((a) => a.refLow == null && a.refHigh == null) && <p className="mt-2 text-xs text-muted-foreground">No reference ranges are configured for this test. Enter your validated ranges in each row to enable abnormal and critical flagging.</p>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Clinical indication" value={text.clinicalIndication} onChange={set("clinicalIndication")} disabled={!editable} rows={2} />
          {!isLab && <TextField label="Examination technique" value={text.technique} onChange={set("technique")} disabled={!editable} rows={2} />}
          <TextField label={isLab ? "Interpretive comments / findings" : "Findings"} value={text.findings} onChange={set("findings")} disabled={!editable} rows={isLab ? 2 : 6} wide />
          <TextField label="Impression" value={text.impression} onChange={set("impression")} disabled={!editable} rows={3} />
          <TextField label="Conclusion" value={text.conclusion} onChange={set("conclusion")} disabled={!editable} rows={3} />
          <TextField label="Recommendations" value={text.recommendations} onChange={set("recommendations")} disabled={!editable} rows={2} wide />
          <div className="space-y-1"><Label htmlFor="rep-name">Reporting professional</Label><Input id="rep-name" value={text.reporterName} onChange={set("reporterName")} disabled={!editable} /></div>
          <div className="space-y-1"><Label htmlFor="rep-cred">Credentials</Label><Input id="rep-cred" value={text.reporterCredentials} onChange={set("reporterCredentials")} disabled={!editable} placeholder="e.g. MBBS, FWACP (Radiology)" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={patientVisible} onChange={(e) => setPatientVisible(e.target.checked)} disabled={!editable} />Visible to the patient once released</label>

        {/* Action bar, each step permissioned separately */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {editable && can("ENTER_RESULTS") && <><Button size="sm" variant="outline" disabled={busy} onClick={save}>Save draft</Button>
            {status === "DRAFT" && <Button size="sm" disabled={busy} onClick={() => post({ action: "submit" }, "Submitted for verification")}>Submit for verification</Button>}</>}
          {awaiting && can("VERIFY_RESULTS") && (
            working!.enteredById === currentUserId ? <p className="text-sm text-muted-foreground">Another professional must verify this result (you entered it).</p> : (
              <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={busy} onClick={() => post({ action: "verify", approve: true }, "Verified")}><CheckCircle2 aria-hidden />Verify</Button>
                <Input className="h-8 w-56" placeholder="Reason for returning" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
                <Button size="sm" variant="outline" disabled={busy || !returnNote.trim()} onClick={() => post({ action: "verify", approve: false, note: returnNote }, "Returned to the reporter")}>Return</Button></div>
            )
          )}
          {status === "VERIFIED" && can("VERIFY_RESULTS") && <div className="flex flex-wrap items-center gap-2"><Input className="h-8 w-80" value={statement} onChange={(e) => setStatement(e.target.value)} aria-label="Signature statement" /><Button size="sm" disabled={busy} onClick={() => post({ action: "sign", statement }, "Report signed")}><FilePlus2 aria-hidden />Sign report</Button></div>}
          {status === "SIGNED" && can("RELEASE_RESULTS") && <Button size="sm" disabled={busy} onClick={() => post({ action: "release" }, "Released to the doctor and patient record")}>Release report</Button>}
          {status === "RELEASED" && can("ENTER_RESULTS") && (
            <div className="flex flex-wrap items-center gap-2"><Input className="h-8 w-72" placeholder="Reason for amendment (required)" value={reason} onChange={(e) => setReason(e.target.value)} /><Button size="sm" variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => post({ action: "amend", reason }, "Amendment started - the released report stays visible until the new version is released")}>Amend report</Button></div>
          )}
          {status === "RELEASED" && <p className="text-xs text-muted-foreground">Released reports are never edited; an amendment creates a new signed version.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function TextField({ label, value, onChange, disabled, rows, wide }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; disabled?: boolean; rows: number; wide?: boolean }) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}><Label htmlFor={id}>{label}</Label><Textarea id={id} rows={rows} value={value} onChange={onChange} disabled={disabled} /></div>;
}
