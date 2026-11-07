/**
 * The twelve case-file folders shown in the Patient Electronic Case File,
 * following the supplied structural reference. Every clinical document in the
 * platform is classified into exactly one folder; classification is derived
 * from the HIS catalogue group (A–P) and the document title, so it works for
 * system templates, hospital-customised templates and future catalogue items
 * without code changes per hospital.
 */

export type CaseFileFolderKey =
  | "assessments"
  | "summaries"
  | "oncology"
  | "surgical"
  | "consent"
  | "laboratory"
  | "radiology"
  | "transfusion"
  | "admissions"
  | "safety"
  | "mortality"
  | "other";

export interface CaseFileFolder {
  key: CaseFileFolderKey;
  title: string;
  description: string;
}

/** Display order matches the reference image. */
export const CASE_FILE_FOLDERS: readonly CaseFileFolder[] = [
  { key: "assessments", title: "Assessments & consultations", description: "Consultations, clinical examinations and assessment forms." },
  { key: "summaries", title: "Clinical summaries", description: "Discharge, transfer and interim clinical summaries." },
  { key: "oncology", title: "Oncology records", description: "Oncology, haematology and cancer-management records." },
  { key: "surgical", title: "Surgical & procedures", description: "Operative reports, anaesthesia and procedure documents." },
  { key: "consent", title: "Consent & agreements", description: "Informed consent, agreements and treatment refusals." },
  { key: "laboratory", title: "Laboratory requests", description: "Laboratory requests, specimens and reports." },
  { key: "radiology", title: "Radiology & diagnostics", description: "Imaging, physiological and endoscopic examinations." },
  { key: "transfusion", title: "Blood transfusion", description: "Transfusion consents, blood bank and compatibility records." },
  { key: "admissions", title: "Admissions & referrals", description: "Admissions, ward care, referrals and transfers." },
  { key: "safety", title: "Safety & risk records", description: "Incident reports, infections and risk assessments." },
  { key: "mortality", title: "Mortality records", description: "Death summaries, certificates and mortality reviews." },
  { key: "other", title: "Other medical documents", description: "Medication records, certifications and remaining documents." },
];

const FOLDER_BY_KEY = new Map(CASE_FILE_FOLDERS.map((f) => [f.key, f]));

export function folderTitle(key: CaseFileFolderKey): string {
  return FOLDER_BY_KEY.get(key)?.title ?? "Other medical documents";
}

/** Group codes from the HIS catalogue (A–P). */
const GROUP_FOLDER: Record<string, CaseFileFolderKey> = {
  B: "assessments",
  D: "admissions",
  E: "surgical",
  F: "consent",
  G: "laboratory",
  H: "radiology",
  I: "radiology",
  J: "radiology",
  L: "safety",
  N: "oncology",
  O: "summaries",
};

const MORTALITY = /death|mortal|autopsy|forensic|post-mortem/i;
const TRANSFUSION = /transfusion|blood\s+(bank|product|grouping|component)/i;
const ONCOLOGY = /onco|chemo|radiation\s+therapy|cancer|tumou?r/i;
const CONSENT = /consent|agreement|refusal|against medical advice|acknowledg/i;
const ADMISSION = /admission|referral|transfer|registration|handover/i;

/**
 * Classify one document. Pattern rules run before group defaults so that, for
 * example, a blood-transfusion consent in group F lands in the Blood
 * transfusion folder rather than Consent & agreements.
 */
export function classifyCaseFileDocument(groupCode: string | null | undefined, title: string): CaseFileFolderKey {
  const name = title ?? "";
  if (MORTALITY.test(name)) return "mortality";
  if (TRANSFUSION.test(name)) return "transfusion";
  if (ONCOLOGY.test(name)) return "oncology";
  if (CONSENT.test(name)) return "consent";
  const group = (groupCode ?? "").trim().toUpperCase();
  if (GROUP_FOLDER[group]) return GROUP_FOLDER[group];
  if (group === "A" && ADMISSION.test(name)) return "admissions";
  return "other";
}
