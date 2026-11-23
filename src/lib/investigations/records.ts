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
    where: { status: "RELEASED", ...(viewer === "PATIENT" ? { patient_visible: true } : {}), investigation_order_items: { investigation_orders: { patient_id: patientId } } },
    orderBy: { released_at: "desc" },
    take,
    select: {
      version: true, released_at: true,
      investigation_observations: { where: { is_critical: true }, select: { id: true }, take: 1 },
      investigation_order_items: { select: { id: true, domain: true, department_key: true, name_snapshot: true, lab_staff_profiles: { select: { laboratoryName: true } }, investigation_orders: { select: { order_number: true } } } },
    },
  });
  return rows.map((r) => {
    const item = r.investigation_order_items;
    return {
      itemId: item.id, domain: item.domain, folder: folderFor(item.domain, item.department_key), name: item.name_snapshot, facility: item.lab_staff_profiles?.laboratoryName ?? null,
      releasedAt: r.released_at as Date, version: r.version, orderNumber: item.investigation_orders.order_number, hasCritical: r.investigation_observations.length > 0,
    };
  });
}

/** FHIR resources (ServiceRequest, Specimen, Observation, DiagnosticReport, ImagingStudy, ...) for released investigations. */
export async function releasedInvestigationFhirResources(patientId: string, viewer: "DOCTOR" | "PATIENT"): Promise<Record<string, unknown>[]> {
  const results = await prisma.investigation_results.findMany({
    where: { status: "RELEASED", ...(viewer === "PATIENT" ? { patient_visible: true } : {}), investigation_order_items: { investigation_orders: { patient_id: patientId } } },
    orderBy: { released_at: "desc" },
    take: 100,
    include: {
      investigation_observations: { orderBy: { sort_order: "asc" } },
      investigation_media: { select: { id: true, study_instance_uid: true, dicom_modality: true, mime_type: true, file_name: true } },
      investigation_order_items: { include: { investigation_orders: { select: { id: true, requested_by_id: true, encounter_id: true, authorised_at: true } }, investigation_specimens: true } },
    },
  });
  const out: Record<string, unknown>[] = [];
  const seenItems = new Set<string>();
  for (const r of results) {
    const it = r.investigation_order_items;
    const order = it.investigation_orders;
    const base: FhirItem = {
      id: it.id, orderId: it.order_id, patientId, status: it.status, nameSnapshot: it.name_snapshot, codeSnapshot: it.code_snapshot, loincSnapshot: it.loinc_snapshot, snomedSnapshot: it.snomed_snapshot,
      priority: it.priority, createdAt: it.created_at, performingFacilityId: it.performing_facility_id, domain: it.domain, requesterUserId: order.requested_by_id, encounterId: order.encounter_id, authorisedAt: order.authorised_at,
    };
    if (!seenItems.has(it.id)) {
      seenItems.add(it.id);
      out.push(serviceRequest(base));
      for (const s of it.investigation_specimens) out.push(fhirSpecimen({ id: s.id, patientId, barcode: s.barcode, accessionNumber: s.accession_number, specimenType: s.specimen_type, status: s.status, collectedAt: s.collected_at, receivedAt: s.received_at, itemId: it.id }));
    }
    out.push(...diagnosticReport({
      result: { id: r.id, itemId: it.id, version: r.version, findings: r.findings, impression: r.impression, conclusion: r.conclusion, releasedAt: r.released_at, signedById: r.signed_by_id, reporterName: r.reporter_name },
      item: base, facilityId: it.performing_facility_id,
      observations: r.investigation_observations.map((o) => ({ id: o.id, patientId, resultId: r.id, name: o.name, loincCode: o.loinc_code, valueNumeric: o.value_numeric, valueText: o.value_text, unit: o.unit, refLow: o.ref_low, refHigh: o.ref_high, refText: o.ref_text, flag: o.flag })),
      media: r.investigation_media.map((m) => ({ id: m.id, studyInstanceUid: m.study_instance_uid, dicomModality: m.dicom_modality, mimeType: m.mime_type, fileName: m.file_name })),
    }));
  }
  return out;
}
