import { prisma } from "@/lib/prisma";
import { diagnosticReport, serviceRequest, specimen as fhirSpecimen, type FhirItem } from "./fhir";

/** Case-file folders for released investigation reports (central EHR). */
export const LAB_FOLDERS: Record<string, string> = {
  haematology: "Haematology",
  microbiology: "Microbiology",
  "clinical-biochemistry": "Clinical Biochemistry",
  histopathology: "Histopathology",
  "immunology-serology": "Immunology",
  "molecular-genetics": "Molecular Diagnostics",
  parasitology: "Parasitology",
  "blood-transfusion": "Blood Transfusion",
  "urinalysis-body-fluids": "Urinalysis and Body Fluids",
};
export const LAB_FOLDER_ORDER = [...Object.values(LAB_FOLDERS), "Other Laboratory Reports"];

export const DX_FOLDERS: Record<string, string> = {
  radiology: "X-ray",
  mammography: "X-ray",
  ct: "CT",
  mri: "MRI",
  ultrasound: "Ultrasound",
  cardiology: "Cardiology",
  neurology: "Neurology",
  "gastroenterology-endoscopy": "Endoscopy",
  "nuclear-medicine": "Nuclear Medicine",
};
export const DX_FOLDER_ORDER = ["X-ray", "CT", "MRI", "Ultrasound", "Cardiology", "Neurology", "Endoscopy", "Nuclear Medicine", "Other Diagnostic Reports"];

export function folderFor(domain: "LABORATORY" | "DIAGNOSTIC", departmentKey: string): string {
  if (domain === "LABORATORY") return LAB_FOLDERS[departmentKey] ?? "Other Laboratory Reports";
  return DX_FOLDERS[departmentKey] ?? "Other Diagnostic Reports";
}

export interface ReleasedReportEntry {
  itemId: string;
  domain: "LABORATORY" | "DIAGNOSTIC";
  folder: string;
  name: string;
  facility: string | null;
  releasedAt: Date;
  version: number;
  orderNumber: string;
  hasCritical: boolean;
}

/**
 * Released reports of one patient. A patient viewer only gets patient-visible
 * reports; drafts, unverified and internal results are never selected.
 */
export async function releasedReportsForPatient(patientId: string, viewer: "DOCTOR" | "PATIENT", take = 200): Promise<ReleasedReportEntry[]> {
  const rows = await prisma.investigation_results.findMany({
    where: { status: "RELEASED", ...(viewer === "PATIENT" ? { patientVisible: true } : {}), item: { order: { patientId } } },
    orderBy: { releasedAt: "desc" },
    take,
    select: {
      version: true, releasedAt: true,
      observations: { where: { isCritical: true }, select: { id: true }, take: 1 },
      item: { select: { id: true, domain: true, departmentKey: true, nameSnapshot: true, performingFacility: { select: { laboratoryName: true } }, order: { select: { orderNumber: true } } } },
    },
  });
  return rows.map((r) => ({
    itemId: r.item.id, domain: r.item.domain, folder: folderFor(r.item.domain, r.item.departmentKey), name: r.item.nameSnapshot, facility: r.item.performingFacility?.laboratoryName ?? null,
    releasedAt: r.releasedAt as Date, version: r.version, orderNumber: r.item.order.orderNumber, hasCritical: r.observations.length > 0,
  }));
}

/** FHIR resources (ServiceRequest, Specimen, Observation, DiagnosticReport, ImagingStudy, ...) for released investigations. */
export async function releasedInvestigationFhirResources(patientId: string, viewer: "DOCTOR" | "PATIENT"): Promise<Record<string, unknown>[]> {
  const results = await prisma.investigation_results.findMany({
    where: { status: "RELEASED", ...(viewer === "PATIENT" ? { patientVisible: true } : {}), item: { order: { patientId } } },
    orderBy: { releasedAt: "desc" },
    take: 100,
    include: {
      observations: { orderBy: { sortOrder: "asc" } },
      media: { select: { id: true, studyInstanceUid: true, dicomModality: true, mimeType: true, fileName: true } },
      item: { include: { order: { select: { id: true, requestedById: true, encounterId: true, authorisedAt: true } }, specimens: true } },
    },
  });
  const out: Record<string, unknown>[] = [];
  const seenItems = new Set<string>();
  for (const r of results) {
    const it = r.item;
    const base: FhirItem = {
      id: it.id, orderId: it.orderId, patientId, status: it.status, nameSnapshot: it.nameSnapshot, codeSnapshot: it.codeSnapshot, loincSnapshot: it.loincSnapshot, snomedSnapshot: it.snomedSnapshot,
      priority: it.priority, createdAt: it.createdAt, performingFacilityId: it.performingFacilityId, domain: it.domain, requesterUserId: it.order.requestedById, encounterId: it.order.encounterId, authorisedAt: it.order.authorisedAt,
    };
    if (!seenItems.has(it.id)) {
      seenItems.add(it.id);
      out.push(serviceRequest(base));
      for (const s of it.specimens) out.push(fhirSpecimen({ id: s.id, patientId, barcode: s.barcode, accessionNumber: s.accessionNumber, specimenType: s.specimenType, status: s.status, collectedAt: s.collectedAt, receivedAt: s.receivedAt, itemId: it.id }));
    }
    out.push(...diagnosticReport({
      result: { id: r.id, itemId: it.id, version: r.version, findings: r.findings, impression: r.impression, conclusion: r.conclusion, releasedAt: r.releasedAt, signedById: r.signedById, reporterName: r.reporterName },
      item: base, facilityId: it.performingFacilityId,
      observations: r.observations.map((o) => ({ id: o.id, patientId, resultId: r.id, name: o.name, loincCode: o.loincCode, valueNumeric: o.valueNumeric, valueText: o.valueText, unit: o.unit, refLow: o.refLow, refHigh: o.refHigh, refText: o.refText, flag: o.flag })),
      media: r.media,
    }));
  }
  return out;
}
