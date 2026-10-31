import type { TemplateSection } from "./template-schema";

/** Documentation scaffolds only. No treatment protocols, score calculators,
 * drug doses, reference ranges or claims of clinical validation are supplied. */
const PACKS: Record<string, [string, string][]> = {
  "Pediatrics and neonatology": [
    ["development", "Developmental and feeding history"], ["birth", "Birth, gestational age and neonatal history"],
    ["growth", "Growth measurements and reviewed growth-chart reference"], ["immunizations", "Immunization record and source"],
    ["guardian", "Guardian, safeguarding and communication needs"], ["pediatricPlan", "Age-specific assessment and clinician-approved follow-up"],
  ],
  "Obstetrics and gynecology": [
    ["obstetricHistory", "Obstetric and gynecological history"], ["pregnancy", "Pregnancy status, gestation and dating source"],
    ["maternalAssessment", "Maternal assessment and observations"], ["fetalAssessment", "Fetal assessment, when applicable"],
    ["reproductiveConsent", "Consent, chaperone and reproductive privacy needs"], ["obstetricPlan", "Assessment, safety-netting and follow-up"],
  ],
  "Maternity and delivery": [
    ["labor", "Labor onset, maternal assessment and chronology"], ["monitoring", "Maternal and fetal monitoring observations"],
    ["delivery", "Delivery date/time, mode, attending team and events"], ["newborn", "Newborn identification, assessment and handover"],
    ["postpartum", "Postpartum observations and complications"], ["maternityPlan", "Maternal and newborn follow-up plan"],
  ],
  "Oncology and hematology": [
    ["oncologyDiagnosis", "Diagnosis, pathology, coding and staging source"], ["treatmentHistory", "Treatment history and current clinician-approved regimen reference"],
    ["toxicity", "Symptoms, adverse events and toxicity assessment source"], ["hematology", "Hematology, transfusion and relevant investigations"],
    ["support", "Supportive care, consent and patient goals"], ["oncologyPlan", "Multidisciplinary decisions and follow-up"],
  ],
  "Intensive care": [
    ["icuIndication", "Critical-care indication and admission context"], ["organSupport", "Respiratory, cardiovascular and other organ support"],
    ["icuObservations", "Time-stamped observations and monitoring review"], ["icuDevices", "Lines, devices and infection-prevention review"],
    ["goals", "Goals of care, family communication and escalation authority"], ["icuPlan", "System-by-system assessment and handover"],
  ],
  "Cardiology": [
    ["cardiacHistory", "Cardiac symptoms, history and risk factors"], ["cardiacExam", "Cardiovascular examination"],
    ["cardiacTests", "ECG, imaging and laboratory interpretation references"], ["cardiacDevices", "Implants, devices and interventions"],
    ["cardiacMedication", "Medication reconciliation and tolerance"], ["cardiacPlan", "Assessment and follow-up"],
  ],
  "Neurology": [
    ["onset", "Symptom onset, chronology and baseline function"], ["neurologicalExam", "Neurological examination"],
    ["consciousness", "Consciousness and locally approved assessment reference"], ["neuroTests", "Imaging, physiology and laboratory references"],
    ["neuroFunction", "Functional impact and communication needs"], ["neuroPlan", "Assessment, escalation and follow-up"],
  ],
  "Nephrology and dialysis": [
    ["renalHistory", "Renal history and relevant baseline results"], ["fluidStatus", "Volume status and time-stamped fluid balance"],
    ["renalTests", "Renal investigations and trend interpretation"], ["dialysis", "Dialysis prescription reference, session and access review"],
    ["renalMedication", "Medication reconciliation and renal-dose review by clinician"], ["renalPlan", "Assessment and follow-up"],
  ],
  "Respiratory medicine": [
    ["respiratoryHistory", "Respiratory symptoms and exposure history"], ["respiratoryExam", "Respiratory examination"],
    ["respiratorySupport", "Oxygen or ventilatory support and prescribed target reference"], ["respiratoryTests", "Imaging, blood gas and physiology references"],
    ["inhalers", "Inhaler review and patient education"], ["respiratoryPlan", "Assessment and follow-up"],
  ],
  "Orthopedics and trauma": [
    ["injury", "Mechanism, injury chronology and affected side"], ["neurovascular", "Time-stamped neurovascular and limb assessment"],
    ["orthopedicImaging", "Imaging and fracture or injury description"], ["immobilization", "Immobilization, procedure and implant references"],
    ["weightBearing", "Clinician-documented weight-bearing and rehabilitation instructions"], ["orthopedicPlan", "Assessment and follow-up"],
  ],
  "Ophthalmology": [
    ["eyeSymptoms", "Symptoms, laterality and ocular history"], ["vision", "Visual acuity, method and correction"],
    ["eyeExam", "Anterior and posterior segment examination"], ["eyeTests", "Pressure, imaging and other investigation references"],
    ["eyeProcedures", "Procedure and medication review"], ["eyePlan", "Assessment and follow-up"],
  ],
  "Dermatology": [
    ["skinHistory", "Skin complaint, duration and exposures"], ["skinExam", "Morphology, distribution and examination"],
    ["skinMedia", "Clinical image reference and photography consent"], ["skinTests", "Biopsy, microbiology and other investigation references"],
    ["skinTreatment", "Prior treatment, response and adverse effects"], ["skinPlan", "Assessment and follow-up"],
  ],
  "Dentistry and oral surgery": [
    ["dentalHistory", "Dental complaint and medical history"], ["oralExam", "Oral examination, tooth identifiers and notation system"],
    ["dentalTests", "Imaging and other investigation references"], ["dentalProcedure", "Procedure, site, consent and anesthesia reference"],
    ["dentalAftercare", "Aftercare and patient education"], ["dentalPlan", "Assessment and follow-up"],
  ],
  "Psychiatry and mental health": [
    ["mentalHistory", "Presenting concerns and relevant mental-health history"], ["mentalState", "Mental-state examination"],
    ["mentalRisk", "Clinician assessment of risks, protective factors and safety plan"], ["capacity", "Capacity, consent, legal basis and disclosure restrictions"],
    ["mentalSupport", "Social context, support and patient preferences"], ["mentalPlan", "Assessment, escalation and follow-up"],
  ],
  "Infectious diseases": [
    ["infectionHistory", "Symptoms, travel and relevant exposure history"], ["infectionExam", "Examination and infection-control precautions"],
    ["microbiology", "Microbiology, susceptibility and investigation references"], ["antimicrobialReview", "Antimicrobial review and approved local guideline reference"],
    ["notification", "Public-health reporting assessment and lawful disclosure basis"], ["infectionPlan", "Assessment and follow-up"],
  ],
  "Palliative care": [
    ["palliativeContext", "Illness context and patient understanding"], ["symptoms", "Symptom burden and patient-reported priorities"],
    ["palliativeGoals", "Goals, preferences and documented decision-making authority"], ["advanceCare", "Advance-care documentation and applicable legal basis"],
    ["familySupport", "Family, psychosocial, spiritual and caregiver needs"], ["palliativePlan", "Agreed plan and continuity of care"],
  ],
  "Geriatrics": [
    ["baseline", "Baseline function, cognition and living situation"], ["geriatricAssessment", "Comprehensive geriatric assessment"],
    ["frailty", "Locally approved frailty assessment and instrument reference"], ["polypharmacy", "Medication and polypharmacy review"],
    ["geriatricRisks", "Falls, nutrition, continence and safeguarding review"], ["geriatricPlan", "Patient goals, multidisciplinary plan and support"],
  ],
  "Burns and wound care": [
    ["woundCause", "Cause, onset, anatomical sites and laterality"], ["woundAssessment", "Wound or burn assessment and measurement method"],
    ["woundInfection", "Infection assessment and investigation references"], ["woundCare", "Dressing, procedure and device record"],
    ["woundMedia", "Photograph reference, scale and consent"], ["woundPlan", "Assessment, reassessment interval and follow-up"],
  ],
};

export function specialtySection(name: string): TemplateSection {
  const fields = PACKS[name];
  if (!fields) throw new Error("Unknown specialty pack");
  return {
    id: "specialty", title: `${name}: structured assessment`,
    description: "Clinical review required before operational use. Record the instrument or local protocol used; this template does not calculate scores or recommend care.",
    fields: fields.map(([id, label], i) => ({ id: `sp_${id}`, label, type: "textarea", required: i === 0 || i === fields.length - 1, locked: i === 0 || i === fields.length - 1, maxLength: 10000 })),
  };
}
