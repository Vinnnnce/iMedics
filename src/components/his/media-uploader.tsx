"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, MEDIA_CATEGORY_LABEL, resolveFormat } from "@/lib/his/media-formats";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass } from "./use-api";

interface UploadMetadata { category: string; examinationType: string; examinationAt: string; modality: string; bodySite: string; accessionNumber: string; orderingClinician: string; reportingClinician: string; reportStatus: string; sensitivity: string }
interface Item { id: string; file: File; patientId: string; patientCaseNumber: string; metadata: UploadMetadata; state: "queued" | "hashing" | "uploading" | "verifying" | "done" | "error"; progress: number; error?: string; allowDuplicate?: boolean }
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
    xhr.timeout = 15 * 60_000;
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status})`)));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Retry this file."));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

/** Bulk drag-and-drop diagnostic upload with checksum, progress, retry and metadata. */
export function MediaUploader({ canUpload, canRelease, canReview = false }: { canUpload: boolean; canRelease: boolean; canReview?: boolean }) {
  const [patient, setPatient] = useState<IdentifiedPatient | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<UploadMetadata>({ category: "XRAY", examinationType: "", examinationAt: "", modality: "", bodySite: "", accessionNumber: "", orderingClinician: "", reportingClinician: "", reportStatus: "UNREPORTED", sensitivity: "STANDARD" });
  const running = useRef(new Set<string>());
  const [listing, setListing] = useState<{ scope: string; items: MediaRow[] }>({ scope: "", items: [] });
  const selection = patient?.id ?? "all";
  const selectedScope = useRef(selection);
  useEffect(() => { selectedScope.current = selection; }, [selection]);
  const list = listing.scope === selection ? listing.items : [];
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const scope = patient?.id ?? "all";
    try {
      const d = await api<{ media: MediaRow[] }>(`/api/facility/his/media${patient ? `?patientId=${patient.id}` : ""}`);
      if (selectedScope.current === scope) setListing({ scope, items: d.media });
    } catch (e) { if (selectedScope.current === scope) setError(e instanceof Error ? e.message : "Failed"); }
  }, [patient]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  const update = useCallback((id: string, p: Partial<Item>) => setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...p } : x))), []);

  const uploadOne = useCallback(async (item: Item) => {
    const { id, file, patientId, metadata } = item;
    try {
      const resolved = resolveFormat(file.name, mimeOf(file));
      if ("error" in resolved) throw new Error(resolved.error);
      if (file.size < 1 || file.size > resolved.format.maxBytes) throw new Error("File is empty or exceeds this format's size limit");
      update(id, { state: "hashing", error: undefined, progress: 0 });
      const hash = await sha256(file);
      const type = mimeOf(file);
      const presign = await api<{ key: string; uploadUrl: string }>("/api/facility/his/media", { body: { patientId, fileName: file.name, mimeType: type, sizeBytes: file.size, sha256: hash, allowDuplicate: item.allowDuplicate ?? false } });
      update(id, { state: "uploading" });
      await put(presign.uploadUrl, file, type, (p) => update(id, { progress: p }));
      update(id, { state: "verifying" });
      await api("/api/facility/his/media/confirm", { body: { key: presign.key, patientId, fileName: file.name, mimeType: type, sha256: hash, category: metadata.category, examinationType: metadata.examinationType || file.name, examinationAt: metadata.examinationAt ? new Date(metadata.examinationAt).toISOString() : null, modality: metadata.modality || null, bodySite: metadata.bodySite || null, accessionNumber: metadata.accessionNumber || null, orderingClinician: metadata.orderingClinician || null, reportingClinician: metadata.reportingClinician || null, reportStatus: metadata.reportStatus, sensitivity: metadata.sensitivity } });
      update(id, { state: "done", progress: 100 });
      void load();
    } catch (e) { update(id, { state: "error", error: e instanceof Error ? e.message : "Upload failed" }); }
    finally { running.current.delete(id); }
  }, [load, update]);
  useEffect(() => {
    // Bounded concurrency prevents a large dropped batch from hashing every
    // file into memory or opening unbounded storage connections at once.
    for (const item of items) {
      if (running.current.size >= 2) break;
      if (item.state !== "queued" || running.current.has(item.id)) continue;
      running.current.add(item.id);
      void uploadOne(item);
    }
  }, [items, uploadOne]);
  const addFiles = (files: FileList | File[]) => {
    if (!patient) return;
    if (files.length > 20) { setError("Add at most 20 files per batch."); return; }
    if (items.filter((x) => !["done", "error"].includes(x.state)).length + files.length > 40) { setError("Wait for queued uploads to finish before adding more files."); return; }
    const next: Item[] = [...files].map((file) => {
      const resolved = resolveFormat(file.name, mimeOf(file));
      const reason = "error" in resolved ? resolved.error : file.size < 1 || file.size > resolved.format.maxBytes ? `File is empty or exceeds the ${Math.round(resolved.format.maxBytes / 1048576)} MB limit` : undefined;
      return { id: crypto.randomUUID(), file, patientId: patient.id, patientCaseNumber: patient.caseNumber, metadata: { ...meta }, state: reason ? "error" : "queued", progress: 0, error: reason };
    });
    setItems((arr) => {
      if (arr.filter((x) => !["done", "error"].includes(x.state)).length + next.length > 40) return arr;
      return [...arr, ...next];
    });
    setError(null);
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
          <p className="text-xs text-muted-foreground">Up to 20 files per batch, with two simultaneous uploads. Each file keeps the patient and metadata selected when it was added. Retry restarts that file; resumable multipart transfer is not enabled.</p>
          <ul className="space-y-1 text-xs">{items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
              <span className="text-muted-foreground">Patient: {it.patientCaseNumber}</span>
              <span>{it.state}{it.state === "uploading" ? ` ${it.progress}%` : ""}</span>
              {it.state === "error" && <><span className="text-destructive">{it.error}</span><Button size="xs" variant="outline" onClick={() => update(it.id, { state: "queued", error: undefined })}>Retry</Button>{it.error?.includes("already attached") && <Button size="xs" variant="ghost" onClick={() => update(it.id, { state: "queued", error: undefined, allowDuplicate: true })}>Upload anyway</Button>}</>}
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
              {canRelease && !m.releasedToPatientAt && m.scanStatus === "CLEAN" && ["VERIFIED", "AMENDED"].includes(m.reportStatus) && <Button size="xs" onClick={() => change(m.id, { action: "release", confirmProtected: m.sensitivity === "SPECIALLY_PROTECTED" })}>{m.sensitivity === "SPECIALLY_PROTECTED" ? "Confirm policy & release protected file" : "Release"}</Button>}
              {canRelease && m.releasedToPatientAt && <Button size="xs" variant="outline" onClick={() => change(m.id, { action: "revoke" })}>Revoke release</Button>}
            </li>
          ))}</ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">The browser preview is not a diagnostic workstation. DICOM studies download for viewing in a compatible DICOM viewer; PACS/worklist integration requires configuration (see docs/HIS.md).</p>
    </div>
  );
}
