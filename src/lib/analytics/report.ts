/**
 * Reports: any dashboard can be generated as a report and exported to CSV, Excel (.xlsx), PDF or print.
 *
 * A report states its period, scope, comparison basis, calculation definitions, data gaps and
 * generation date, so a printed figure can always be traced back to how it was calculated.
 */
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Writer, loadPdfFonts, PAGE_SIZES } from "@/lib/his/pdf";
import { getMetric } from "./registry";
import { DASHBOARD_RULES } from "./scope";
import type { DashboardKey, DashboardPayload, KpiValue, Visual } from "./types";

export type Cell = string | number | null;

export interface ReportTable { title: string; question?: string; note?: string; columns: string[]; rows: Cell[][] }

export interface ReportDocument {
  title: string;
  dashboard: DashboardKey;
  facility: string;
  period: { label: string; startDate: string; endDate: string; timeZone: string };
  comparison: { label: string; startDate: string; endDate: string } | null;
  likeForLike: boolean;
  scope: string;
  generatedAt: string;
  tables: ReportTable[];
  definitions: { name: string; formula: string; numerator?: string; denominator?: string; source: string; eventDate: string; inclusion: string; exclusion: string; caveat?: string; updated: string }[];
  gaps: { indicator: string; reason: string }[];
}

/** Report categories shown in the Reports centre. */
export const REPORT_CATALOGUE: { category: string; reports: { key: DashboardKey; description: string }[] }[] = [
  { category: "Clinical", reports: [
    { key: "hospital", description: "Attendance, admissions, discharges, transfers, length of stay, readmissions, bed use" },
    { key: "mortality", description: "Inpatient mortality with denominators, outcomes and readmissions" },
    { key: "emergency", description: "Emergency arrivals, triage, waiting, flow" },
  ] },
  { category: "Staffing", reports: [
    { key: "nursing", description: "Nursing tasks, observations, assessments, handovers, medication administration" },
    { key: "doctors", description: "Clinical staff activity and documentation" },
    { key: "departments", description: "Department performance management" },
  ] },
  { category: "Operational", reports: [
    { key: "laboratory", description: "Laboratory workload, turnaround, rejection, QC, equipment, reagents" },
    { key: "diagnostic", description: "Diagnostic requests, modality performance and reporting turnaround" },
    { key: "pharmacy", description: "Orders, dispensing, stock, expiry, procurement" },
    { key: "overview", description: "Executive overview of organisational performance" },
  ] },
  { category: "Financial", reports: [{ key: "financial", description: "Revenue, outstanding payments, refunds, claims" }] },
  { category: "Quality", reports: [{ key: "quality", description: "Documentation, critical alerts, ratings, data completeness" }] },
  { category: "Forecasting", reports: [{ key: "forecast", description: "Predictions and recommendations (not verified facts)" }] },
];

export const REPORT_KEYS: DashboardKey[] = REPORT_CATALOGUE.flatMap((c) => c.reports.map((r) => r.key));

const UNIT_SUFFIX: Record<string, string> = { percent: "%", minutes: " min", hours: " h", days: " days" };

export function formatValue(v: number | null, unit: string): string {
  if (v === null) return "no data";
  const n = Number.isInteger(v) ? String(v) : v.toFixed(unit === "percent" ? 1 : 2).replace(/\.?0+$/, "");
  return `${n}${UNIT_SUFFIX[unit] ?? ""}`;
}

function kpiTable(kpis: KpiValue[], hasPrev: boolean): ReportTable {
  return {
    title: "Key indicators",
    columns: hasPrev ? ["Indicator", "Value", "Unit", "Numerator", "Denominator", "Previous period", "Change", "Change %", "Note"] : ["Indicator", "Value", "Unit", "Numerator", "Denominator", "Note"],
    rows: kpis.map((k) => hasPrev
      ? [k.label, k.value, k.unit, k.numerator ?? null, k.denominator ?? null, k.change?.previous ?? null, k.change?.delta ?? null, k.change?.percent ?? null, k.note ?? null]
      : [k.label, k.value, k.unit, k.numerator ?? null, k.denominator ?? null, k.note ?? null]),
  };
}

function visualTable(title: string, question: string, visual: Visual, note?: string): ReportTable | null {
  const base = { title, question, note };
  switch (visual.type) {
    case "table": return { ...base, note: note ?? visual.footnote, columns: visual.columns.map((c) => c.label), rows: visual.rows.map((r) => visual.columns.map((c) => r[c.key] ?? null)) };
    case "bars": return { ...base, columns: ["Category", "Value", "Previous"], rows: visual.items.map((i) => [i.label, i.value, i.previous ?? null]) };
    case "donut": return { ...base, columns: ["Category", "Value"], rows: visual.items.map((i) => [i.label, i.value]) };
    case "funnel": return { ...base, columns: ["Step", "Count"], rows: visual.steps.map((s) => [s.label, s.value]) };
    case "stacked": return { ...base, columns: ["Category", ...visual.keys], rows: visual.items.map((i) => [i.label, ...visual.keys.map((k) => i.values[k] ?? 0)]) };
    case "line": {
      const xs = [...new Set(visual.series.flatMap((s) => s.points.map((p) => p.x)))].sort();
      return { ...base, columns: ["Period", ...visual.series.map((s) => s.name)], rows: xs.map((x) => [x, ...visual.series.map((s) => s.points.find((p) => p.x === x)?.y ?? null)]) };
    }
    case "heatmap": return { ...base, columns: ["", ...visual.cols], rows: visual.rows.map((r, i) => [r, ...visual.values[i]]) };
    case "calendar": return { ...base, columns: ["Date", "Value"], rows: visual.days.map((d) => [d.date, d.value]) };
    case "progress": return { ...base, columns: ["Indicator", "Actual", "Target", "Direction", "Status"], rows: visual.items.map((i) => [i.label, i.actual, i.target, i.direction === "AT_LEAST" ? "at least" : "at most", i.status]) };
    case "beds": return { ...base, columns: ["Ward", "Class", "Beds", "In service", "Occupied", "Pending discharge"], rows: visual.wards.map((w) => [w.name, w.className, w.beds.length, w.inService, w.occupied, w.pendingDischarge]) };
    case "definitions": return null;
  }
}

export function buildReportDocument(payload: DashboardPayload, scopeNote: string): ReportDocument {
  const keys = new Set<string>(payload.kpis.map((k) => k.key));
  for (const s of payload.sections) if (s.visual.type === "definitions") s.visual.items.forEach((i) => keys.add(i.key));
  const definitions = [...keys].flatMap((key) => {
    const d = getMetric(key);
    return d ? [{ name: d.name, formula: d.formula, numerator: d.numerator, denominator: d.denominator, source: d.dataSource, eventDate: d.eventDate, inclusion: d.inclusion, exclusion: d.exclusion, caveat: d.caveat, updated: d.lastUpdated }] : [];
  });
  const tables: ReportTable[] = [];
  if (payload.kpis.length) tables.push(kpiTable(payload.kpis, payload.range.previous !== null));
  for (const s of payload.sections) { const t = visualTable(s.title, s.question, s.visual, s.note); if (t && t.rows.length) tables.push(t); }
  return {
    title: `${DASHBOARD_RULES[payload.dashboard].label} report`, dashboard: payload.dashboard, facility: payload.facility.name,
    period: { label: payload.range.current.label, startDate: payload.range.current.startDate, endDate: payload.range.current.endDate, timeZone: payload.range.timeZone },
    comparison: payload.range.previous ? { label: payload.range.previous.label, startDate: payload.range.previous.startDate, endDate: payload.range.previous.endDate } : null,
    likeForLike: payload.range.likeForLike, scope: scopeNote, generatedAt: payload.computedAt, tables, definitions, gaps: payload.gaps,
  };
}

export const reportRowCount = (d: ReportDocument) => d.tables.reduce((s, t) => s + t.rows.length, 0);

function metaLines(d: ReportDocument): [string, string][] {
  return [
    ["Report", d.title], ["Facility", d.facility], ["Reporting period", `${d.period.label} (${d.period.startDate} to ${d.period.endDate}, ${d.period.timeZone})`],
    ["Comparison period", d.comparison ? `${d.comparison.label} (${d.comparison.startDate} to ${d.comparison.endDate})${d.likeForLike ? " — same elapsed days as the period in progress" : ""}` : "None"],
    ["Data scope", d.scope], ["Generated", d.generatedAt],
  ];
}

/* ───────────────────────── CSV ───────────────────────── */

/** Spreadsheet programs run cells that start with these characters as formulas; neutralise them. */
export function safeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
}
const csvEscape = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
const csvLine = (cells: Cell[]) => cells.map((c) => csvEscape(safeCell(c))).join(",");

export function toCsv(d: ReportDocument): string {
  const out: string[] = [];
  for (const [k, v] of metaLines(d)) out.push(csvLine([k, v]));
  for (const t of d.tables) { out.push(""); out.push(csvLine([t.title])); if (t.note) out.push(csvLine([`Note: ${t.note}`])); out.push(csvLine(t.columns)); for (const r of t.rows) out.push(csvLine(r)); }
  if (d.definitions.length) { out.push(""); out.push(csvLine(["Calculation definitions"])); out.push(csvLine(["Metric", "Formula", "Numerator", "Denominator", "Data source", "Event date", "Included", "Excluded", "Caveat", "Last updated"])); for (const m of d.definitions) out.push(csvLine([m.name, m.formula, m.numerator ?? null, m.denominator ?? null, m.source, m.eventDate, m.inclusion, m.exclusion, m.caveat ?? null, m.updated])); }
  if (d.gaps.length) { out.push(""); out.push(csvLine(["Indicators not available (data not recorded)"])); for (const g of d.gaps) out.push(csvLine([g.indicator, g.reason])); }
  return "\uFEFF" + out.join("\r\n") + "\r\n";
}

/* ───────────────────────── XLSX (no dependency: minimal OOXML in a store-only zip) ───────────────────────── */

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf: Uint8Array): number { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]; const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...name]);
    chunks.push(local, f.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + f.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end]; const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0)); let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

const xmlEscape = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function sheetXml(rows: Cell[][]): string {
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((c, i) => {
    const ref = `${colName(i)}${r + 1}`;
    if (c === null || c === undefined || c === "") return "";
    if (typeof c === "number" && Number.isFinite(c)) return `<c r="${ref}"><v>${c}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(safeCell(c))}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="44" customWidth="1"/><col min="2" max="12" width="18" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}

export function toXlsx(d: ReportDocument): Uint8Array {
  const enc = new TextEncoder();
  const sheets: { name: string; rows: Cell[][] }[] = [];
  const summary: Cell[][] = metaLines(d).map(([k, v]) => [k, v]);
  summary.push([], ["Calculation definitions"], ["Metric", "Formula", "Numerator", "Denominator", "Data source", "Event date", "Included", "Excluded", "Caveat", "Last updated"]);
  for (const m of d.definitions) summary.push([m.name, m.formula, m.numerator ?? null, m.denominator ?? null, m.source, m.eventDate, m.inclusion, m.exclusion, m.caveat ?? null, m.updated]);
  if (d.gaps.length) { summary.push([], ["Indicators not available (data not recorded)"]); for (const g of d.gaps) summary.push([g.indicator, g.reason]); }
  sheets.push({ name: "About this report", rows: summary });
  const used = new Set(["About this report"]);
  for (const t of d.tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
    for (let n = 2; used.has(name.toLowerCase()) || used.has(name); n++) name = `${name.slice(0, 28)} ${n}`;
    used.add(name);
    const rows: Cell[][] = [[t.title]]; if (t.note) rows.push([t.note]); rows.push(t.columns, ...t.rows);
    sheets.push({ name, rows });
  }
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s.rows)) })),
  ];
  return zipStore(files);
}

/* ───────────────────────── PDF ───────────────────────── */

const cellText = (c: Cell) => (c === null ? "—" : typeof c === "number" ? String(c) : c);

export async function toPdf(d: ReportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await loadPdfFonts();
  const font = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const size = PAGE_SIZES.A4;
  const w = new Writer(pdf, size, font, bold, (wr) => { wr.page.drawText(`Medic1905 · ${d.facility} · ${d.title}`, { x: wr.margin, y: size[1] - 30, size: 8, font }); });
  w.newPage();
  w.text(d.title, { size: 16, bold: true }); w.gap(4);
  for (const [k, v] of metaLines(d)) w.text(`${k}: ${v}`, { size: 9 });
  w.rule();
  for (const t of d.tables) {
    w.gap(6); w.text(t.title, { size: 12, bold: true });
    if (t.question) w.text(t.question, { size: 8, color: [0.4, 0.4, 0.4] });
    w.table(t.columns, t.rows.map((r) => r.map(cellText)));
    if (t.note) w.text(t.note, { size: 8, color: [0.35, 0.35, 0.35] });
  }
  if (d.definitions.length) { w.gap(8); w.text("How these figures are calculated", { size: 12, bold: true }); for (const m of d.definitions) { w.text(m.name, { size: 9, bold: true }); w.text(`${m.formula}${m.numerator ? ` — numerator: ${m.numerator}` : ""}${m.denominator ? `; denominator: ${m.denominator}` : ""}. Source: ${m.source}; counted on ${m.eventDate}. Included: ${m.inclusion}. Excluded: ${m.exclusion}.${m.caveat ? ` Caveat: ${m.caveat}` : ""}`, { size: 8 }); } }
  if (d.gaps.length) { w.gap(8); w.text("Indicators not available because the data is not recorded", { size: 12, bold: true }); for (const g of d.gaps) w.text(`• ${g.indicator} — ${g.reason}`, { size: 8 }); }
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: size[0] - 100, y: 24, size: 8, font }));
  return pdf.save();
}

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" };

export async function renderExport(d: ReportDocument, format: ExportFormat): Promise<Uint8Array> {
  if (format === "csv") return new TextEncoder().encode(toCsv(d));
  if (format === "xlsx") return toXlsx(d);
  return toPdf(d);
}

export function exportFilename(d: ReportDocument, format: ExportFormat): string {
  const slug = `${d.dashboard}-${d.period.startDate}_${d.period.endDate}`.replace(/[^a-z0-9_-]/gi, "-");
  return `medic1905-${slug}.${format}`;
}
