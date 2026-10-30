import type { SignatureRule, TemplateDefinition, TemplateField, TemplateSection } from "./template-schema";

/**
 * System catalogue of default clinical document templates (groups A–P).
 * Read-only defaults: a hospital adopts (clones) a template into its own
 * library and customizes it there, so no hospital's changes ever affect
 * another hospital or these defaults. Definitions are structural scaffolds,
 * not clinical protocols — specialty packs must be reviewed by qualified
 * clinical teams before operational use.
 */

export interface CatalogueGroup {
  code: string;
  title: string;
  /** Facility kinds that may use this group. */
  kinds: ("HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE")[];
  items: string[];
}

const ALL = ["HOSPITAL"] as CatalogueGroup["kinds"];

export const CATALOGUE_GROUPS: CatalogueGroup[] = [
  { code: "A", title: "Patient registration and administrative documents", kinds: ALL, items: [
    "Patient registration and demographic record", "Unique patient identifier and medical record cover sheet",
    "Patient identification verification", "Emergency contact and next-of-kin information", "Patient information and privacy notice",
    "Personal data processing consent", "Patient rights and responsibilities acknowledgment", "Authorized representative or guardian documentation",
    "Interpreter and communication assistance record", "Insurance eligibility verification", "Insurance authorization and pre-approval request",
    "Self-pay and uninsured patient acknowledgment", "Financial responsibility and payment agreement", "Referral and transfer documentation",
    "Medical records release authorization", "Request for a copy of medical records", "Patient complaints and feedback record",
    "Discharge against medical advice documentation", "Refusal of examination or treatment", "Consent for communication and appointment reminders",
  ] },
  { code: "B", title: "Outpatient and ambulatory care", kinds: ALL, items: [
    "Outpatient registration", "Initial physician consultation", "Chief complaint and history of present illness", "Past medical and surgical history",
    "Family and social history", "Medication reconciliation", "Allergy and adverse drug reaction record", "Review of systems",
    "General and focused physical examination", "Vital signs and pain assessment", "Outpatient assessment and diagnosis", "Differential diagnosis",
    "Clinical reasoning and diagnosis justification", "Treatment plan", "Electronic prescription and medication order", "Laboratory and diagnostic test requests",
    "Specialist referral", "Specialist consultation report", "Follow-up progress note", "Chronic disease management plan",
    "Preventive care and screening record", "Patient education and counseling", "Follow-up appointment and return precautions",
    "Outpatient clinical summary", "Outpatient discharge or encounter closure summary",
  ] },
  { code: "C", title: "Emergency and urgent care", kinds: ALL, items: [
    "Emergency department registration", "Triage assessment and triage category", "Emergency severity and priority assessment",
    "Initial emergency physician assessment", "Emergency nursing assessment", "Vital signs and repeated observations",
    "Focused emergency history and examination", "Resuscitation record", "Cardiac arrest and CPR record", "Trauma assessment", "Stroke assessment",
    "Sepsis screening and management record", "Emergency medication administration record", "Emergency procedure and manipulation record",
    "Emergency diagnostic test requests", "Emergency imaging reports", "Blood transfusion documentation", "Clinical reassessment",
    "Emergency observation chart", "Decision to admit, discharge, transfer, or refer", "Emergency discharge instructions",
    "Refusal of emergency treatment", "Interfacility transfer and handover", "Death notification and associated records", "Emergency department summary",
  ] },
  { code: "D", title: "Inpatient admission and ward care", kinds: ALL, items: [
    "Inpatient admission record", "Admission assessment and initial examination", "Admission diagnosis and differential diagnosis", "Admission orders",
    "Initial treatment plan", "Daily physician progress note", "Daily nursing progress note", "Multidisciplinary ward round",
    "Ward round with the head of department", "Specialist consultation", "Nursing care plan", "Vital signs observation chart", "Intake and output chart",
    "Fluid balance chart", "Pain assessment and reassessment", "Neurological observation chart", "Fall risk assessment",
    "Pressure injury risk assessment", "Nutrition screening and nutrition plan", "Mobility and functional assessment", "Skin integrity assessment",
    "Infection screening and isolation precautions", "Medication reconciliation and inpatient medication chart", "Medication administration record",
    "Intravenous therapy and infusion chart", "Oxygen therapy and respiratory support record", "Blood glucose monitoring chart",
    "Drain, catheter, and device monitoring", "Wound assessment and dressing record", "Restraint assessment and documentation",
    "Critical care observation chart", "Clinical deterioration and escalation record", "Clinical diagnosis justification",
    "Interim or staged clinical summary", "Change-of-ward or change-of-service record", "Multidisciplinary care conference",
    "Family meeting and communication record", "Inpatient discharge summary", "Discharge medication reconciliation",
    "Discharge instructions and follow-up plan", "Transfer summary", "Discharge against medical advice", "Death summary and associated documentation",
    "Shift handover",
  ] },
  { code: "E", title: "Surgical and procedural care", kinds: ALL, items: [
    "Preoperative assessment", "Preoperative clinical summary", "Surgical indication and procedure justification", "Anesthesia pre-assessment",
    "Airway assessment", "Site and side verification", "Surgical safety checklist", "Team briefing and time-out record", "Operative report",
    "Surgeon's findings and procedure details", "Anesthesia record", "Intraoperative monitoring chart", "Implant, prosthesis, and device record",
    "Surgical instrument and swab count", "Specimen collection and labeling record", "Pathology and histopathology request", "Postoperative assessment",
    "Recovery room observation", "Post-anesthesia care record", "Postoperative orders", "Postoperative progress note", "Postoperative complications record",
    "Wound and drain care plan", "Procedure and manipulation record", "Sedation assessment and monitoring", "Local anesthesia procedure record",
    "Minor surgery record", "Endoscopy and interventional procedure report", "Surgical debrief", "Postoperative discharge instructions",
    // Append only: source codes use array positions; never shift existing codes.
    "Anesthesia consent", "Surgical consent", "Procedure-specific informed consent", "Biopsy request and consent",
  ] },
  { code: "F", title: "Informed consent and patient agreements", kinds: ["HOSPITAL", "DIAGNOSTIC_CENTRE", "LABORATORY"], items: [
    "General consent to examination and treatment", "Informed consent for surgery", "Anesthesia consent", "Sedation consent", "Invasive procedure consent",
    "Biopsy consent", "Blood and blood product transfusion consent", "Endoscopy and gastroscopy consent", "Colonoscopy consent",
    "Interventional radiology consent", "Contrast-agent administration consent", "Lumbar puncture consent", "Central venous catheter insertion consent",
    "Arterial line insertion consent", "Dialysis and vascular access procedure consent", "Wound debridement and dressing procedure consent",
    "Dental procedure consent", "Minor surgical procedure consent", "Implant or prosthesis consent", "Chemotherapy consent", "Radiation therapy consent",
    "High-risk medication consent", "Clinical photography and video recording consent", "Telemedicine consent", "Research participation consent",
    "Biobank and specimen storage consent", "Genetic testing consent", "HIV or other legally restricted testing consent",
    "Data sharing and external medical records consent", "Refusal of recommended treatment", "Refusal of blood products", "Leaving against medical advice",
    "Consent withdrawal", "Guardian or authorized representative consent", "Emergency treatment when consent cannot reasonably be obtained",
    "Patient acknowledgment of risks, benefits, alternatives, and questions", "Procedure-specific patient preparation and aftercare acknowledgment",
  ] },
  { code: "G", title: "Laboratory medicine", kinds: ["HOSPITAL", "LABORATORY"], items: [
    "Laboratory test request", "Laboratory specimen collection record", "Specimen labeling and chain of custody", "Specimen acceptance or rejection",
    "Hematology report", "Clinical chemistry report", "Immunology report", "Microbiology and culture report", "Antimicrobial susceptibility report",
    "Histopathology report", "Cytology report", "Molecular diagnostics and PCR report", "Blood grouping and compatibility testing",
    "Blood bank and transfusion records", "Point-of-care testing record", "Critical result notification", "Corrected or amended laboratory report",
    "Laboratory quality control and authorization record",
  ] },
  { code: "H", title: "Radiology and diagnostic imaging", kinds: ["HOSPITAL", "DIAGNOSTIC_CENTRE"], items: [
    "X-ray report", "CT scan report", "MRI report", "Ultrasound report", "Echocardiography report", "Doppler ultrasound report", "Angiography report",
    "Mammography report", "Fluoroscopy report", "Nuclear medicine imaging report", "Image-guided procedure report", "Contrast administration record",
    "Radiology preliminary report", "Final verified radiology report", "Radiology addendum or corrected report", "Critical imaging finding notification",
    "Interventional radiology procedure report",
  ] },
  { code: "I", title: "Cardiology and physiological diagnostics", kinds: ["HOSPITAL", "DIAGNOSTIC_CENTRE"], items: [
    "Resting ECG report", "Serial ECG comparison", "Ambulatory ECG and Holter report", "Arrhythmia assessment", "QT/QTc measurement report",
    "Echocardiography report", "Stress test report", "Ambulatory blood pressure monitoring report", "Spirometry and pulmonary function report",
    "EEG report", "Nerve conduction and electromyography report", "Sleep study report", "Other physiological diagnostic report",
  ] },
  { code: "J", title: "Endoscopy and specialized examinations", kinds: ["HOSPITAL", "DIAGNOSTIC_CENTRE"], items: [
    "Gastroscopy report", "Colonoscopy report", "Bronchoscopy report", "Cystoscopy report", "Laryngoscopy report", "Other endoscopic examination report",
    "Endoscopic procedure and sedation record",
  ] },
  { code: "K", title: "Medication and pharmacy", kinds: ALL, items: [
    "Medication reconciliation", "Medication prescription", "Medication order", "Medication administration record", "High-alert medication monitoring",
    "Anticoagulation monitoring", "Antimicrobial stewardship review", "Allergy and medication reaction report", "Adverse drug event report",
    "Medication error and near-miss report", "Controlled medication record", "Medication discontinuation and reconciliation at discharge",
  ] },
  { code: "L", title: "Infection prevention and patient safety", kinds: ALL, items: [
    "Infection risk screening", "Isolation precautions record", "Hospital-acquired infection surveillance", "Sepsis screening and escalation",
    "Pressure injury prevention", "Falls prevention plan", "Venous thromboembolism risk assessment", "VTE prophylaxis plan",
    "Pain prevention and management record", "Surgical site infection surveillance", "Medical device-associated infection record",
    "Incident and adverse event report", "Near-miss report", "Patient safety investigation", "Clinical deterioration record",
    "Mortality and morbidity review", "Infection control audit",
  ] },
  { code: "M", title: "Rehabilitation and allied health", kinds: ALL, items: [
    "Physiotherapy assessment", "Occupational therapy assessment", "Speech and language therapy assessment", "Rehabilitation care plan",
    "Mobility and functional status assessment", "Nutrition and dietitian assessment", "Swallowing assessment", "Psychological assessment",
    "Social work assessment", "Discharge destination and support assessment", "Rehabilitation progress note", "Assistive device and mobility aid record",
  ] },
  { code: "N", title: "Specialty template packs", kinds: ALL, items: [
    "Pediatrics and neonatology", "Obstetrics and gynecology", "Maternity and delivery", "Oncology and hematology", "Intensive care", "Cardiology",
    "Neurology", "Nephrology and dialysis", "Respiratory medicine", "Orthopedics and trauma", "Ophthalmology", "Dermatology",
    "Dentistry and oral surgery", "Psychiatry and mental health", "Infectious diseases", "Palliative care", "Geriatrics", "Burns and wound care",
  ] },
  { code: "O", title: "Discharge, transfer, and continuity of care", kinds: ALL, items: [
    "Final discharge summary", "Interim discharge or transfer summary", "Transfer to another hospital", "Handover to another clinical team",
    "Discharge summary acknowledgment",
  ] },
  { code: "P", title: "Medical certification and official reports", kinds: ALL, items: [
    "Medical certificate", "Fitness-for-work or school certificate", "Sick leave documentation", "Disability assessment report",
    "Insurance medical report", "Preauthorization clinical report", "Medical necessity statement", "Occupational health report",
    "Forensic medical report", "Death certificate workflow", "Medical records disclosure report", "External referral summary",
  ] },
];

export interface CatalogueEntry {
  code: string;
  groupCode: string;
  groupTitle: string;
  name: string;
  definition: TemplateDefinition;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const f = (id: string, label: string, type: TemplateField["type"] = "textarea", extra: Partial<TemplateField> = {}): TemplateField => ({ id, label, type, required: false, ...extra });
const req = (id: string, label: string, type: TemplateField["type"] = "textarea", extra: Partial<TemplateField> = {}): TemplateField => f(id, label, type, { required: true, locked: true, ...extra });
const sec = (id: string, title: string, fields: TemplateField[], extra: Partial<TemplateSection> = {}): TemplateSection => ({ id, title, fields, ...extra });

const AUTHOR: SignatureRule = { role: "AUTHOR", label: "Responsible clinician (author)", required: true, locked: true };
const COSIGN: SignatureRule = { role: "CO_SIGNER", label: "Co-signatory", required: false };
const HEAD: SignatureRule = { role: "DEPARTMENT_HEAD", label: "Head of department (if required by local policy)", required: false };
const VERIFIER: SignatureRule = { role: "VERIFIER", label: "Verifying clinician", required: false };

const context = sec("context", "Context", [
  f("department", "Department", "text"),
  f("encounterDate", "Date and time", "datetime"),
]);

const VITALS = sec("vitals", "Vital signs", [
  f("temperature", "Temperature", "number", { unit: "°C", min: 25, max: 45 }),
  f("pulse", "Pulse", "number", { unit: "/min", min: 0, max: 300 }),
  f("respRate", "Respiratory rate", "number", { unit: "/min", min: 0, max: 100 }),
  f("bp", "Blood pressure", "text", { helpText: "e.g. 120/80 mmHg" }),
  f("spo2", "SpO₂", "number", { unit: "%", min: 0, max: 100 }),
  f("pain", "Pain score (as per local scale)", "text"),
]);

function generic(name: string): TemplateSection[] {
  return [context, sec("details", name, [req("summary", "Details"), f("notes", "Additional notes")])];
}

function consent(name: string): TemplateDefinition {
  return {
    sections: [
      sec("procedure", "Procedure", [
        req("procedureName", "Procedure name", "text"),
        req("purpose", "Purpose of the procedure"),
        f("planned", "Planning", "select", { options: ["Planned", "Urgent", "Emergency"] }),
      ]),
      sec("disclosure", "Information given", [
        req("benefits", "Expected benefits"),
        req("risks", "Material risks and possible complications"),
        req("alternatives", "Reasonable alternatives, including no treatment where appropriate"),
        f("patientSpecific", "Patient-specific considerations"),
        req("questionsAnswered", "Questions answered and additional explanations provided"),
      ]),
      sec("capacity", "Capacity and communication", [
        f("capacityAssessed", "Capacity assessment performed", "checkbox"),
        f("capacityNotes", "Capacity assessment notes"),
        f("interpreterUsed", "Interpreter used", "checkbox"),
        f("interpreterDetails", "Interpreter details", "text"),
      ]),
      sec("decision", "Decision", [
        req("decision", "Patient decision", "select", { options: ["Consents", "Declines", "Withdraws previous consent"] }),
        req("formVersionNote", "Version of the information/consent form given to the patient", "text"),
        f("withdrawalDetails", "Withdrawal or revocation details"),
      ]),
    ],
    signatures: [
      { role: "PATIENT", anyOf: ["PATIENT", "AUTHORIZED_REPRESENTATIVE"], label: "Patient or authorized representative", required: true, locked: true },
      { role: "CLINICIAN_OBTAINING_CONSENT", label: "Clinician obtaining consent", required: true, locked: true },
      { role: "WITNESS", label: "Witness (where required)", required: false },
      { role: "INTERPRETER", label: "Interpreter (where applicable)", required: false },
    ],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: /genetic|hiv/i.test(name) ? "SPECIALLY_PROTECTED" : "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4", footerNote: "A checkbox or generated PDF alone is not legally valid consent. Valid only with the recorded signatures." },
    notice: "Consent must be obtained before the procedure when required. Review wording with your legal and clinical governance teams.",
  };
}

function lab(name: string): TemplateDefinition {
  return {
    sections: [
      sec("specimen", "Specimen", [
        req("specimenType", "Specimen type", "text"), f("accession", "Accession number", "text"),
        f("collectedAt", "Collection time", "datetime"), f("receivedAt", "Receipt time", "datetime"), f("processedAt", "Processing time", "datetime"),
        f("method", "Method / analyser", "text"),
      ]),
      sec("results", "Results", [
        req("results", "Results", "table", { columns: ["Test", "Result", "Units (UCUM)", "Reference range", "Flag", "LOINC"] }),
        f("interpretation", "Interpretation / comments"),
        f("critical", "Critical result communicated", "checkbox"),
        f("criticalDetails", "Critical result communication (to whom, when, read-back)"),
        f("sourceReport", "Supporting laboratory report", "attachment"),
      ]),
    ],
    signatures: [{ ...AUTHOR, label: "Laboratory scientist / authorized laboratory professional" }, { ...VERIFIER, label: "Verifying pathologist or laboratory physician" }, HEAD],
    workflow: { requiresReview: true, independentReview: true },
    sensitivity: /molecular|pcr|genetic/i.test(name) ? "RESTRICTED" : "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4", footerNote: "Reference ranges are specific to the performing laboratory, method and population." },
  };
}

function imaging(): TemplateDefinition {
  return {
    sections: [
      sec("study", "Study", [
        f("modality", "Modality", "text"), f("bodySite", "Body region", "text"), f("accession", "Accession / study number", "text"),
        f("contrast", "Contrast administration details", "text"),
      ]),
      sec("report", "Report", [
        req("indication", "Clinical indication"), req("technique", "Technique"), f("comparison", "Comparison studies"),
        req("findings", "Findings"), req("impression", "Impression"), f("recommendations", "Recommendations"),
        f("sourceStudy", "Source study or supporting report", "attachment"),
      ]),
      sec("critical", "Critical findings communication", [
        f("criticalFinding", "Critical finding present", "checkbox"),
        f("criticalCommunication", "Communicated to (name, role, time, method)"),
      ]),
    ],
    signatures: [{ ...AUTHOR, label: "Reporting radiologist" }, VERIFIER, HEAD],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4" },
  };
}

function physiological(): TemplateDefinition {
  return {
    sections: [
      sec("study", "Study", [f("device", "Source device", "text"), f("recordingStart", "Recording start", "datetime"), f("duration", "Duration", "text")]),
      sec("measurements", "Measurements", [f("measurements", "Structured measurements (from validated device output)", "table", { columns: ["Parameter", "Value", "Unit"] })]),
      sec("interpretation", "Clinician interpretation", [req("interpretation", "Interpretation"), f("comparison", "Comparison with prior studies"), f("recommendations", "Recommendations")]),
    ],
    signatures: [{ ...AUTHOR, label: "Interpreting clinician" }, HEAD],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4", footerNote: "Measurements are transcribed from validated device output; the system does not calculate or interpret them." },
  };
}

function endoscopy(): TemplateDefinition {
  return {
    sections: [
      sec("procedure", "Procedure", [req("indication", "Indication"), f("sedation", "Sedation and monitoring"), f("extent", "Extent of examination", "text")]),
      sec("report", "Report", [req("findings", "Findings"), req("impression", "Impression"), f("biopsies", "Biopsy and specimen details"), f("complications", "Complications"), f("followUp", "Follow-up recommendations"), f("procedureImage", "Procedure image", "image")]),
    ],
    signatures: [{ ...AUTHOR, label: "Endoscopist" }, COSIGN],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4" },
  };
}

function discharge(name: string): TemplateDefinition {
  return {
    sections: [
      context,
      sec("diagnoses", "Diagnoses and procedures", [req("primaryDiagnosis", "Primary diagnosis (ICD-10)", "text"), f("secondaryDiagnoses", "Secondary diagnoses"), f("procedures", "Procedures and operations performed")]),
      sec("course", "Hospital course", [req("hospitalCourse", "Hospital course"), f("investigations", "Significant investigations and results"), f("complications", "Complications and unresolved problems")]),
      sec("medications", "Medications", [req("dischargeMedications", "Medication list at discharge", "table", { columns: ["Medication", "Dose", "Route", "Frequency", "Change / rationale"] }), f("pendingInvestigations", "Pending investigations")]),
      sec("followup", "Follow-up and instructions", [req("followUp", "Follow-up appointments and referrals"), f("careInstructions", "Wound care, rehabilitation and community care instructions"), f("education", "Patient and caregiver education"), req("returnPrecautions", "Return precautions and emergency contact instructions")]),
      ...(/transfer|handover/i.test(name) ? [sec("transfer", "Transfer", [req("receivingTeam", "Receiving facility / team", "text"), req("conditionAtTransfer", "Condition at transfer")])] : []),
    ],
    signatures: [AUTHOR, COSIGN, HEAD],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4" },
  };
}

function surgical(name: string): TemplateDefinition {
  const operative = /operative report|findings and procedure/i.test(name);
  return {
    sections: operative
      ? [
          context,
          sec("procedure", "Procedure", [req("procedureName", "Procedure performed", "text"), f("urgency", "Urgency", "select", { options: ["Planned", "Urgent", "Emergency"] }), f("team", "Surgical team"), f("anesthesia", "Anesthesia type", "text")]),
          sec("details", "Operative details", [req("indication", "Indication"), req("findings", "Findings"), req("description", "Procedure description"), f("implants", "Implants / devices"), f("specimens", "Specimens sent"), f("ebl", "Estimated blood loss", "text"), f("counts", "Instrument and swab counts correct", "checkbox"), f("complications", "Complications"), f("postOpPlan", "Postoperative plan")]),
        ]
      : generic(name),
    signatures: [{ ...AUTHOR, label: operative ? "Operating surgeon" : "Responsible clinician" }, COSIGN, HEAD],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: "STANDARD",
    authorRoles: [],
    output: { pageSize: "A4" },
    notice: /checklist/i.test(name) ? "Align checklist items with the WHO Surgical Safety Checklist and local standards before use." : undefined,
  };
}

function clinical(name: string, groupCode: string): TemplateDefinition {
  const soap = /progress note|consultation|assessment|examination|reassessment/i.test(name);
  const sections = soap
    ? [context, sec("subjective", "History / subjective", [f("history", "History")]), ...(groupCode === "M" ? [] : [VITALS]), sec("assessment", "Examination and assessment", [f("examination", "Examination findings"), req("assessment", "Assessment")]), sec("plan", "Plan", [req("plan", "Plan")])]
    : generic(name);
  const restricted = groupCode === "P" && /forensic|death|disability/i.test(name);
  return {
    sections,
    signatures: [AUTHOR, COSIGN, HEAD],
    workflow: { requiresReview: false, independentReview: true },
    sensitivity: /psychiatr|mental|psycholog|safeguard|infectious|hiv/i.test(name) ? "SPECIALLY_PROTECTED" : restricted ? "RESTRICTED" : "STANDARD",
    authorRoles: restricted ? ["OWNER", "DOCTOR", "DEPARTMENT_HEAD", "SURGEON"] : [],
    output: { pageSize: "A4" },
    notice:
      groupCode === "N"
        ? "Specialty template pack: must be reviewed by appropriately qualified clinical teams before operational use."
        : groupCode === "C" && /triage|severity|sepsis|stroke/i.test(name)
          ? "Use only the hospital's approved, validated local protocol. The system does not calculate clinical scores or recommend treatment."
          : groupCode === "L"
            ? "Use validated, configurable assessment instruments. Scores never trigger treatment automatically."
            : undefined,
  };
}

function definitionFor(groupCode: string, name: string): TemplateDefinition {
  if (groupCode === "F" || (groupCode === "E" && /consent/i.test(name))) return consent(name);
  if (groupCode === "G") return lab(name);
  if (groupCode === "H") return imaging();
  if (groupCode === "I") return physiological();
  if (groupCode === "J") return endoscopy();
  if (groupCode === "O" || /discharge summary|transfer summary/i.test(name)) return discharge(name);
  if (groupCode === "E") return surgical(name);
  return clinical(name, groupCode);
}

let cache: CatalogueEntry[] | null = null;

export function catalogue(): CatalogueEntry[] {
  if (cache) return cache;
  cache = CATALOGUE_GROUPS.flatMap((g) =>
    g.items.map((name, i) => ({
      code: `${g.code}.${String(i + 1).padStart(2, "0")}-${slug(name)}`,
      groupCode: g.code,
      groupTitle: g.title,
      name,
      definition: definitionFor(g.code, name),
    })),
  );
  return cache;
}

export function catalogueEntry(code: string): CatalogueEntry | undefined {
  return catalogue().find((e) => e.code === code);
}

export function groupTitle(code: string): string {
  return CATALOGUE_GROUPS.find((g) => g.code === code)?.title ?? (code === "CUSTOM" ? "Custom documents" : code);
}

export function groupAllowedForKind(groupCode: string, kind: string | null): boolean {
  if (groupCode === "CUSTOM") return true;
  const group = CATALOGUE_GROUPS.find((g) => g.code === groupCode);
  return Boolean(group && kind && (group.kinds as string[]).includes(kind));
}
