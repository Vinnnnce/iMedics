/**
 * Cross-tenant access for the id-taking API routes (continues cross-tenant.int.test.ts).
 *
 * Each case seeds a real record owned by one facility or one patient, proves the rightful owner can
 * reach it on reads, then calls every route that takes its id as an outsider and requires:
 *   reads   -> 403 or 404
 *   writes  -> a refusal (400/403/404/409), never success, never a server error, and the stored row
 *              byte-for-byte unchanged afterwards.
 * Real authentication, real database, real route handlers.
 * Skipped unless HIS_TEST_DATABASE_URL points at a migrated, disposable, empty database.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acceptanceRoster } from "./his/acceptance-config";
import { createAcceptanceFixtures, type AcceptanceManifest } from "../../scripts/lib/his-fixtures";
import { seed } from "./test-support/seed";

let currentClerkId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: currentClerkId }), currentUser: async () => null,
  clerkClient: async () => ({ users: { getUserList: async () => ({ data: [], totalCount: 0 }) } }),
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => { void Promise.resolve().then(fn); } }));

const url = process.env.HIS_TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

type Row = { id: string } & Record<string, unknown>;
interface Probe {
  /** Query string for the request, e.g. "?userId=...". */
  query?: (row: Row) => string;
  /** Set only when the owner's identical request cannot succeed in a test environment (payment gateway, object storage). Say why. */
  ownerMayFail?: string;
  route: string; method: string; body?: unknown | ((row: Row) => unknown | Promise<unknown>); params?: (row: Row, aux: Record<string, string>) => Record<string, string>; path?: (params: Record<string, string>) => string }
interface Helpers { seed: (model: string, anchors?: Record<string, string>, values?: Record<string, unknown>) => Promise<Row>; a: Anchors }
type Kind = "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE" | "PHARMACY";
interface Spec {
  model: string; world: "facility" | "patient";
  /** Facility kind of the owner and the outsider (default HOSPITAL). Kind-gated routes need a matching outsider. */
  kind?: Kind;
  /** Hospital world: act as this fixture staff role (default owner) on both sides, for permission-gated routes. */
  as?: string;
  values?: (a: Anchors, h: Helpers) => Record<string, unknown> | Promise<Record<string, unknown>>;
  probes: Probe[]; owners?: string[]; skipControl?: boolean;
  /** The owner's read reaches a storage service that is not configured in tests, so a 5xx still proves access was granted. */
  storageControl?: boolean;
  /** Runs before each fresh row is seeded (clears a unique constraint left by the previous probe). */
  beforeEach?: (a: Anchors) => Promise<void>;
  /** Runs right after the row is seeded (children the route needs, such as a template's draft version). */
  afterSeed?: (row: Row, a: Anchors, h: Helpers) => Promise<void>;
  /** The owner is expected to be refused too (a record that must not be visible yet). */
  ownerDenied?: boolean;
}
interface Anchors { facilityId: string; patientId: string; userId: string; patient1: string; doctor1: string; userP1: string; userD1: string }

const g = (route: string, over: Partial<Probe> = {}): Probe => ({ route, method: "GET", ...over });
const w = (route: string, method: string, over: Partial<Probe> = {}): Probe => ({ route, method, ...over });

describe.skipIf(!url)("cross-tenant access by id: remaining routes", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  const runId = randomBytes(6).toString("hex");
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000", expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    instanceId: null, databaseHost: "localhost", databaseName: "xt2_test", users: [], facilities: [],
  };
  const clerk: Record<string, string> = {};
  const loaded = new Map<string, Record<string, (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>>>();
  const facility = (h: "a" | "b") => manifest.facilities.find((f) => f.hospital === h)!;
  const staff = (h: "a" | "b", role: string) => manifest.users.find((u) => u.hospital === h && u.role === role)!;
  let anchors: Anchors;
  interface Side { facilityId: string; clerk: string; userId: string }
  const pairs = {} as Record<Kind, { a: Side; b: Side }>;

  let current: Row = { id: "" };
  let lastMessage = "";
  async function call(as: string, probe: Probe, params: Record<string, string>, facilityId?: string) {
    currentClerkId = as;
    let mod = loaded.get(probe.route);
    if (!mod) { mod = (await import(/* @vite-ignore */ `@/app/api/${probe.route}/route`)) as never; loaded.set(probe.route, mod!); }
    let apiPath = `/api/${probe.route}`;
    for (const [k, v] of Object.entries(params)) apiPath = apiPath.replace(new RegExp(`\\[(\\.\\.\\.)?${k}\\]`), v);
    apiPath += probe.query ? probe.query(current) : "";
    const given = typeof probe.body === "function" ? await (probe.body as (r: Row) => unknown)(current) : probe.body;
    const body = probe.method === "GET" || (probe.method === "DELETE" && probe.body === undefined) ? undefined : JSON.stringify(given ?? {});
    const headers: Record<string, string> = {};
    if (body) headers["content-type"] = "application/json";
    if (facilityId) headers["x-facility-id"] = facilityId;
    try {
      const res = await mod![probe.method](new Request(`http://localhost:3000${apiPath}`, { method: probe.method, body, headers }), { params: Promise.resolve(params) });
      lastMessage = res.status >= 400 ? String((await res.clone().json().catch(() => ({})))?.error ?? "").slice(0, 140) : "";
      return res.status;
    } catch { return 599; }
  }
  const delegate = (model: string) => (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[model.charAt(0).toLowerCase() + model.slice(1)];
  const snapshot = async (model: string, id: string) => JSON.stringify(await delegate(model).findUnique({ where: { id } }), (_k, v) => (typeof v === "bigint" ? v.toString() : v));

  const WRITE_OK = [200, 201, 202, 204];

  /** A fresh row per probe, so no probe sees state left behind by another. */
  async function run(spec: Spec) {
    const facilityWorld = spec.world === "facility";
    const pair = pairs[spec.kind ?? "HOSPITAL"];
    const worldAnchors = facilityWorld
      ? { LabStaffProfile: pair.a.facilityId, Patient: anchors.patientId, User: pair.a.userId, DoctorProfile: anchors.doctor1 }
      : { LabStaffProfile: anchors.facilityId, Patient: anchors.patient1, User: anchors.userP1, DoctorProfile: anchors.doctor1 };
    const view: Anchors = facilityWorld ? { ...anchors, facilityId: pair.a.facilityId, userId: pair.a.userId } : anchors;
    const helpers: Helpers = { seed: (model, over, values) => seed(prisma, model, { anchors: { ...worldAnchors, ...over } }, values ?? {}), a: view };
    const actAs = (side: "a" | "b") => (spec.as && (spec.kind ?? "HOSPITAL") === "HOSPITAL" ? staff(side, spec.as).clerkId : pair[side].clerk);
    const ownerCallers = facilityWorld ? [{ clerk: actAs("a"), facilityId: pair.a.facilityId }] : (spec.owners ?? ["p1"]).map((k) => ({ clerk: clerk[k], facilityId: undefined as string | undefined }));
    const outsiders = facilityWorld ? [{ clerk: actAs("b"), facilityId: pair.b.facilityId }] : [{ clerk: clerk.p2, facilityId: undefined }, { clerk: clerk.d2, facilityId: undefined }];
    const problems: string[] = [];

    for (const probe of spec.probes) {
      await spec.beforeEach?.(view);
      const values = (await spec.values?.(view, helpers)) ?? {};
      const row = await seed(prisma, spec.model, { anchors: worldAnchors }, values);
      current = row;
      await spec.afterSeed?.(row, view, helpers);
      const params = probe.params ? probe.params(row, {}) : { id: row.id };
      const label = `${probe.method} ${probe.route}`;
      const isRead = probe.method === "GET";

      // 1. Outsiders first, against the untouched row.
      for (const who of outsiders) {
        const before = await snapshot(spec.model, row.id);
        const status = await call(who.clerk, probe, params, who.facilityId);
        const after = await snapshot(spec.model, row.id);
        if (process.env.XT_STATS) console.log(`XT ${probe.method} ${probe.route} ${status}`);
        const refused = isRead ? [403, 404].includes(status) : [400, 403, 404, 409].includes(status);
        if (!refused) problems.push(`${label} as outsider -> ${status}`);
        if (!isRead && before !== after) problems.push(`${label} as outsider CHANGED the stored ${spec.model}`);
      }

      // 2. The rightful owner, with the identical request, must get through. That proves the
      //    outsider was refused by authorization and not by a bad body, a state rule or the wrong kind.
      const statuses: number[] = [];
      const messages: string[] = [];
      for (const o of ownerCallers) { statuses.push(await call(o.clerk, probe, params, o.facilityId)); messages.push(lastMessage); }
      if (spec.ownerDenied) {
        if (!statuses.every((st) => [403, 404].includes(st))) problems.push(`${label}: expected even the owner to be refused (not released yet), got ${statuses.join(",")}`);
      } else if (isRead) {
        if (!statuses.some((st) => ![401, 403, 404].includes(st) && (spec.storageControl || st < 500))) problems.push(`${label}: the rightful owner could not reach it, got ${statuses.join(",")}`);
      } else if (probe.ownerMayFail) {
        // The request gets past authorization, then fails on something a test environment lacks.
        if (!statuses.some((st) => ![401, 403, 404].includes(st))) problems.push(`${label}: even past its external dependency the owner was refused (${statuses.join(",")}: ${messages.join(" | ")})`);
      } else if (!statuses.some((st) => WRITE_OK.includes(st))) {
        problems.push(`${label}: the rightful owner's identical request did not succeed (${statuses.join(",")}: ${messages.join(" | ")}), so the outsider test proves nothing`);
      }
    }
    return problems;
  }

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(prisma, manifest, identities);
    const user = async (key: string, role: "PATIENT" | "DOCTOR") => {
      clerk[key] = `xt2-${key}-${runId}`;
      return prisma.user.create({ data: { clerkId: clerk[key], email: `${key}-${runId}@xt2.test`, name: `XT ${key}`, role, onboardingComplete: true } });
    };
    const [u1, u2, ud1, ud2] = [await user("p1", "PATIENT"), await user("p2", "PATIENT"), await user("d1", "DOCTOR"), await user("d2", "DOCTOR")];
    // QA- prefix keeps the shared acceptance database synthetic-only: the
    // fixture guard refuses to build fixtures while any patient record
    // without the acceptance marker exists (parallel test files share it).
    const patient = (u: { id: string }, n: string) => prisma.patient.create({ data: { userId: u.id, caseNumber: `QA-X2-${runId}-${n}`, firstName: `Synthetic${n}`, lastName: "Patient", gender: "OTHER", dateOfBirth: new Date("1990-01-01") } });
    const [p1] = [await patient(u1, "1"), await patient(u2, "2")];
    const dp1 = await prisma.doctorProfile.create({ data: { userId: ud1.id, verificationStatus: "VERIFIED" } });
    await prisma.doctorProfile.create({ data: { userId: ud2.id, verificationStatus: "VERIFIED" } });
    await prisma.patientAssignment.create({ data: { patientId: p1.id, doctorId: dp1.id } });
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) await prisma.doctorSchedule.create({ data: { doctorId: dp1.id, dayOfWeek, startTime: "00:00", endTime: "23:30", slotMinutes: 30, isActive: true } });
    // Two independent facilities of every kind: the hospitals from the acceptance fixtures, plus
    // laboratories, diagnostic centres and pharmacies, so kind-gated routes get a same-kind outsider.
    pairs.HOSPITAL = { a: { facilityId: facility("a").id, clerk: staff("a", "owner").clerkId, userId: staff("a", "owner").userId }, b: { facilityId: facility("b").id, clerk: staff("b", "owner").clerkId, userId: staff("b", "owner").userId } };
    for (const kind of ["LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"] as const) {
      const make = async (side: "a" | "b"): Promise<Side> => {
        const clerkId = `xt2-${kind}-${side}-${runId}`;
        const owner = await prisma.user.create({ data: { clerkId, email: `${kind}-${side}-${runId}@xt2.test`.toLowerCase(), name: `XT ${kind} ${side}`, role: "LAB_SCIENTIST", accountType: kind, status: "ACTIVE", onboardingComplete: true } });
        const profile = await prisma.labStaffProfile.create({ data: { userId: owner.id, laboratoryName: `SYNTHETIC ${kind} ${side} ${runId}`, kind, verificationStatus: "VERIFIED", isPublished: false, departments: [] } });
        await prisma.hospitalSettings.create({ data: { facilityId: profile.id, independentTemplateApproval: true } });
        await prisma.facilityStaff.create({ data: { facilityId: profile.id, userId: owner.id, email: owner.email, fullName: `SYNTHETIC owner ${kind} ${side}`, facilityRole: "OWNER", status: "ACTIVE", accessLevel: "FULL", professionalTitle: "Synthetic test fixture", publicProfileVisible: false, profileConsent: false } });
        return { facilityId: profile.id, clerk: clerkId, userId: owner.id };
      };
      pairs[kind] = { a: await make("a"), b: await make("b") };
    }
    anchors = { facilityId: facility("a").id, patientId: facility("a").patientId, userId: staff("a", "author").userId, patient1: p1.id, doctor1: dp1.id, userP1: u1.id, userD1: ud1.id };
  }, 120_000);
  afterAll(async () => { await prisma.$disconnect(); });

  /** A diagnostic centre's issued report, sent to Hospital A (the requesting hospital). */
  async function issuedReportChain(a: Anchors, h: Helpers, withReport = true) {
    const centre = await h.seed("LabStaffProfile", {}, { kind: "DIAGNOSTIC_CENTRE" });
    const service = await h.seed("FacilityService", { LabStaffProfile: centre.id });
    const booking = await h.seed("FacilityBooking", { LabStaffProfile: centre.id }, { serviceId: service.id, requestingFacilityId: a.facilityId });
    const report = withReport ? await h.seed("DiagnosticReport", { LabStaffProfile: centre.id }, { bookingId: booking.id, facilityId: centre.id, sentToFacilityId: a.facilityId, status: "SENT" }) : null;
    return { centre, booking, report };
  }
  const inDays = (days: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + days, 10, 0, 0));
  async function publishedVersion(a: Anchors, h: Helpers) {
    const template = await h.seed("ClinicalDocumentTemplate");
    const version = await h.seed("ClinicalDocumentTemplateVersion", {}, { templateId: template.id, version: 1, status: "PUBLISHED", definition: DEFINITION, editedById: a.userId });
    return version.id;
  }
  const DEFINITION = { sections: [{ id: "s", title: "Course", fields: [{ id: "c", label: "Hospital course", type: "textarea" }] }] };
  const mediaKeyPatient = (a: Anchors) => ({ storageKey: `medical-media/final/${a.facilityId}/${a.patient1}/${randomBytes(4).toString("hex")}`, patientId: a.patient1 });
  const mediaKey = (a: Anchors) => ({ storageKey: `medical-media/final/${a.facilityId}/${a.patientId}/${randomBytes(4).toString("hex")}` });

  const facilitySpecs: Spec[] = [
    { model: "Admission", world: "facility", values: async (_a, h) => ({ patientId: (await h.seed("Patient")).id }), probes: [g("facility/admissions/[id]"), w("facility/admissions/[id]", "PATCH"), w("facility/admissions/[id]/notes", "POST", { body: { type: "PHYSICIAN_PROGRESS", content: "Progress note written by an outsider" } }), w("facility/admissions/[id]/discharge", "POST", { body: { dischargeDate: new Date().toISOString(), disposition: "RECOVERED", epicrisis: "Discharged in good condition." } }), w("facility/admissions/[id]/transfers", "POST", { body: { toWard: "Ward Z", reason: "Outsider transfer" } })] },
    { model: "Ward", world: "facility", probes: [w("facility/his/wards/[id]", "PATCH"), w("facility/his/wards/[id]", "DELETE"), w("facility/his/wards/[id]", "POST", { body: { labels: ["T1", "T2"] } })] },
    { model: "Bed", world: "facility", probes: [w("facility/his/beds/[id]", "PATCH", { body: { action: "BLOCK_MAINTENANCE" } })] },
    { model: "Specimen", world: "facility", kind: "LABORATORY", probes: [w("facility/specimens/[id]", "PATCH", { body: { action: "COLLECT" } })] },
    { model: "LabOrder", world: "facility", kind: "LABORATORY", values: (a) => ({ performingFacilityId: a.facilityId }), probes: [w("facility/lab-orders/[id]", "PATCH", { body: { action: "ACCEPT" } })] },
    { model: "DiagnosticReport", world: "facility", values: async (a, h) => { const c = await issuedReportChain(a, h, false); return { bookingId: c.booking.id, facilityId: c.centre.id, sentToFacilityId: a.facilityId, status: "SENT" }; }, probes: [g("facility/diagnostic-reports/[id]")] },
    { model: "DiagnosticReport", world: "facility", kind: "DIAGNOSTIC_CENTRE", values: async (_a, h) => ({ preliminaryFindings: "Findings recorded for the test.", bookingId: (await h.seed("FacilityBooking", {}, { serviceId: (await h.seed("FacilityService")).id })).id }), probes: [g("facility/diagnostic-reports/[id]"), w("facility/diagnostic-reports/[id]", "PATCH", { body: { findings: "Findings written by an outsider" } }), w("facility/diagnostic-reports/[id]/action", "POST", { body: { action: "SUBMIT" } })] },
    { model: "DiagnosticImage", world: "facility", kind: "DIAGNOSTIC_CENTRE", storageControl: true, values: async (_a, h) => ({ bookingId: (await h.seed("FacilityBooking", {}, { serviceId: (await h.seed("FacilityService")).id })).id }), probes: [g("facility/diagnostic-images/[id]")] },
    { model: "FacilityBooking", world: "facility", kind: "DIAGNOSTIC_CENTRE", values: async (_a, h) => ({ serviceId: (await h.seed("FacilityService")).id }), probes: [w("facility-bookings/[id]", "PATCH", { body: { status: "CONFIRMED" } })] },
    { model: "DiagnosticImage", world: "facility", storageControl: true, values: async (a, h) => { const c = await issuedReportChain(a, h); return { bookingId: c.booking.id, reportId: c.report!.id }; }, probes: [g("facility/diagnostic-images/[id]")] },
    { model: "MedicalMedia", world: "facility", storageControl: true, values: (a) => ({ ...mediaKey(a), scanStatus: "CLEAN" }), probes: [g("facility/his/media/[id]"), w("facility/his/media/[id]", "PATCH", { body: { action: "revoke" } })] },
    { model: "MedicationOrder", world: "facility", as: "pharmacist", values: () => ({ status: "SUBMITTED" }), probes: [w("facility/his/medication-orders/[id]", "PATCH", { body: { status: "REVIEWED" } })] },
    { model: "MedicationOrder", world: "facility", as: "nurse", values: () => ({ status: "DISPENSED" }), probes: [w("facility/his/medication-orders/[id]/administrations", "POST", { body: { status: "GIVEN", administeredDose: "500 mg", route: "oral" } })] },
    { model: "NursingTask", world: "facility", probes: [w("facility/his/nursing/tasks/[id]", "PATCH", { body: { status: "COMPLETED" } })] },
    { model: "RegistrationDraft", world: "facility", probes: [w("facility/his/registration/drafts/[id]", "PATCH"), w("facility/his/registration/drafts/[id]", "DELETE")] },
    { model: "PayerCoverage", world: "facility", probes: [g("facility/his/coverage/[id]"), w("facility/his/coverage/[id]", "PATCH", { body: { action: "end", reason: "Coverage ended by the payer" } })] },
    { model: "FormularyItem", world: "facility", probes: [w("facility/his/formulary/[id]", "PATCH", { body: { action: "deactivate" } })] },
    { model: "MedicationInteractionRule", world: "facility", probes: [w("facility/his/interaction-rules/[id]", "PATCH", { body: { action: "deactivate" } })] },
    { model: "LabEquipment", world: "facility", kind: "LABORATORY", probes: [w("facility/his/lab/equipment/[id]", "PATCH", { body: { action: "SET_STATUS", status: "MAINTENANCE" } })] },
    { model: "CriticalResultAlert", world: "facility", as: "reviewer", values: (a) => ({ orderingFacilityId: a.facilityId }), probes: [w("facility/critical-alerts/[id]", "POST")] },
    { model: "FacilityDepartment", world: "facility", probes: [w("facility/departments/[id]", "PATCH"), w("facility/departments/[id]", "DELETE")] },
    { model: "FacilityBranch", world: "facility", probes: [w("facility/branches/[id]", "PATCH"), w("facility/branches/[id]", "DELETE")] },
    { model: "FacilityAccreditation", world: "facility", probes: [w("facility/accreditations/[id]", "PATCH"), w("facility/accreditations/[id]", "DELETE")] },
    { model: "StaffCredential", world: "facility", probes: [w("facility/credentials/[id]", "PATCH"), w("facility/credentials/[id]", "DELETE")] },
    { model: "FacilityService", world: "facility", probes: [w("facility/services/[id]", "PATCH"), w("facility/services/[id]", "DELETE")] },
    { model: "FacilityDocumentTemplate", world: "facility", probes: [w("facility/document-templates/[id]", "PUT", { body: { name: "Renamed template" } }), w("facility/document-templates/[id]", "DELETE")] },
    { model: "FacilityReferral", world: "facility", probes: [w("facility/referrals/[id]", "PATCH", { body: { status: "DECLINED" } })] },
    { model: "ClinicalDocument", world: "facility", as: "author", values: async (a, h) => ({ authorId: staff("a", "author").userId, templateVersionId: await publishedVersion(a, h) }), probes: [g("facility/his/documents/[id]"), w("facility/his/documents/[id]", "PUT", { body: { content: { c: "Hospital course written for the test." } } }), g("facility/his/documents/[id]/pdf"), g("facility/his/documents/[id]/fhir"), w("facility/his/documents/[id]/actions", "POST", { body: { action: "submit" } })] },
    { model: "ClinicalDocumentTemplate", world: "facility", afterSeed: async (row, a, h) => { await h.seed("ClinicalDocumentTemplateVersion", {}, { templateId: row.id, version: 1, status: "DRAFT", definition: DEFINITION, editedById: a.userId }); }, probes: [g("facility/his/templates/[id]"), w("facility/his/templates/[id]", "PUT", { body: { definition: DEFINITION, changeNote: "Edited by an outsider" } }), g("facility/his/templates/[id]/export"), w("facility/his/templates/[id]/actions", "POST", { body: { action: "retire" } })] },
    { model: "Encounter", world: "facility", values: () => ({ type: "EMERGENCY_DEPARTMENT", isEmergency: true }), probes: [w("facility/his/emergency/[id]", "PATCH", { body: { note: "Update written by an outsider" } })] },
    { model: "LabResult", world: "facility", kind: "LABORATORY", values: (a) => ({ uploadedById: a.userId }), probes: [w("labs/[id]/files", "POST", { body: { fileName: "result.pdf", mimeType: "application/pdf", sizeBytes: 1000 }, ownerMayFail: "presigns an upload URL; object storage is not configured in tests" }), w("labs/[id]/files/confirm", "POST", { body: (r: Row) => ({ key: `lab-results/${r.id}/result.pdf`, fileName: "result.pdf", mimeType: "application/pdf" }), ownerMayFail: "verifies the stored object; object storage is not configured in tests" })] },
    { model: "MedicalMediaUploadSession", world: "facility", values: (a) => ({ ...mediaKey(a), status: "ACTIVE", expiresAt: new Date(Date.now() + 3_600_000) }), probes: [w("facility/his/media/multipart/[id]/abort", "POST", { ownerMayFail: "aborts the multipart upload in object storage, which is not configured in tests" }), w("facility/his/media/multipart/[id]/complete", "POST", { ownerMayFail: "verifies uploaded parts in object storage, which is not configured in tests" }), w("facility/his/media/multipart/[id]/parts", "POST", { ownerMayFail: "presigns part URLs; object storage is not configured in tests" })] },
  ];

  describe("facilities", () => {
    for (const spec of facilitySpecs) {
      it(`${spec.model}: Hospital B cannot read or change Hospital A's ${spec.model}`, async () => {
        expect(await run(spec)).toEqual([]);
      }, 60_000);
    }
  });

  const ofPatient = (row: Row) => ({ id: String(row.patientId) });
  const patientSpecs: Spec[] = [
    { model: "LabResultFile", world: "patient", storageControl: true, owners: ["p1"], probes: [g("files/[id]")] },
    { model: "DoctorFile", world: "patient", storageControl: true, owners: ["d1"], probes: [g("doctor-files/[id]")] },
    { model: "PatientDocument", world: "patient", beforeEach: async (a) => { await prisma.labStaffProfile.update({ where: { id: a.facilityId }, data: { isPublished: true } }); }, probes: [w("patient/documents/[id]/shares", "POST", { body: () => ({ sharedWithUserId: anchors.userD1, role: "DOCTOR" }) }), w("patient/documents/[id]/shares", "DELETE", { query: () => `?userId=${anchors.userD1}` }), g("patient/documents/[id]/facility-shares"), w("patient/documents/[id]/facility-shares", "POST", { body: () => ({ facilityId: anchors.facilityId }) }), w("patient/documents/[id]/facility-shares", "DELETE", { query: () => `?facilityId=${anchors.facilityId}` })] },
    { model: "MedicalMedia", world: "patient", storageControl: true, values: (a) => ({ ...mediaKeyPatient(a), scanStatus: "CLEAN", reportStatus: "VERIFIED", releasedToPatientAt: new Date() }), probes: [g("patient/media/[id]")] },
    { model: "MedicalMedia", world: "patient", ownerDenied: true, values: (a) => ({ ...mediaKeyPatient(a), scanStatus: "CLEAN", reportStatus: "UNREPORTED" }), probes: [g("patient/media/[id]")] },
    { model: "MedicalMedia", world: "patient", ownerDenied: true, values: (a) => ({ ...mediaKeyPatient(a), scanStatus: "NOT_SCANNED", reportStatus: "VERIFIED", releasedToPatientAt: new Date() }), probes: [g("patient/media/[id]")] },
    { model: "MedicalHistory", world: "patient", owners: ["d1", "p1"], probes: [
      g("patients/[id]/history/[historyId]", { params: (r) => ({ id: String(r.patientId), historyId: r.id }) }),
      w("patients/[id]/history/[historyId]", "PUT", { body: { symptoms: [], medications: [], hasWound: false, hasDiabetes: false, hasStroke: false, hasHeartAttack: false, familyHistory: [], pastHistory: [], allergies: [], mentalHealth: [], immunizations: [], status: "draft" }, params: (r) => ({ id: String(r.patientId), historyId: r.id }) }),
      w("patients/[id]/history/[historyId]", "DELETE", { params: (r) => ({ id: String(r.patientId), historyId: r.id }) }),
      w("patients/[id]/history/[historyId]/ai", "POST", { params: (r) => ({ id: String(r.patientId), historyId: r.id }) }),
      g("patients/[id]/history", { params: ofPatient }), w("patients/[id]/history", "POST", { body: { symptoms: [], medications: [], hasWound: false, hasDiabetes: false, hasStroke: false, hasHeartAttack: false, familyHistory: [], pastHistory: [], allergies: [], mentalHealth: [], immunizations: [], status: "draft" }, params: ofPatient }), g("patients/[id]/fhir", { params: ofPatient }),
    ] },
    { model: "MedicationReminder", world: "patient", probes: [w("patient/reminders/[id]", "PATCH"), w("patient/reminders/[id]", "DELETE"), w("patient/reminders/[id]", "POST", { body: async (r: Row) => ({ doseEventId: (await seed(prisma, "DoseEvent", { anchors: { Patient: anchors.patient1, User: anchors.userP1 } }, { reminderId: r.id })).id, status: "TAKEN" }) })] },
    { model: "AiAnalysis", world: "patient", owners: ["d1"], values: async (_a, h) => ({ labResultId: (await h.seed("LabResult")).id, reviewStatus: "PENDING_REVIEW", status: "COMPLETED", patientView: "A short summary for the patient." }), probes: [w("ai-analyses/[id]/review", "POST", { body: { decision: "APPROVED" } })] },
    { model: "Consultation", world: "patient", owners: ["p1", "d1"], values: () => ({ status: "FINALIZED" }), probes: [g("consultations/[id]/pdf"), g("consultations/[id]/revisions")] },
    { model: "CareCase", world: "patient", owners: ["d1"], probes: [w("cases/[id]/status", "POST", { body: { status: "CLOSED" } })] },
    { model: "Appointment", world: "patient", owners: ["p1", "d1"], values: () => ({ scheduledAt: inDays(7), status: "BOOKED" }), probes: [w("appointments/[id]/reschedule", "POST", { body: () => ({ scheduledAt: inDays(14).toISOString() }) })] },
    { model: "Payment", world: "patient", probes: [w("payments/[id]/verify", "POST"), w("payments/[id]/checkout", "POST", { body: { method: "CARD" }, ownerMayFail: "starts a gateway checkout, which needs payment provider credentials" })] },
    { model: "Payment", world: "patient", values: () => ({ status: "SUCCESSFUL", paidAt: new Date() }), probes: [w("payments/[id]/refund-request", "POST", { body: { reason: "The service was not delivered as agreed" } })] },
    { model: "Conversation", world: "patient", owners: ["p1", "d1"], beforeEach: async (a) => { const old = await prisma.conversation.findMany({ where: { patientId: a.patient1, doctorId: a.doctor1 }, select: { id: true } }); for (const c of old) { await prisma.chatMessage.deleteMany({ where: { conversationId: c.id } }); await prisma.conversation.delete({ where: { id: c.id } }); } }, probes: [g("conversations/[id]/messages"), w("conversations/[id]/messages", "POST", { body: { body: "Hello from the test" } }), w("conversations/[id]/messages/upload", "POST", { body: { mimeType: "image/png", sizeBytes: 1000 }, ownerMayFail: "presigns an upload URL; object storage is not configured in tests" })] },
    { model: "ChatMessage", world: "patient", owners: ["p1", "d1"], storageControl: true, values: async (a) => ({ type: "IMAGE", attachmentKey: `chat/${randomBytes(4).toString("hex")}.png`, conversationId: (await prisma.conversation.findFirstOrThrow({ where: { patientId: a.patient1, doctorId: a.doctor1 } })).id }), probes: [g("conversations/[id]/messages/[messageId]/attachment", { params: (r) => ({ id: String(r.conversationId), messageId: r.id }) })] },
    { model: "VerificationDocument", world: "patient", probes: [w("me/documents/[id]", "DELETE", { ownerMayFail: "deleting the file calls object storage, which is not configured in tests" })] },
  ];

  describe("patients and doctors", () => {
    for (const spec of patientSpecs) {
      it(`${spec.model}${spec.ownerDenied ? " (not released)" : ""}: another patient or an unrelated doctor cannot read or change it`, async () => {
        expect(await run(spec)).toEqual([]);
      }, 60_000);
    }
  });
});
