"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, inputClass } from "./use-api";

export interface SettingsValues { displayName: string; letterheadLines: string; logoUrl: string; addressLine: string; contactPhone: string; contactEmail: string; defaultLanguage: string; dateFormat: string; documentNumberPrefix: string; pageSize: string; footerText: string; enabledModules: string[]; triageProtocol: string; triageCategories: string; overdueMinutes: number; independentTemplateApproval: boolean; defaultRetentionCategory: string; terminology: string }

const MODULES = ["EMERGENCY", "INPATIENT", "OUTPATIENT", "SURGERY", "LABORATORY", "IMAGING", "PHARMACY", "INSURANCE", "REHABILITATION"];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const t = (k: keyof SettingsValues, label: string, type = "text") => (
    <label className="text-xs">{label}<input type={type} className={inputClass} value={String(v[k])} onChange={(e) => setV({ ...v, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></label>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setMsg(null);
      let terminology: Record<string, string> = {};
      try { terminology = v.terminology.trim() ? JSON.parse(v.terminology) : {}; } catch { setMsg({ ok: false, text: "Terminology must be a JSON object" }); return; }
      try {
        await api("/api/facility/his/settings", { method: "PUT", body: {
          displayName: v.displayName || null, letterheadLines: v.letterheadLines.split("\n").map((l) => l.trim()).filter(Boolean), logoUrl: v.logoUrl || null,
          addressLine: v.addressLine || null, contactPhone: v.contactPhone || null, contactEmail: v.contactEmail || null, defaultLanguage: v.defaultLanguage,
          dateFormat: v.dateFormat, documentNumberPrefix: v.documentNumberPrefix, pageSize: v.pageSize, footerText: v.footerText || null, enabledModules: v.enabledModules,
          triageProtocol: v.triageProtocol || null, triageCategories: v.triageCategories.split(",").map((c) => c.trim()).filter(Boolean), overdueMinutes: v.overdueMinutes,
          independentTemplateApproval: v.independentTemplateApproval, defaultRetentionCategory: v.defaultRetentionCategory, terminology,
        } });
        setMsg({ ok: true, text: "Saved (new configuration version recorded)" }); router.refresh();
      } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" }); }
    }}>
      <fieldset className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Branding &amp; letterhead</legend>
        {t("displayName", "Hospital display name")}{t("logoUrl", "Logo URL (https)")}{t("addressLine", "Address")}{t("contactPhone", "Phone")}{t("contactEmail", "Email")}{t("footerText", "Document footer")}
        <label className="text-xs sm:col-span-2">Letterhead lines (one per line)<textarea className="w-full rounded-lg border p-2 text-sm" rows={3} value={v.letterheadLines} onChange={(e) => setV({ ...v, letterheadLines: e.target.value })} /></label>
      </fieldset>
      <fieldset className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-3"><legend className="px-1 text-sm font-semibold">Documents</legend>
        {t("documentNumberPrefix", "Document number prefix")}{t("defaultLanguage", "Default language (e.g. en, fr)")}
        <label className="text-xs">Date format<select className={inputClass} value={v.dateFormat} onChange={(e) => setV({ ...v, dateFormat: e.target.value })}>{["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="text-xs">Page size<select className={inputClass} value={v.pageSize} onChange={(e) => setV({ ...v, pageSize: e.target.value })}>{["A4", "LETTER", "A5"].map((d) => <option key={d}>{d}</option>)}</select></label>
        {t("defaultRetentionCategory", "Default retention category")}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.independentTemplateApproval} onChange={(e) => setV({ ...v, independentTemplateApproval: e.target.checked })} /> Template approval by someone other than the editor</label>
      </fieldset>
      <fieldset className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Operations</legend>
        {t("triageProtocol", "Approved local triage protocol name")}{t("triageCategories", "Triage categories (comma-separated, from that protocol)")}{t("overdueMinutes", "Overdue after (minutes without update)", "number")}
        <label className="text-xs sm:col-span-2">Terminology overrides (JSON, e.g. {"{\"ward\": \"Unit\"}"})<input className={inputClass} value={v.terminology} onChange={(e) => setV({ ...v, terminology: e.target.value })} /></label>
        <div className="flex flex-wrap gap-3 text-xs sm:col-span-2">{MODULES.map((m) => <label key={m} className="flex items-center gap-1"><input type="checkbox" checked={v.enabledModules.includes(m)} onChange={(e) => setV({ ...v, enabledModules: e.target.checked ? [...v.enabledModules, m] : v.enabledModules.filter((x) => x !== m) })} />{m}</label>)}</div>
      </fieldset>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      <Button type="submit" data-testid="button-save-settings">Save settings</Button>
    </form>
  );
}
