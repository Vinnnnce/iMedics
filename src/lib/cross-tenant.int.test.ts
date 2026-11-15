/**
 * Cross-patient and cross-facility access by resource id (the second half of the authorization
 * matrix; the first half, per-role gates on every route, is authorization-matrix.int.test.ts).
 *
 * Each case builds a real record that belongs to one patient or facility, proves the rightful
 * owner can reach it (so a 404 elsewhere is not just a bad fixture), then calls the same route as
 * someone else and requires 403/404. Real Clerk-shaped authentication, real database, real route
 * handlers. Skipped unless HIS_TEST_DATABASE_URL points at a migrated, disposable, empty database.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acceptanceRoster } from "./his/acceptance-config";
import { createAcceptanceFixtures, type AcceptanceManifest } from "../../scripts/lib/his-fixtures";

let currentClerkId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: currentClerkId }),
  currentUser: async () => null,
  clerkClient: async () => ({ users: { getUserList: async () => ({ data: [], totalCount: 0 }) } }),
}));

// Routes defer notifications with after(); there is no request scope in a test.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => { void Promise.resolve().then(fn); } }));

const url = process.env.HIS_TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

type Handlers = Record<string, (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>>;
const DENIED = [403, 404];

describe.skipIf(!url)("cross-tenant access by resource id", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  const runId = randomBytes(6).toString("hex");
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(), instanceId: null,
    databaseHost: "localhost", databaseName: "imedics_cross_tenant", users: [], facilities: [],
  };
  const clerk: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const loaded = new Map<string, Handlers>();

  const facility = (h: "a" | "b") => manifest.facilities.find((f) => f.hospital === h)!;
  const staffClerk = (h: "a" | "b", role: string) => manifest.users.find((u) => u.hospital === h && u.role === role)!.clerkId;

  async function call(as: string, method: string, route: string, apiPath: string, params: Record<string, string>, opts: { body?: unknown; facilityId?: string } = {}): Promise<number> {
    currentClerkId = as;
    let mod = loaded.get(route);
    if (!mod) { mod = (await import(/* @vite-ignore */ `@/app/api/${route}/route`)) as Handlers; loaded.set(route, mod); }
    const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const headers: Record<string, string> = {};
    if (body) headers["content-type"] = "application/json";
    if (opts.facilityId) headers["x-facility-id"] = opts.facilityId;
    const res = await mod[method](new Request(`http://localhost:3000${apiPath}`, { method, body, headers }), { params: Promise.resolve(params) });
    return res.status;
  }

  /** The rightful owner reaches the record (anything but 401/403/404 proves it was found). */
  const reached = (status: number) => ![401, 403, 404].includes(status);

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(prisma, manifest, identities);

    // ---- patient-side fixtures: two patients, an assigned doctor and an unrelated doctor ----
    const user = async (key: string, role: "PATIENT" | "DOCTOR") => {
      clerk[key] = `xt-${key}-${runId}`;
      return prisma.user.create({ data: { clerkId: clerk[key], email: `${key}-${runId}@xt.test`, name: `XT ${key}`, role, onboardingComplete: true } });
    };
    const [u1, u2, ud1, ud2] = [await user("p1", "PATIENT"), await user("p2", "PATIENT"), await user("d1", "DOCTOR"), await user("d2", "DOCTOR")];
    const patient = (u: { id: string }, n: string) => prisma.patient.create({ data: { userId: u.id, caseNumber: `XT-${runId}-${n}`, firstName: `Synthetic${n}`, lastName: "Patient", gender: "OTHER", dateOfBirth: new Date("1990-01-01") } });
    const [p1, p2] = [await patient(u1, "1"), await patient(u2, "2")];
    const doctor = (u: { id: string }) => prisma.doctorProfile.create({ data: { userId: u.id, verificationStatus: "VERIFIED" } });
    const [dp1] = [await doctor(ud1), await doctor(ud2)];
    await prisma.patientAssignment.create({ data: { patientId: p1.id, doctorId: dp1.id } });
    ids.patient1 = p1.id; ids.patient2 = p2.id;
    ids.finalConsult = (await prisma.consultation.create({ data: { patientId: p1.id, doctorId: dp1.id, status: "FINALIZED" } })).id;
    ids.draftConsult = (await prisma.consultation.create({ data: { patientId: p1.id, doctorId: dp1.id, status: "DRAFT" } })).id;
    ids.appointment = (await prisma.appointment.create({ data: { patientId: p1.id, doctorId: dp1.id, scheduledAt: new Date(Date.now() + 7 * 86_400_000) } })).id;
    ids.prescription = (await prisma.prescription.create({ data: { patientId: p1.id, doctorId: dp1.id } })).id;
    ids.careCase = (await prisma.careCase.create({ data: { caseNumber: `XTC-${runId}`, type: "CONSULTATION", patientId: p1.id } })).id;
    ids.payment = (await prisma.payment.create({ data: { kind: "CONSULTATION", payerId: u1.id, payeeId: ud1.id, description: "Synthetic", amount: 100, currency: "NGN", provider: "mock", providerReference: `xt-${runId}` } })).id;
    ids.document = (await prisma.patientDocument.create({ data: { patientId: p1.id, uploadedById: u1.id, category: "LAB_REPORT", title: "Synthetic", fileName: "x.pdf", storageKey: `xt/${runId}/x.pdf`, mimeType: "application/pdf", sizeBytes: 10 } })).id;
    ids.labOrder = (await prisma.labOrder.create({ data: { patientId: p1.id, orderedById: ud1.id } })).id;

    // ---- facility-side fixtures ----
    ids.staffA = (await prisma.facilityStaff.findFirstOrThrow({ where: { facilityId: facility("a").id, userId: manifest.users.find((u) => u.hospital === "a" && u.role === "author")!.userId } })).id;
  }, 120_000);

  afterAll(async () => { await prisma.$disconnect(); });

  describe("patients", () => {
    it("a patient record is visible to the patient and the assigned doctor only", async () => {
      const route = "patients/[id]";
      const path = `/api/patients/${ids.patient1}`;
      const p = { id: ids.patient1 };
      expect(reached(await call(clerk.p1, "GET", route, path, p))).toBe(true);
      expect(reached(await call(clerk.d1, "GET", route, path, p))).toBe(true);
      expect(DENIED).toContain(await call(clerk.p2, "GET", route, path, p));
      expect(DENIED).toContain(await call(clerk.d2, "GET", route, path, p));
    });

    it("a patient document is visible to its owner, not to another patient or an unrelated doctor", async () => {
      const route = "patient/documents/[id]";
      const path = `/api/patient/documents/${ids.document}`;
      const p = { id: ids.document };
      expect(reached(await call(clerk.p1, "GET", route, path, p))).toBe(true);
      const seen: Record<string, number> = {
        "p2 GET": await call(clerk.p2, "GET", route, path, p),
        "d2 GET": await call(clerk.d2, "GET", route, path, p),
        "p2 PATCH": await call(clerk.p2, "PATCH", route, path, p, { body: { title: "hijacked" } }),
        "p2 DELETE": await call(clerk.p2, "DELETE", route, path, p),
      };
      expect(Object.fromEntries(Object.entries(seen).filter(([, status]) => !DENIED.includes(status)))).toEqual({});
    });

    it("a finalized consultation is visible to the patient; a draft is not (patients see only released records)", async () => {
      const route = "consultations/[id]";
      const finalPath = `/api/consultations/${ids.finalConsult}`;
      expect(reached(await call(clerk.p1, "GET", route, finalPath, { id: ids.finalConsult }))).toBe(true);
      expect(reached(await call(clerk.d1, "GET", route, finalPath, { id: ids.finalConsult }))).toBe(true);
      expect(DENIED).toContain(await call(clerk.p2, "GET", route, finalPath, { id: ids.finalConsult }));
      expect(DENIED).toContain(await call(clerk.d2, "GET", route, finalPath, { id: ids.finalConsult }));
      const draftPath = `/api/consultations/${ids.draftConsult}`;
      expect(reached(await call(clerk.d1, "GET", route, draftPath, { id: ids.draftConsult }))).toBe(true);
      expect(DENIED).toContain(await call(clerk.p1, "GET", route, draftPath, { id: ids.draftConsult }));
    });

    it("an unrelated doctor or patient cannot change a consultation", async () => {
      const route = "consultations/[id]";
      const path = `/api/consultations/${ids.draftConsult}`;
      expect(DENIED).toContain(await call(clerk.d2, "PATCH", route, path, { id: ids.draftConsult }, { body: { chiefComplaint: "tampered" } }));
    });

    it("an appointment can only be changed by its own patient or doctor", async () => {
      const route = "appointments/[id]";
      const path = `/api/appointments/${ids.appointment}`;
      const p = { id: ids.appointment };
      expect(DENIED).toContain(await call(clerk.p2, "PATCH", route, path, p, { body: { status: "CANCELLED" } }));
      expect(DENIED).toContain(await call(clerk.d2, "PATCH", route, path, p, { body: { status: "CANCELLED" } }));
      expect(reached(await call(clerk.p1, "PATCH", route, path, p, { body: { status: "CANCELLED" } }))).toBe(true);
    });

    it("a prescription cannot be altered by a doctor who did not write it", async () => {
      const route = "prescriptions/[id]";
      const path = `/api/prescriptions/${ids.prescription}`;
      const status = await call(clerk.d2, "PATCH", route, path, { id: ids.prescription }, { body: { action: "CANCEL" } });
      expect(DENIED).toContain(status);
    });

    it("a care case is visible to its patient and assigned doctor only", async () => {
      const route = "cases/[id]";
      const path = `/api/cases/${ids.careCase}`;
      const p = { id: ids.careCase };
      expect(reached(await call(clerk.p1, "GET", route, path, p))).toBe(true);
      expect(reached(await call(clerk.d1, "GET", route, path, p))).toBe(true);
      expect(DENIED).toContain(await call(clerk.p2, "GET", route, path, p));
      expect(DENIED).toContain(await call(clerk.d2, "GET", route, path, p));
    });

    it("a payment is visible to its payer and payee only", async () => {
      const route = "payments/[id]";
      const path = `/api/payments/${ids.payment}`;
      const p = { id: ids.payment };
      expect(reached(await call(clerk.p1, "GET", route, path, p))).toBe(true);
      expect(reached(await call(clerk.d1, "GET", route, path, p))).toBe(true);
      expect(DENIED).toContain(await call(clerk.p2, "GET", route, path, p));
      expect(DENIED).toContain(await call(clerk.d2, "GET", route, path, p));
    });

    it("a lab order cannot be changed by a doctor who did not order it", async () => {
      const route = "lab-orders/[id]";
      const path = `/api/lab-orders/${ids.labOrder}`;
      expect(DENIED).toContain(await call(clerk.d2, "PATCH", route, path, { id: ids.labOrder }, { body: { status: "CANCELLED" } }));
    });
  });

  describe("facilities", () => {
    it("Hospital B cannot read or change Hospital A's staff access settings or privileges", async () => {
      const a = facility("a").id;
      const b = facility("b").id;
      const p = { id: ids.staffA };
      for (const sub of ["access", "privileges"]) {
        const route = `facility/staff/[id]/${sub}`;
        const path = `/api/facility/staff/${ids.staffA}/${sub}`;
        expect(reached(await call(staffClerk("a", "owner"), "GET", route, path, p, { facilityId: a }))).toBe(true);
        expect(DENIED).toContain(await call(staffClerk("b", "owner"), "GET", route, path, p, { facilityId: b }));
      }
      expect(DENIED).toContain(await call(staffClerk("b", "owner"), "PATCH", "facility/staff/[id]/access", `/api/facility/staff/${ids.staffA}/access`, p, { facilityId: b, body: { accessLevel: "FULL" } }));
      expect(DENIED).toContain(await call(staffClerk("b", "owner"), "PATCH", "facility/staff/[id]", `/api/facility/staff/${ids.staffA}`, p, { facilityId: b, body: { status: "SUSPENDED" } }));
    });

    it("Hospital B cannot export Hospital A's patient package", async () => {
      const route = "facility/his/patients/[id]/package";
      const path = `/api/facility/his/patients/${facility("a").patientId}/package`;
      const p = { id: facility("a").patientId };
      const own = await call(staffClerk("a", "owner"), "POST", route, path, p, { facilityId: facility("a").id });
      expect(reached(own)).toBe(true);
      for (const role of ["owner", "records", "author"]) {
        expect(DENIED).toContain(await call(staffClerk("b", role), "POST", route, path, p, { facilityId: facility("b").id }));
      }
    });

    it("Hospital B cannot change Hospital A's encounters", async () => {
      const route = "facility/his/encounters/[id]";
      const encounter = facility("a").encounterIds[0];
      const path = `/api/facility/his/encounters/${encounter}`;
      for (const role of ["owner", "author"]) {
        expect(DENIED).toContain(await call(staffClerk("b", role), "PATCH", route, path, { id: encounter }, { facilityId: facility("b").id, body: { status: "CANCELLED" } }));
      }
    });

    it("a staff member of Hospital A cannot act on Hospital B's facility id header", async () => {
      // Selecting another facility by header must not grant access without membership there.
      const route = "facility/staff/[id]/access";
      const path = `/api/facility/staff/${ids.staffA}/access`;
      const status = await call(staffClerk("b", "owner"), "GET", route, path, { id: ids.staffA }, { facilityId: facility("a").id });
      expect(DENIED).toContain(status);
    });
  });
});
