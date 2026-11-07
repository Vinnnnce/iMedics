import { badRequest, conflict } from "@/lib/errors";

/**
 * MAR administration, formulary and interaction checking domain rules.
 *
 * Boundaries (mirroring the delivery plan, now with the product owner's
 * explicit scope change): the interaction engine only reports pairs the
 * hospital's own staff configured, with the severity they chose. It never
 * invents rules, recommends dosing or blocks a prescriber — alerts are
 * advisory information for the qualified clinician.
 */

/** MAR entry statuses: administration or its documented absence. */
export const ADMINISTRATION_STATUSES = ["GIVEN", "HELD", "REFUSED", "OMITTED"] as const;
export type AdministrationStatus = (typeof ADMINISTRATION_STATUSES)[number];

/** An order can only be administered once it has left draft and is not cancelled. */
const ADMINISTRABLE_ORDER_STATUSES = ["SUBMITTED", "REVIEWED", "DISPENSED", "COMPLETED"];

export function validateAdministration(orderStatus: string, status: string): AdministrationStatus {
  if (!ADMINISTRATION_STATUSES.includes(status as AdministrationStatus)) throw badRequest("Unknown administration status");
  if (!ADMINISTRABLE_ORDER_STATUSES.includes(orderStatus)) {
    throw conflict(`A ${orderStatus.toLowerCase()} order cannot be administered; draft orders must be submitted and cancelled orders are closed`);
  }
  if (status === "HELD" || status === "REFUSED" || status === "OMITTED") {
    // Non-administration entries exist to document what did NOT happen; the
    // administered dose stays empty for them by construction.
  }
  return status as AdministrationStatus;
}

/** Interaction rule severities the facility can configure. */
export const INTERACTION_SEVERITIES = ["ADVISORY", "WARNING", "CRITICAL"] as const;
export type InteractionSeverity = (typeof INTERACTION_SEVERITIES)[number];

export function validateInteractionRule(medicationA: string, medicationB: string, severity: string) {
  const a = medicationA.trim(), b = medicationB.trim();
  if (!a || !b) throw badRequest("Both medications in an interaction rule are required");
  if (a.toLowerCase() === b.toLowerCase()) throw badRequest("An interaction rule needs two different medications");
  if (!INTERACTION_SEVERITIES.includes(severity as InteractionSeverity)) throw badRequest("Unknown interaction severity");
  return { medicationA: a, medicationB: b, severity: severity as InteractionSeverity };
}

export interface InteractionAlert {
  kind: "INTERACTION";
  severity: InteractionSeverity;
  between: [string, string];
  description: string;
}

export interface AllergyAlert {
  kind: "ALLERGY";
  allergen: string;
}

export type MedicationSafetyAlert = InteractionAlert | AllergyAlert;

/** Normalize a medication name for rule matching: trim, case-insensitive. */
const normalize = (name: string) => name.trim().toLowerCase();

/** Match one configured rule against a new medication and the patient's other medications. */
export function ruleMatches(rule: { medicationA: string; medicationB: string }, newMedication: string, otherMedications: readonly string[]): boolean {
  const medication = normalize(newMedication);
  const others = otherMedications.map(normalize);
  const a = normalize(rule.medicationA);
  const b = normalize(rule.medicationB);
  return (medication === a && others.includes(b)) || (medication === b && others.includes(a));
}

/**
 * Check a new medication against the facility's configured rules and the
 * patient's other active medications. Returns the configured alerts — nothing
 * more. This is advisory decision support, not a prescribing restriction.
 */
export function checkInteractions(
  newMedication: string,
  otherMedications: readonly string[],
  rules: readonly { medicationA: string; medicationB: string; severity: string; description: string; active?: boolean }[],
): InteractionAlert[] {
  return rules
    .filter((rule) => rule.active !== false && ruleMatches(rule, newMedication, otherMedications))
    .map((rule) => ({
      kind: "INTERACTION" as const,
      severity: rule.severity as InteractionSeverity,
      between: [rule.medicationA, rule.medicationB] as [string, string],
      description: rule.description,
    }));
}

/** Extract plain-text allergen names from the stored allergies JSON shape. */
export function allergenNames(allergies: unknown): string[] {
  if (!Array.isArray(allergies)) return [];
  return allergies
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "name" in entry && typeof (entry as { name: unknown }).name === "string") {
        return (entry as { name: string }).name;
      }
      return null;
    })
    .filter((name): name is string => Boolean(name));
}

/** Flag a medication whose name contains a recorded allergen (e.g. "Penicillin" vs "penicillin G"). */
export function checkAllergy(medicationName: string, allergies: unknown): AllergyAlert | null {
  const medication = normalize(medicationName);
  for (const allergen of allergenNames(allergies)) {
    if (allergen && medication.includes(normalize(allergen))) {
      return { kind: "ALLERGY", allergen };
    }
  }
  return null;
}

/**
 * Outbound e-prescribing boundary. Submitting an order enqueues a payload here;
 * delivery is attempted only when an external endpoint is explicitly configured
 * (EPRESCRIBING_ENDPOINT). Without it the entry stays PENDING — a documented
 * dependency, never a claimed live transmission.
 */
export interface EPrescriptionPayload {
  order: {
    id: string;
    medicationName: string;
    strength: string | null;
    dose: string | null;
    route: string | null;
    frequency: string | null;
    duration: string | null;
    notes: string | null;
    prescriberId: string;
    status: string;
  };
  patient: { id: string; caseNumber: string };
  facilityId: string;
  enqueuedAt: string;
}

export function buildEPrescriptionPayload(input: {
  orderId: string;
  facilityId: string;
  patientId: string;
  caseNumber: string;
  order: { medicationName: string; strength: string | null; dose: string | null; route: string | null; frequency: string | null; duration: string | null; notes: string | null; prescriberId: string; status: string };
}): EPrescriptionPayload {
  return {
    order: {
      id: input.orderId,
      medicationName: input.order.medicationName,
      strength: input.order.strength,
      dose: input.order.dose,
      route: input.order.route,
      frequency: input.order.frequency,
      duration: input.order.duration,
      notes: input.order.notes,
      prescriberId: input.order.prescriberId,
      status: input.order.status,
    },
    patient: { id: input.patientId, caseNumber: input.caseNumber },
    facilityId: input.facilityId,
    enqueuedAt: new Date().toISOString(),
  };
}

/** Deliver a queued payload to the configured endpoint. Returns the outcome; the caller records it. */
export async function deliverEPrescription(
  endpoint: string | undefined,
  payload: EPrescriptionPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ delivered: boolean; error?: string }> {
  if (!endpoint) return { delivered: false, error: "No external e-prescribing endpoint is configured (EPRESCRIBING_ENDPOINT)" };
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { delivered: false, error: `Endpoint returned HTTP ${response.status}` };
    return { delivered: true };
  } catch (error) {
    return { delivered: false, error: error instanceof Error ? error.message : "Delivery failed" };
  }
}
