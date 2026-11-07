import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DocumentView } from "./documents";
import { displayValue } from "./documents";

/**
 * Server-side PDF rendering with embedded Unicode fonts (DejaVu Sans). Only
 * signatures that were actually recorded are printed; unmet required
 * signatures are printed as "not signed", and non-final documents carry a
 * watermark so a PDF can never look signed or verified when it is not.
 */

export const PAGE_SIZES: Record<string, [number, number]> = { A4: [595.28, 841.89], LETTER: [612, 792], A5: [419.53, 595.28] };
const SIGNATURE_ROLE_LABEL: Record<string, string> = {
  AUTHOR: "Author / responsible clinician", CO_SIGNER: "Co-signatory", REVIEWER: "Reviewer", VERIFIER: "Verifying clinician",
  DEPARTMENT_HEAD: "Head of department", PATIENT: "Patient", AUTHORIZED_REPRESENTATIVE: "Authorized representative",
  CLINICIAN_OBTAINING_CONSENT: "Clinician obtaining consent", WITNESS: "Witness", INTERPRETER: "Interpreter",
};
const METHOD_LABEL: Record<string, string> = {
  AUTHENTICATED_ELECTRONIC: "Authenticated electronic signature",
  HANDWRITTEN_ATTESTED: "Handwritten signature on paper, attested by staff",
};

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
export async function loadPdfFonts() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const [regular, bold] = await Promise.all([readFile(path.join(dir, "DejaVuSans.ttf")), readFile(path.join(dir, "DejaVuSans-Bold.ttf"))]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");

export class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(private pdf: PDFDocument, private size: [number, number], private font: PDFFont, private bold: PDFFont, private header: (w: Writer) => void) {}
  margin = 48;
  get width() { return this.size[0] - this.margin * 2; }
  newPage() {
    this.page = this.pdf.addPage(this.size);
    this.pages.push(this.page);
    this.y = this.size[1] - this.margin;
    this.header(this);
  }
  ensure(h: number) { if (this.y - h < this.margin + 30) this.newPage(); }
  wrap(text: string, size: number, font: PDFFont, width = this.width): string[] {
    const lines: string[] = [];
    for (const para of text.split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
        if (line) lines.push(line);
        line = word;
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, opts: { size?: number; bold?: boolean; x?: number; color?: [number, number, number]; width?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    for (const line of this.wrap(text, size, font, opts.width ?? this.width - (opts.x ?? 0))) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: this.margin + (opts.x ?? 0), y: this.y - size, size, font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
      this.y -= size + 4;
    }
  }
  rule() {
    this.ensure(8);
    this.page.drawLine({ start: { x: this.margin, y: this.y - 3 }, end: { x: this.margin + this.width, y: this.y - 3 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    this.y -= 8;
  }
  gap(h = 6) { this.y -= h; }
  table(columns: string[], rows: string[][]) {
    const size = 8;
    const colW = this.width / columns.length;
    const drawRow = (cells: string[], bold: boolean) => {
      const wrapped = cells.map((c) => this.wrap(c || "", size, bold ? this.bold : this.font, colW - 6));
      const h = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + 4;
      this.ensure(h);
      wrapped.forEach((lines, i) => lines.forEach((line, li) => this.page.drawText(line, { x: this.margin + i * colW + 3, y: this.y - size - 2 - li * (size + 3), size, font: bold ? this.bold : this.font })));
      this.page.drawRectangle({ x: this.margin, y: this.y - h, width: this.width, height: h, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5 });
      this.y -= h;
    };
    drawRow(columns, true);
    for (const r of rows) drawRow(columns.map((_, i) => r[i] ?? ""), false);
    this.gap(4);
  }
}

export async function renderDocumentsPdf(views: DocumentView[], options: { manifestTitle?: string } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f = await loadPdfFonts();
  const font = await pdf.embedFont(f.regular, { subset: true });
  const bold = await pdf.embedFont(f.bold, { subset: true });
  pdf.setProducer("Medic1905 HIS");
  pdf.setTitle(views.length === 1 ? `${views[0].title} ${views[0].documentNumber}` : options.manifestTitle ?? "Medical records package");

  const allPages: { page: PDFPage; label: string }[] = [];

  if (views.length > 1 || options.manifestTitle) {
    const size = PAGE_SIZES.A4;
    const w = new Writer(pdf, size, font, bold, () => undefined);
    w.newPage();
    w.text(options.manifestTitle ?? "Medical records package", { size: 16, bold: true });
    w.text(`Patient: ${views[0]?.patient.name ?? ""} · ${views[0]?.patient.caseNumber ?? ""}`, { size: 10 });
    w.text(`Generated ${fmt(new Date().toISOString())}. Index and manifest of included documents (content hashes are SHA-256 of the finalized content).`, { size: 8, color: [0.35, 0.35, 0.35] });
    w.gap(6);
    w.table(["#", "Document number", "Title", "Status", "Finalized", "Content hash"], views.map((v, i) => [String(i + 1), v.documentNumber, v.title, v.statusLabel, fmt(v.finalizedAt), v.contentHash ?? "—"]));
    w.pages.forEach((p) => allPages.push({ page: p, label: "Index" }));
  }

  for (const v of views) {
    const size = PAGE_SIZES[v.facility.pageSize] ?? PAGE_SIZES.A4;
    const header = (w: Writer) => {
      w.text(v.facility.name, { size: 13, bold: true });
      for (const line of v.facility.letterhead) w.text(line, { size: 8, color: [0.35, 0.35, 0.35] });
      if (v.facility.address) w.text(v.facility.address, { size: 8, color: [0.35, 0.35, 0.35] });
      if (v.facility.contact) w.text(v.facility.contact, { size: 8, color: [0.35, 0.35, 0.35] });
      w.text(`Patient: ${v.patient.name} · ${v.patient.caseNumber} · DOB ${v.patient.dateOfBirth} · ${v.patient.gender.toLowerCase()}${v.encounterNumber ? ` · Encounter ${v.encounterNumber}` : ""}`, { size: 8 });
      w.rule();
    };
    const w = new Writer(pdf, size, font, bold, header);
    w.newPage();
    w.text(v.title, { size: 15, bold: true });
    w.text(`${v.groupTitle} · ${v.documentNumber} · revision ${v.revision} · template v${v.templateVersion} · status: ${v.statusLabel}`, { size: 8, color: [0.3, 0.3, 0.3] });
    if (v.department) w.text(`Department: ${v.department}`, { size: 8, color: [0.3, 0.3, 0.3] });
    if (v.supersedes) w.text(`Amendment of ${v.supersedes.documentNumber}. Reason: ${v.amendmentReason ?? "—"}`, { size: 9, bold: true, color: [0.6, 0.3, 0] });
    if (v.supersededBy) w.text(`This document was superseded by amendment ${v.supersededBy.documentNumber}.`, { size: 9, bold: true, color: [0.7, 0, 0] });
    w.gap(4);

    for (const section of v.sections) {
      w.ensure(40);
      w.text(section.title, { size: 11, bold: true });
      for (const field of section.fields) {
        if (field.type === "table") {
          w.text(field.label, { size: 9, bold: true });
          const rows = Array.isArray(field.value) ? (field.value as unknown[]).filter(Array.isArray) as string[][] : [];
          if (rows.length) w.table(field.columns ?? [], rows); else w.text("—", { size: 9 });
          continue;
        }
        w.text(field.label, { size: 9, bold: true });
        w.text(displayValue(field.value, field.unit), { size: 9, x: 8 });
      }
      w.gap(4);
    }

    w.ensure(80);
    w.rule();
    w.text("Authorship, verification and signatures", { size: 11, bold: true });
    w.text(`Author: ${v.author.name} · created ${fmt(v.createdAt)}`, { size: 9 });
    w.text(v.reviewedAt ? `Clinically verified by ${v.reviewedByName ?? "—"} at ${fmt(v.reviewedAt)}` : "Clinical verification: not performed / not required", { size: 9 });
    const valid = v.signatures.filter((s) => s.valid);
    if (valid.length === 0) w.text("No signatures recorded.", { size: 9, bold: true, color: [0.7, 0, 0] });
    for (const s of valid) {
      w.text(`${SIGNATURE_ROLE_LABEL[s.role] ?? s.role}: ${s.signerName}${s.signerTitle ? `, ${s.signerTitle}` : ""}${s.registrationId ? ` · Reg. ${s.registrationId}` : ""}${s.relationship ? ` · ${s.relationship}` : ""}`, { size: 9, bold: true });
      w.text(`${METHOD_LABEL[s.method] ?? s.method} · ${fmt(s.signedAt)} · ref ${s.id.slice(0, 8)}`, { size: 8, x: 8, color: [0.3, 0.3, 0.3] });
    }
    for (const missing of v.missingSignatureLabels) w.text(`${missing}: NOT SIGNED`, { size: 9, color: [0.7, 0, 0] });
    w.text(
      v.status === "FINAL" || v.status === "AMENDED"
        ? `Finalized ${fmt(v.finalizedAt)} · content SHA-256 ${v.contentHash}`
        : "This document is not finalized.",
      { size: 8, color: [0.3, 0.3, 0.3] },
    );
    if (v.definition.output.footerNote) w.text(v.definition.output.footerNote, { size: 8, color: [0.3, 0.3, 0.3] });

    for (const p of w.pages) {
      allPages.push({ page: p, label: v.documentNumber });
      if (v.watermark) {
        const [pw, ph] = size;
        p.drawText(v.watermark, { x: pw * 0.12, y: ph * 0.3, size: 26, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.25, rotate: degrees(35) });
      }
    }
    void v.facility.footer;
  }

  allPages.forEach(({ page, label }, i) => {
    const { width } = page.getSize();
    const view = views.find((v) => v.documentNumber === label);
    const footer = `${label}${view?.facility.footer ? ` · ${view.facility.footer}` : ""} · Page ${i + 1} of ${allPages.length}`;
    page.drawText(footer, { x: 48, y: 24, size: 7, font, color: rgb(0.4, 0.4, 0.4), maxWidth: width - 96 });
  });

  return pdf.save();
}
