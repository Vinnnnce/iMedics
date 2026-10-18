import { prisma } from "@/lib/prisma";
import { checkRxNavInteractions } from "./reference";
import type { PrescriptionItemInput } from "./validation";

/**
 * Clinical safety checks for prescribing.
 *
 * These alerts ASSIST the prescriber and do not replace professional judgment.
 * Only checks supported by data present in the platform or by the RxNav
 * interaction service are produced; anything unknown is reported as
 * "information unavailable" rather than silently passed.
 */

export type SafetySeverity = "HIGH" | "MODERATE" | "LOW" | "INFO" | "UNKNOWN";

export interface SafetyAlert {
  code: string;
  severity: SafetySeverity;
  message: string;
}

interface PatientContext {
  id: string;
  allergies: string[];
  currentMedicationNames: string[];
  age?: number | null;
  weightKg?: number | null;
  isPregnant?: boolean | null;
  renallyImpaired?: boolean | null;
}

/** Load the context the safety checks run against (latest history + active prescriptions). */
export async function loadPatientSafetyContext(patientId: string): Promise<PatientContext> {
  const [history, activePrescriptions] = await Promise.all([
    prisma.medicalHistory.findFirst({ where: { patientId }, orderBy: { updatedAt: "desc" } }),
    prisma.prescription.findMany({
      where: { patientId, status: "ACTIVE" },
      include: { items: true },
      take: 20,
      orderBy: { issuedAt: "desc" },
    }),
  ]);
  const rawAllergies = Array.isArray(history?.allergies) ? (history?.allergies as unknown[]) : [];
  const allergies = rawAllergies
    .map((a) => (typeof a === "string" ? a : typeof a === "object" && a && "name" in a ? String((a as { name: unknown }).name) : null))
    .filter((a): a is string => Boolean(a));

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { dateOfBirth: true, weight: true },
  });
  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return {
    id: patientId,
    allergies,
    currentMedicationNames: activePrescriptions.flatMap((p) => p.items.map((i) => i.drugName)),
    age,
    weightKg: patient?.weight ?? null,
    isPregnant: (history?.pregnancies ?? 0) > 0 || null,
  };
}

/**
 * Run all safety checks for a draft set of items. Never throws: an unavailable
 * data source yields an UNKNOWN alert so the prescriber is told explicitly.
 */
export async function runPrescriptionSafetyChecks(
  context: PatientContext,
  items: PrescriptionItemInput[],
  referenceByDrug: Map<string, { rxCui: string | null; drugClass: string | null }>,
): Promise<SafetyAlert[]> {
  const alerts: SafetyAlert[] = [];

  // 1. Allergy cross-check against the recorded allergy list.
  for (const item of items) {
    for (const allergy of context.allergies) {
      const a = allergy.toLowerCase();
      const name = `${item.drugName} ${item.activeIngredient ?? ""}`.toLowerCase();
      const ingredientTokens = (item.activeIngredient ?? "").toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      if (name.includes(a) || ingredientTokens.some((t) => a.includes(t) || t.includes(a))) {
        alerts.push({
          code: `ALLERGY:${item.drugName}`,
          severity: "HIGH",
          message: `The patient's record lists an allergy to "${allergy}", which may relate to ${item.drugName}. Confirm before prescribing.`,
        });
      }
    }
  }

  // 2. Duplicate therapy within the new prescription or against active ones.
  const byClass = new Map<string, string[]>();
  for (const item of items) {
    const ref = referenceByDrug.get(item.drugName);
    const cls = item.drugClass ?? ref?.drugClass ?? null;
    if (cls) byClass.set(cls, [...(byClass.get(cls) ?? []), item.drugName]);
  }
  for (const [cls, names] of byClass) {
    if (names.length > 1) {
      alerts.push({
        code: `DUPLICATE:${cls}`,
        severity: "MODERATE",
        message: `Possible duplicate therapy: ${names.join(" and ")} are both in the ${cls} class.`,
      });
    }
  }

  // 3. Drug–drug interactions via RxNav (public NLM service). Only medications
  // matched to RxNorm CUIs can be checked; anything else is reported as unknown.
  const rxCuis = [...referenceByDrug.values()].map((r) => r.rxCui).filter((c): c is string => Boolean(c));
  if (rxCuis.length >= 2) {
    const result = await checkRxNavInteractions(rxCuis);
    if (!result.available) {
      alerts.push({
        code: "INTERACTIONS_UNAVAILABLE",
        severity: "UNKNOWN",
        message: "Interaction information is currently unavailable from the drug database. Review manually before issuing.",
      });
    } else {
      for (const interaction of result.interactions) {
        alerts.push({
          code: `INTERACTION:${interaction.involved.join("+")}`,
          severity: interaction.severity === "high" ? "HIGH" : interaction.severity === "moderate" ? "MODERATE" : "LOW",
          message: `Possible interaction (${interaction.involved.join(" + ")}): ${interaction.description}`,
        });
      }
    }
  } else if (items.length >= 2) {
    alerts.push({
      code: "INTERACTIONS_UNAVAILABLE",
      severity: "UNKNOWN",
      message: "These medications are not matched to the interaction database, so automated interaction checks are unavailable. Review manually.",
    });
  }

  // 4. Patient-specific considerations (informational, not rules).
  if (context.age != null && context.age >= 65) {
    alerts.push({
      code: "AGE",
      severity: "INFO",
      message: "Patient is 65 or older: consider renal function, fall risk and the BEERS-type concerns relevant to the chosen medications.",
    });
  }
  if (context.isPregnant) {
    alerts.push({
      code: "PREGNANCY",
      severity: "HIGH",
      message: "Pregnancy is recorded in the patient history: verify each medication's safety in pregnancy before issuing.",
    });
  }
  if (context.weightKg != null && context.weightKg < 50) {
    alerts.push({
      code: "WEIGHT",
      severity: "INFO",
      message: "Patient weighs under 50 kg: verify weight-based dosing where applicable.",
    });
  }

  // 5. Antibiotic stewardship prompt.
  if (items.some((i) => i.antibioticClass)) {
    alerts.push({
      code: "ANTIBIOTIC",
      severity: "INFO",
      message: "Antibiotic prescribed: confirm the indication, intended bacterial coverage and duration are consistent with local antimicrobial guidance.",
    });
  }

  return alerts;
}
