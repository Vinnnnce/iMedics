import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface ReportPdfInput {
  title: string;
  facilityName: string;
  orderNumber: string;
  patient: { name: string; caseNumber: string; sex: string; dateOfBirth: string };
  requestedBy: string;
  priority: string;
  indication?: string | null;
  technique?: string | null;
  findings?: string | null;
  impression?: string | null;
  conclusion?: string | null;
  recommendations?: string | null;
  observations: { name: string; value: string; unit?: string | null; range?: string | null; flag?: string | null }[];
  reporter?: string | null;
  credentials?: string | null;
  verifiedAt?: string | null;
  signedAt?: string | null;
  releasedAt?: string | null;
  version: number;
  amendmentReason?: string | null;
}

/** pdf-lib's standard fonts only encode WinAnsi; replace anything else rather than fail. */
const clean = (t: string) => t.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Only RELEASED reports are ever rendered; the caller is responsible for that check. */
export async function renderReportPdf(r: ReportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (needed: number) => { if (y - needed < M + 30) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (t: string, opts: { size?: number; bold?: boolean; x?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    for (const line of wrap(t, f, size, W - M * 2 - (opts.x ?? 0))) {
      ensure(size + 4);
      page.drawText(line, { x: M + (opts.x ?? 0), y, size, font: f, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
      y -= size + 4;
    }
  };
  const section = (label: string, body?: string | null) => { if (!body?.trim()) return; y -= 6; text(label.toUpperCase(), { size: 9, bold: true, color: [0.05, 0.4, 0.35] }); text(body); };

  text(r.facilityName, { size: 15, bold: true });
  text(r.title, { size: 12, bold: true, color: [0.05, 0.4, 0.35] });
  if (r.version > 1) text(`AMENDED REPORT - version ${r.version}${r.amendmentReason ? `: ${r.amendmentReason}` : ""}`, { size: 9, bold: true, color: [0.7, 0.2, 0.1] });
  y -= 4;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: rgb(0.8, 0.8, 0.8) }); y -= 14;
  text(`Patient: ${r.patient.name}   |   Case no: ${r.patient.caseNumber}   |   Sex: ${r.patient.sex}   |   DOB: ${r.patient.dateOfBirth}`);
  text(`Order: ${r.orderNumber}   |   Requested by: ${r.requestedBy}   |   Priority: ${r.priority}`);

  section("Clinical indication", r.indication);
  section("Technique", r.technique);

  if (r.observations.length) {
    y -= 8;
    const cols = [0, 220, 300, 360, 470];
    ensure(20);
    ["Test", "Result", "Unit", "Reference", "Flag"].forEach((h, i) => page.drawText(h, { x: M + cols[i], y, size: 9, font: bold }));
    y -= 14;
    for (const o of r.observations) {
      ensure(14);
      const abnormal = !!o.flag && o.flag !== "NORMAL";
      [o.name, o.value, o.unit ?? "", o.range ?? "", o.flag && o.flag !== "NORMAL" ? o.flag.replace("_", " ") : ""].forEach((c, i) =>
        page.drawText(clean(c).slice(0, i === 0 ? 40 : 22), { x: M + cols[i], y, size: 9, font: abnormal && i !== 2 && i !== 3 ? bold : font, color: abnormal ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.1, 0.1) }));
      y -= 13;
    }
  }

  section("Findings", r.findings);
  section("Impression", r.impression);
  section("Conclusion", r.conclusion);
  section("Recommendations", r.recommendations);

  ensure(80); y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: rgb(0.8, 0.8, 0.8) }); y -= 14;
  text(`Reported by: ${r.reporter ?? "-"}${r.credentials ? ` (${r.credentials})` : ""}`, { bold: true });
  text(`Verified: ${r.verifiedAt ?? "-"}   |   Digitally signed: ${r.signedAt ?? "-"}   |   Released: ${r.releasedAt ?? "-"}`, { size: 9 });
  text("This is an electronically verified and signed report issued through Medic1905. It is valid without a handwritten signature.", { size: 8, color: [0.4, 0.4, 0.4] });
  return doc.save();
}
