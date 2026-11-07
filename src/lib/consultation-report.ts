import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ConsultationWithRelations } from "@/lib/consultation";
import { PAGE_SIZES, Writer, loadPdfFonts } from "@/lib/his/pdf";

/** The clinical content of a report as it stood at one revision. */
export interface ConsultationSnapshot {
  revision: number;
  chiefComplaint: string | null;
  historyPresentIllness: string | null;
  pastMedicalHistory: string | null;
  symptoms: unknown;
  vitals: unknown;
  examination: string | null;
  diagnosis: string | null;
  icd: { code: string; description: string } | null;
  differentialDiagnosis: string | null;
  labFindings: string | null;
  imagingFindings: string | null;
  treatmentPlan: string | null;
  recommendations: string | null;
  followUpDate: string | null;
  notes: string | null;
  finalizedAt: string | null;
  amendedAt: string | null;
}

/** Captures the editable content of a consultation, stored before each amendment. */
export function snapshotConsultation(c: ConsultationWithRelations): ConsultationSnapshot {
  return {
    revision: c.revision,
    chiefComplaint: c.chiefComplaint,
    historyPresentIllness: c.historyPresentIllness,
    pastMedicalHistory: c.pastMedicalHistory,
    symptoms: c.symptoms,
    vitals: c.vitals,
    examination: c.examination,
    diagnosis: c.diagnosis,
    icd: c.icd ? { code: c.icd.code, description: c.icd.description } : null,
    differentialDiagnosis: c.differentialDiagnosis,
    labFindings: c.labFindings,
    imagingFindings: c.imagingFindings,
    treatmentPlan: c.treatmentPlan,
    recommendations: c.recommendations,
    followUpDate: c.followUpDate ? c.followUpDate.toISOString() : null,
    notes: c.notes,
    finalizedAt: c.finalizedAt ? c.finalizedAt.toISOString() : null,
    amendedAt: c.amendedAt ? c.amendedAt.toISOString() : null,
  };
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");
const GREY: [number, number, number] = [0.35, 0.35, 0.35];

interface Symptom { name?: string; duration?: string; severity?: string }

function asSymptoms(value: unknown): Symptom[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Symptom[]) : [];
}

function asVitals(value: unknown): [string, string][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => [k, String(v)]);
}

/**
 * Renders a consultation report as a PDF. Finalized reports print as issued
 * (with the revision and amendment date when amended); drafts carry a DRAFT
 * watermark so they can never be mistaken for an issued report.
 */
export async function renderConsultationPdf(c: ConsultationWithRelations): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await loadPdfFonts();
  const font = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const finalized = c.status === "FINALIZED";
  const reportNumber = c.id.slice(0, 8).toUpperCase();

  pdf.setProducer("Medic1905");
  pdf.setTitle(`Consultation report ${reportNumber}`);

  const size = PAGE_SIZES.A4;
  const w = new Writer(pdf, size, font, bold, (writer) => {
    writer.text("Medic1905 — Consultation report", { size: 13, bold: true });
    writer.text(`Patient: ${patientName} · ${c.patient.caseNumber} · DOB ${day(c.patient.dateOfBirth)} · ${c.patient.gender.toLowerCase()}`, { size: 8 });
    writer.rule();
  });
  w.newPage();

  w.text(`Report ${reportNumber} · revision ${c.revision} · ${finalized ? "Finalized" : "DRAFT"}`, { size: 9, color: GREY });
  w.text(`Doctor: ${c.doctor.user.name} · Written ${day(c.createdAt)}${c.finalizedAt ? ` · Finalized ${day(c.finalizedAt)}` : ""}`, { size: 9, color: GREY });
  if (c.amendedAt) {
    w.text(`Amended on ${day(c.amendedAt)}. This is the latest version of the report.`, { size: 9, bold: true, color: [0.6, 0.3, 0] });
  }
  w.gap(6);

  const section = (title: string, value: string | null | undefined) => {
    if (!value || !value.trim()) return;
    w.ensure(36);
    w.text(title, { size: 10, bold: true });
    w.text(value.trim(), { size: 9, x: 8 });
    w.gap(4);
  };

  section("Chief complaint", c.chiefComplaint);
  section("History of present illness", c.historyPresentIllness);
  section("Past medical history", c.pastMedicalHistory);

  const symptoms = asSymptoms(c.symptoms).filter((s) => s.name);
  if (symptoms.length) {
    w.ensure(40);
    w.text("Symptoms", { size: 10, bold: true });
    w.table(["Symptom", "Duration", "Severity"], symptoms.map((s) => [s.name ?? "", s.duration ?? "", s.severity ?? ""]));
  }

  const vitals = asVitals(c.vitals);
  if (vitals.length) {
    w.ensure(40);
    w.text("Vital signs", { size: 10, bold: true });
    w.table(["Measure", "Value"], vitals);
  }

  section("Examination", c.examination);
  if (c.icd) section("Diagnosis (ICD-10)", `${c.icd.code} — ${c.icd.description}`);
  else section("Diagnosis", c.diagnosis);
  section("Differential diagnosis", c.differentialDiagnosis);
  section("Laboratory findings", c.labFindings);
  section("Imaging findings", c.imagingFindings);
  section("Treatment plan", c.treatmentPlan);

  const items = c.prescriptions.flatMap((p) => p.items);
  if (items.length) {
    w.ensure(40);
    w.text("Medications prescribed", { size: 10, bold: true });
    w.table(
      ["Medication", "Dose", "Frequency", "Duration", "Instructions"],
      items.map((i) => [i.drugName, i.dose ?? "", i.frequency ?? "", i.duration ?? "", i.instructions ?? ""]),
    );
  }

  section("Recommendations", c.recommendations);
  if (c.followUpDate) section("Follow-up", day(c.followUpDate));
  section("Additional notes", c.notes);

  w.ensure(60);
  w.rule();
  w.text(
    "This report was written by the doctor named above. It is a clinical record and is not a substitute for an in-person medical assessment where one is needed.",
    { size: 8, color: GREY },
  );

  const pages = w.pages;
  pages.forEach((page, i) => {
    page.drawText(`Report ${reportNumber} · revision ${c.revision} · Page ${i + 1} of ${pages.length}`, {
      x: 48, y: 24, size: 7, font, color: rgb(0.4, 0.4, 0.4),
    });
    if (!finalized) {
      const [pw, ph] = size;
      page.drawText("DRAFT — NOT ISSUED", { x: pw * 0.12, y: ph * 0.3, size: 34, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.22, rotate: degrees(35) });
    }
  });

  return pdf.save();
}
