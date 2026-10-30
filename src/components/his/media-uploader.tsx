"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, MEDIA_CATEGORY_LABEL } from "@/lib/his/media-formats";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass } from "./use-api";

interface Item { file: File; state: "queued" | "hashing" | "uploading" | "verifying" | "done" | "error"; progress: number; error?: string }
interface MediaRow { id: string; category: keyof typeof MEDIA_CATEGORY_LABEL; examinationType: string; fileName: string; sizeBytes: number; reportStatus: string; sensitivity: string; scanStatus: string; releasedToPatientAt: string | null; createdAt: string; patient: { firstName: string; lastName: string; caseNumber: string } }

const MIME_BY_EXT: Record<string, string> = { dcm: "application/dicom", dicom: "application/dicom", hl7: "application/hl7-v2", json: "application/fhir+json", xml: "application/xml", scp: "application/octet-stream", ecg: "application/octet-stream", csv: "text/csv", txt: "text/plain", wav: "audio/wav", mp3: "audio/mpeg", mov: "video/quicktime", m4v: "video/mp4", tif: "image/tiff", tiff: "image/tiff" };
const mimeOf = (f: File) => MIME_BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] ?? f.type ?? "application/octet-stream";

async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function put(url: string, file: File, type: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

/** Bulk drag-and-drop diagnostic upload with checksum, progress, retry and metadata. */
export function MediaUploader({ canUpload, canRelease, canReview = false }: { canUpload: boolean; canRelease: boolean; canReview?: boolean }) {
  const [patient, setPatient] = useState<IdentifiedPatient | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ category: "XRAY", examinationType: "", examinationAt: "", modality: "", bodySite: "", accessionNumber: "", orderingClinician: "", reportingClinician: "", reportStatus: "UNREPORTED", sensitivity: "STANDARD" });
  const [list, setList] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const d = await api<{ media: MediaRow[] }>(`/api/facility/his/media${patient ? `?patientId=${patient.id}` : ""}`); setList(d.media); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }, [patient]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  const update = (i: number, p: Partial<Item>) => setItems((arr) => arr.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const uploadOne = async (i: number, file: File, allowDuplicate = false) => {
    if (!patient) return;
    try {
      update(i, { state: "hashing", error: undefined, progress: 0 });
      const hash = await sha256(file);
      const type = mimeOf(file);
      const presign = await api<{ key: string; uploadUrl: string }>("/api/facility/his/media", { body: { patientId: patient.id, fileName: file.name, mimeType: type, sizeBytes: file.size, sha256: hash, allowDuplicate } });
      update(i, { state: "uploading" });
      await put(presign.uploadUrl, file, type, (p) => update(i, { progress: p }));
      update(i, { state: "verifying" });
      await api("/api/facility/his/media/confirm", { body: { key: presign.key, patientId: patient.id, fileName: file.name, mimeType: type, sha256: hash, category: meta.category, examinationType: meta.examinationType || file.name, examinationAt: meta.examinationAt ? new Date(meta.examinationAt).toISOString() : null, modality: meta.modality || null, bodySite: meta.bodySite || null, accessionNumber: meta.accessionNumber || null, orderingClinician: meta.orderingClinician || null, reportingClinician: meta.reportingClinician || null, reportStatus: meta.reportStatus, sensitivity: meta.sensitivity } });
      update(i, { state: "done", progress: 100 });
      void load();
    } catch (e) { update(i, { state: "error", error: e instanceof Error ? e.message : "Upload failed" }); }
  };
  const addFiles = (files: FileList | File[]) => {
    const start = items.length;
    const next = [...files].map((file) => ({ file, state: "queued" as const, progress: 0 }));
    setItems((arr) => [...arr, ...next]);
    next.forEach((n, k) => void uploadOne(start + k, n.file));
  };
  const open = async (id: string, mode: "view" | "download") => { try { const d = await api<{ url: string }>(`/api/facility/his/media/${id}?mode=${mode}`); window.open(d.url, "_blank", "noopener"); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } };
  const change = async (id: string, body: Record<string, unknown>) => {
    try { await api(`/api/facility/his/media/${id}`, { method: "PATCH", body }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Upload to a patient record</h2>
          {patient ? <p className="text-sm" data-testid="text-media-patient">{patient.firstName} {patient.lastName} · {patient.caseNumber} <button className="text-xs underline" onClick={() => setPatient(null)}>change</button></p> : <PatientIdentify onFound={setPatient} />}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Category<select className={inputClass} value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>{Object.entries(MEDIA_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-xs">Examination type<input className={inputClass} value={meta.examinationType} onChange={(e) => setMeta({ ...meta, examinationType: e.target.value })} placeholder="e.g. Chest X-ray PA" /></label>
            <label className="text-xs">Examination date/time<input type="datetime-local" className={inputClass} value={meta.examinationAt} onChange={(e) => setMeta({ ...meta, examinationAt: e.target.value })} /></label>
            <label className="text-xs">Modality / device<input className={inputClass} value={meta.modality} onChange={(e) => setMeta({ ...meta, modality: e.target.value })} /></label>
            <label className="text-xs">Body site<input className={inputClass} value={meta.bodySite} onChange={(e) => setMeta({ ...meta, bodySite: e.target.value })} /></label>
            <label className="text-xs">Accession / study no.<input className={inputClass} value={meta.accessionNumber} onChange={(e) => setMeta({ ...meta, accessionNumber: e.target.value })} /></label>
            <label className="text-xs">Ordering clinician<input className={inputClass} value={meta.orderingClinician} onChange={(e) => setMeta({ ...meta, orderingClinician: e.target.value })} /></label>
            <label className="text-xs">Reporting clinician<input className={inputClass} value={meta.reportingClinician} onChange={(e) => setMeta({ ...meta, reportingClinician: e.target.value })} /></label>
            <label className="text-xs">Report status<select className={inputClass} value={meta.reportStatus} onChange={(e) => setMeta({ ...meta, reportStatus: e.target.value })}>{(canReview ? ["UNREPORTED", "PRELIMINARY", "VERIFIED"] : ["UNREPORTED", "PRELIMINARY"]).map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-xs">Access classification<select className={inputClass} value={meta.sensitivity} onChange={(e) => setMeta({ ...meta, sensitivity: e.target.value })}>{["STANDARD", "RESTRICTED", "SPECIALLY_PROTECTED"].map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <label
            className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-sm ${patient ? "" : "pointer-events-none opacity-50"}`}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (patient) addFiles(e.dataTransfer.files); }}>
            Drag &amp; drop files here, or click to choose (PDF, DOC/DOCX, XLS/XLSX, CSV/TXT, JPEG, PNG, TIFF, DICOM, MP4/MOV, WAV/MP3, HL7 v2, FHIR)
            <input type="file" multiple accept={ACCEPT_ATTRIBUTE} className="sr-only" disabled={!patient} onChange={(e) => e.target.files && addFiles(e.target.files)} data-testid="input-media-files" />
          </label>
          <ul className="space-y-1 text-xs">{items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex-1 truncate">{it.file.name}</span>
              <span>{it.state}{it.state === "uploading" ? ` ${it.progress}%` : ""}</span>
              {it.state === "error" && <><span className="text-destructive">{it.error}</span><Button size="xs" variant="outline" onClick={() => uploadOne(i, it.file)}>Retry</Button>{it.error?.includes("already attached") && <Button size="xs" variant="ghost" onClick={() => uploadOne(i, it.file, true)}>Upload anyway</Button>}</>}
            </li>
          ))}</ul>
        </section>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <section className="rounded-xl border bg-card">
        <h2 className="p-3 text-sm font-semibold">{patient ? "This patient's files" : "Recent files"}</h2>
        {list.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No files yet.</p> : (
          <ul className="divide-y text-sm">{list.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="flex-1"><p className="font-medium">{m.examinationType}</p><p className="text-xs text-muted-foreground">{MEDIA_CATEGORY_LABEL[m.category]} · {m.patient.firstName} {m.patient.lastName} ({m.patient.caseNumber}) · {m.fileName} · {(m.sizeBytes / 1048576).toFixed(1)} MB · {m.reportStatus} · {m.scanStatus === "NOT_SCANNED" ? "not malware-scanned" : m.scanStatus}{m.releasedToPatientAt ? " · released" : ""}</p></div>
              <Button size="xs" variant="outline" onClick={() => open(m.id, "view")}>Preview</Button>
              <Button size="xs" variant="outline" onClick={() => open(m.id, "download")}>Download</Button>
              {canReview && !["VERIFIED", "AMENDED"].includes(m.reportStatus) && <Button size="xs" variant="outline" onClick={() => change(m.id, { action: "reportStatus", reportStatus: "VERIFIED" })}>Verify report</Button>}
              {canRelease && !m.releasedToPatientAt && ["VERIFIED", "AMENDED"].includes(m.reportStatus) && <Button size="xs" onClick={() => change(m.id, { action: "release", confirmProtected: m.sensitivity === "SPECIALLY_PROTECTED" })}>{m.sensitivity === "SPECIALLY_PROTECTED" ? "Confirm policy & release protected file" : "Release"}</Button>}
              {canRelease && m.releasedToPatientAt && <Button size="xs" variant="outline" onClick={() => change(m.id, { action: "revoke" })}>Revoke release</Button>}
            </li>
          ))}</ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">The browser preview is not a diagnostic workstation. DICOM studies download for viewing in a compatible DICOM viewer; PACS/worklist integration requires configuration (see docs/HIS.md).</p>
    </div>
  );
}
