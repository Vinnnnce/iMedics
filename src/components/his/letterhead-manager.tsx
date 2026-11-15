"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, inputClass } from "./use-api";

export interface LetterheadBlockInput {
  name: string;
  title: string;
  registrationId: string;
  side: "left" | "right";
}

export interface LetterheadValues {
  id?: string;
  name: string;
  department: string;
  isDefault: boolean;
  displayName: string;
  headerLines: string;
  addressLine: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  registrationInfo: string;
  brandColor: string;
  footerText: string;
  logoUrl: string;
  /** Doctor mode: private storage key of the uploaded signature image. */
  signatureUrl: string;
  showQr: boolean;
  signatureBlocks: LetterheadBlockInput[];
}

export interface LetterheadRow {
  id: string;
  name: string;
  department: string | null;
  isDefault: boolean;
  displayName: string;
  headerLines: string[];
  addressLine: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  registrationInfo: string | null;
  brandColor: string;
  footerText: string | null;
  logoUrl: string | null;
  showQr: boolean;
  signatureBlocks: unknown;
  /** Private storage key of the owner's uploaded signature image. */
  signatureUrl: string | null;
}

const EMPTY: LetterheadValues = {
  name: "", department: "", isDefault: false, displayName: "", headerLines: "", addressLine: "", contactPhone: "",
  contactEmail: "", website: "", registrationInfo: "", brandColor: "#0F766E", footerText: "", logoUrl: "",
  showQr: true, signatureUrl: "", signatureBlocks: [],
};

function toValues(l: LetterheadRow): LetterheadValues {
  const blocks = Array.isArray(l.signatureBlocks) ? (l.signatureBlocks as Array<Record<string, unknown>>) : [];
  return {
    id: l.id, name: l.name, department: l.department ?? "", isDefault: l.isDefault, displayName: l.displayName,
    headerLines: l.headerLines.join("\n"), addressLine: l.addressLine ?? "", contactPhone: l.contactPhone ?? "",
    contactEmail: l.contactEmail ?? "", website: l.website ?? "", registrationInfo: l.registrationInfo ?? "",
    brandColor: l.brandColor, footerText: l.footerText ?? "", logoUrl: l.logoUrl ?? "", showQr: l.showQr, signatureUrl: l.signatureUrl ?? "",
    signatureBlocks: blocks.slice(0, 4).map((b) => ({
      name: typeof b.name === "string" ? b.name : "",
      title: typeof b.title === "string" ? b.title : "",
      registrationId: typeof b.registrationId === "string" ? b.registrationId : "",
      side: b.side === "right" ? "right" : "left",
    })),
  };
}

function payload(v: LetterheadValues) {
  return {
    name: v.name, displayName: v.displayName,
    ...(v.id ? {} : { headerLines: v.headerLines.split("\n").map((l) => l.trim()).filter(Boolean) }),
    addressLine: v.addressLine || null, contactPhone: v.contactPhone || null, contactEmail: v.contactEmail || null,
    website: v.website || null, registrationInfo: v.registrationInfo || null, brandColor: v.brandColor,
    footerText: v.footerText || null, logoUrl: v.logoUrl || null, showQr: v.showQr,
    signatureBlocks: v.signatureBlocks.filter((b) => b.name.trim()).map((b) => ({
      name: b.name.trim(), title: b.title.trim() || null, registrationId: b.registrationId.trim() || null, side: b.side,
    })),
  };
}

/**
 * Letterhead designer shared by the facility portal and the doctor portal.
 * `base` is the REST root ("/api/facility/his/letterheads" or
 * "/api/doctors/me/letterheads"); `facilityMode` adds the department selector.
 */
export function LetterheadManager({ base, facilityMode, letterheads }: { base: string; facilityMode: boolean; letterheads: LetterheadRow[] }) {
  const router = useRouter();
  const [v, setV] = useState<LetterheadValues | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Doctor mode: upload a handwritten signature image (PNG/JPEG, max 2 MB) to
  // private storage and attach the returned key to the letterhead on save.
  const uploadSignature = async (file: File) => {
    if (facilityMode || !v) return;
    if (file.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: "Signature image must be at most 2 MB." }); return; }
    setSignatureBusy(true); setMsg(null);
    try {
      const presigned = await api(`${base}/signature-image`, {
        method: "POST",
        body: { mimeType: file.type === "image/jpeg" ? "image/jpeg" : "image/png", sizeBytes: file.size },
      }) as { key: string; uploadUrl: string; headers: Record<string, string> };
      const put = await fetch(presigned.uploadUrl, { method: "PUT", headers: presigned.headers, body: file });
      if (!put.ok) throw new Error("The signature image could not be uploaded");
      setV({ ...v, signatureUrl: presigned.key });
      setMsg({ ok: true, text: "Signature image uploaded — save to attach it to the letterhead." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error && err.message ? err.message : "The signature image could not be uploaded" });
    } finally {
      setSignatureBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!v) return;
    setBusy(true); setMsg(null);
    try {
      const body = {
        ...payload(v),
        ...(facilityMode ? { department: v.department || null } : { signatureUrl: v.signatureUrl || null }),
        ...(v.isDefault ? { isDefault: true } : {}),
      };
      await api(v.id ? `${base}/${v.id}` : base, { method: v.id ? "PATCH" : "POST", body });
      setMsg({ ok: true, text: v.id ? "Letterhead updated." : "Letterhead created." });
      setV(null); router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true); setMsg(null);
    try {
      await api(`${base}/${id}`, { method: "DELETE" });
      setMsg({ ok: true, text: "Letterhead deleted." }); router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally { setBusy(false); }
  };

  const makeDefault = async (id: string) => {
    setBusy(true); setMsg(null);
    try {
      await api(`${base}/${id}`, { method: "PATCH", body: { isDefault: true } });
      setMsg({ ok: true, text: "Default letterhead set." }); router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally { setBusy(false); }
  };

  const f = (k: keyof LetterheadValues, label: string, type = "text") => (
    <label className="text-xs">{label}
      <input type={type} className={inputClass} value={String(v?.[k] ?? "")} onChange={(e) => setV(v && { ...v, [k]: type === "color" ? e.target.value : e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button data-testid="button-new-letterhead" onClick={() => { setV({ ...EMPTY, isDefault: letterheads.length === 0 }); setMsg(null); }}>New letterhead</Button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {letterheads.map((l) => (
          <li key={l.id} data-testid={`letterhead-${l.name}`} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold" style={{ color: l.brandColor }}>{l.displayName}</p>
                <p className="text-xs text-muted-foreground">{l.name}{l.department ? ` · ${l.department}` : ""}{l.isDefault ? " · default" : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l.headerLines.join(" · ") || "No letterhead lines"}</p>
              </div>
              <span className="h-6 w-6 shrink-0 rounded-full border" style={{ backgroundColor: l.brandColor }} aria-label="Brand color" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" data-testid={`button-edit-${l.name}`} disabled={busy} onClick={() => { setV(toValues(l)); setMsg(null); }}>Edit</Button>
              {!l.isDefault && <Button variant="outline" size="sm" disabled={busy} onClick={() => makeDefault(l.id)}>Make default</Button>}
              <a
                data-testid={`link-preview-${l.name}`}
                className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
                href={`${base}/${l.id}/preview`}
                target="_blank"
                rel="noreferrer"
              >Preview PDF</a>
              <Button variant="outline" size="sm" data-testid={`button-delete-${l.name}`} disabled={busy} onClick={() => remove(l.id)}>Delete</Button>
            </div>
          </li>
        ))}
        {letterheads.length === 0 && <li className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No letterheads yet — create one to brand your documents.</li>}
      </ul>

      {v && (
        <form className="space-y-4 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <h2 className="text-sm font-semibold">{v.id ? `Edit “${v.name}”` : "New letterhead"}</h2>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Profile name (internal)
              <input className={inputClass} required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </label>
            <label className="text-xs">Document display name
              <input className={inputClass} required value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
            </label>
            {facilityMode && (
              <label className="text-xs">Department (optional — letterheads can be per department)
                <input className={inputClass} placeholder="e.g. Cardiology" value={v.department} onChange={(e) => setV({ ...v, department: e.target.value })} />
              </label>
            )}
            {f("brandColor", "Brand colour", "color")}
            {f("logoUrl", "Logo URL (https)")}
            {f("website", "Website")}
            {f("registrationInfo", "Registration / accreditation info")}
            {f("addressLine", "Address")}
            {f("contactPhone", "Phone")}
            {f("contactEmail", "Email")}
            {f("footerText", "Document footer")}
            <label className="text-xs sm:col-span-2">Letterhead lines (one per line, max 5)
              <textarea className="w-full rounded-lg border border-input bg-background p-2 text-sm" rows={3} value={v.headerLines} onChange={(e) => setV({ ...v, headerLines: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.showQr} onChange={(e) => setV({ ...v, showQr: e.target.checked })} /> Print verification QR code on finalized documents</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.isDefault} onChange={(e) => setV({ ...v, isDefault: e.target.checked })} /> Use as default letterhead</label>
            {!facilityMode && (
              <div className="space-y-1 sm:col-span-2">
                <span className="text-xs">Handwritten signature image (PNG or JPEG, max 2 MB)</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    data-testid="input-signature-image"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="text-xs"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadSignature(file); }}
                  />
                  {signatureBusy && <span className="text-xs text-muted-foreground">Uploading…</span>}
                  {v.signatureUrl && v.id && (
                    // eslint-disable-next-line @next/next/no-img-element -- private authenticated stream, not an asset
                    <img src={`${base}/${v.id}/signature-image`} alt="Current signature image" className="h-12 border bg-white p-1" data-testid="img-signature-preview" />
                  )}
                  {v.signatureUrl && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, signatureUrl: "" })}>Remove signature image</Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The image is stored privately and printed above the signature line on finalized consultation reports.
                </p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Signature blocks (up to 4)</legend>
            {v.signatureBlocks.map((b, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-4">
                <input className={inputClass} placeholder="Name" value={b.name} onChange={(e) => setV({ ...v, signatureBlocks: v.signatureBlocks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className={inputClass} placeholder="Professional title" value={b.title} onChange={(e) => setV({ ...v, signatureBlocks: v.signatureBlocks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <input className={inputClass} placeholder="Registration no." value={b.registrationId} onChange={(e) => setV({ ...v, signatureBlocks: v.signatureBlocks.map((x, j) => (j === i ? { ...x, registrationId: e.target.value } : x)) })} />
                <div className="flex gap-1">
                  <select className={inputClass} value={b.side} onChange={(e) => setV({ ...v, signatureBlocks: v.signatureBlocks.map((x, j) => (j === i ? { ...x, side: e.target.value as "left" | "right" } : x)) })} aria-label="Side">
                    <option value="left">Left</option><option value="right">Right</option>
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, signatureBlocks: v.signatureBlocks.filter((_, j) => j !== i) })}>Remove</Button>
                </div>
              </div>
            ))}
            {v.signatureBlocks.length < 4 && <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, signatureBlocks: [...v.signatureBlocks, { name: "", title: "", registrationId: "", side: v.signatureBlocks.length % 2 ? "right" : "left" }] })}>Add signature block</Button>}
          </fieldset>

          <div className="rounded-xl border p-4" style={{ borderTopColor: v.brandColor, borderTopWidth: 3 }}>
            <p className="text-lg font-bold" style={{ color: v.brandColor }}>{v.displayName || "Facility display name"}</p>
            {v.headerLines.split("\n").filter(Boolean).map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l}</p>)}
            {v.registrationInfo && <p className="text-[10px] text-muted-foreground">{v.registrationInfo}</p>}
            {v.website && <p className="text-[10px] text-muted-foreground">{v.website}</p>}
            {(v.addressLine || v.contactPhone || v.contactEmail) && (
              <p className="text-xs text-muted-foreground">{[v.addressLine, [v.contactPhone, v.contactEmail].filter(Boolean).join(" · ")].filter(Boolean).join(" · ")}</p>
            )}
            <hr className="my-2" style={{ borderColor: v.brandColor }} />
            <p className="text-xs text-muted-foreground">Document preview — header as it will print on every page.</p>
            {v.showQr && <p className="mt-1 text-[10px] text-muted-foreground">A verification QR code prints on the first page of finalized documents.</p>}
            {v.footerText && <p className="mt-2 text-[10px] text-muted-foreground">Footer: {v.footerText}</p>}
          </div>

          <div className="flex gap-2">
            <Button type="submit" data-testid="button-save-letterhead" disabled={busy}>{v.id ? "Save changes" : "Create letterhead"}</Button>
            <Button type="button" variant="outline" onClick={() => setV(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
