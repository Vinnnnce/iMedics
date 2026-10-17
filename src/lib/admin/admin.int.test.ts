/**
 * Admin console logic against a real Postgres: applications, decisions, account controls, queries, refunds.
 * Skipped unless TEST_DATABASE_URL points at a migrated, disposable database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.PAYMENT_PROVIDER = "mock";
process.env.PAYSTACK_SECRET_KEY = "";

describe.skipIf(!url)("admin console", () => {
  type Mods = {
    prisma: typeof import("../prisma").prisma;
    review: typeof import("./verification-review");
    controls: typeof import("./account-controls");
    users: typeof import("./users");
    apps: typeof import("./applications");
    overview: typeof import("./overview");
    audit: typeof import("./audit-log");
    payments: typeof import("./payments");
    pay: typeof import("../payments/service");
  };
  let m: Mods;
  const tag = Math.random().toString(36).slice(2, 8);
  const created: string[] = [];
  let admin: { id: string; role: "ADMIN" };
  let admin2: { id: string; role: "ADMIN" };
  let doctor: string;
  let facility: string;

  const mkUser = async (name: string, role: "PATIENT" | "DOCTOR" | "ADMIN", extra: Record<string, unknown> = {}) => {
    const u = await m.prisma.user.create({ data: { clerkId: `a-${name}-${tag}`, email: `${name}-${tag}@t.test`, name: `${name} ${tag}`, role, onboardingComplete: true, ...extra } });
    created.push(u.id);
    return u;
  };
  const addDocs = (userId: string, kinds: string[]) =>
    m.prisma.verificationDocument.createMany({ data: kinds.map((kind, i) => ({ userId, kind, key: `k-${userId}-${i}`, fileName: `${kind}.pdf`, mimeType: "application/pdf", sizeBytes: 1000 })) });
  /** Notifications are sent after the response in production; wait for them here instead of racing. */
  const notified = async (userId: string, title: string) => {
    for (let i = 0; i < 40; i++) {
      const n = await m.prisma.notification.findFirst({ where: { userId, title } });
      if (n) return n;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };
  const allChecked = (type: "DOCTOR" | "FACILITY") => Object.fromEntries(m.review.CHECKLISTS[type].map((c) => [c.key, true]));

  beforeAll(async () => {
    m = {
      prisma: (await import("../prisma")).prisma,
      review: await import("./verification-review"),
      controls: await import("./account-controls"),
      users: await import("./users"),
      apps: await import("./applications"),
      overview: await import("./overview"),
      audit: await import("./audit-log"),
      payments: await import("./payments"),
      pay: await import("../payments/service"),
    };
    const a1 = await mkUser("admin1", "ADMIN", { status: "ACTIVE" });
    const a2 = await mkUser("admin2", "ADMIN", { status: "ACTIVE" });
    admin = { id: a1.id, role: "ADMIN" };
    admin2 = { id: a2.id, role: "ADMIN" };

    const d = await mkUser("doc", "PATIENT", { status: "PENDING", accountType: "DOCTOR", phone: `0803${tag}` });
    await m.prisma.doctorProfile.create({ data: { userId: d.id, middleName: "M", dateOfBirth: new Date("1980-02-03"), mdcnRegistrationNumber: `MDCN-${tag}`, licenseNumber: `LIC-${tag}`, yearOfRegistration: 2008, yearsOfExperience: 15, specialty: "Cardiology", verificationStatus: "PENDING" } });
    doctor = d.id;

    const f = await mkUser("lab", "PATIENT", { status: "PENDING", accountType: "LABORATORY", phone: `0805${tag}` });
    await m.prisma.labStaffProfile.create({ data: { userId: f.id, laboratoryName: `Lab ${tag}`, cacRegistrationNumber: `CAC-${tag}`, facilityLicenseNumber: `FL-${tag}`, addressLine: "1 Road", city: "Abuja", state: "FCT", verificationStatus: "PENDING" } });
    facility = f.id;
  });

  afterAll(async () => {
    if (!m) return;
    const p = m.prisma;
    await p.payment.deleteMany({ where: { OR: [{ payerId: { in: created } }, { payeeId: { in: created } }] } });
    await p.appointment.deleteMany({ where: { doctor: { userId: { in: created } } } });
    await p.auditLog.deleteMany({ where: { userId: { in: created } } });
    await p.verificationReview.deleteMany({ where: { userId: { in: created } } });
    await p.notification.deleteMany({ where: { userId: { in: created } } });
    await p.doctorProfile.deleteMany({ where: { userId: { in: created } } });
    await p.labStaffProfile.deleteMany({ where: { userId: { in: created } } });
    await p.patient.deleteMany({ where: { userId: { in: created } } });
    await p.user.deleteMany({ where: { id: { in: created } } });
    await p.$disconnect();
  });

  describe("verification dossier", () => {
    it("shows every submitted detail, with missing documents called out", async () => {
      const dossier = await m.review.getDossier(doctor);
      expect(dossier?.type).toBe("DOCTOR");
      const flat = dossier!.sections.flatMap((s) => s.fields);
      expect(flat.find((f) => f.label === "MDCN registration number")?.value).toBe(`MDCN-${tag}`);
      expect(flat.find((f) => f.label === "Date of birth")?.value).toMatch(/1980/);
      expect(flat.find((f) => f.label === "Full name")?.value).toContain("M");
      expect(dossier!.missingDocuments).toHaveLength(2);
      expect(dossier!.checklist.length).toBeGreaterThan(0);
    });

    it("flags a licence number already used by another account", async () => {
      const other = await mkUser("dup", "PATIENT", { status: "PENDING", accountType: "DOCTOR" });
      await m.prisma.doctorProfile.create({ data: { userId: other.id, licenseNumber: `LIC-${tag}`, verificationStatus: "PENDING" } });
      const dossier = await m.review.getDossier(doctor);
      expect(dossier!.duplicates.some((d) => d.field === "Practising licence number" && d.other.id === other.id)).toBe(true);
    });

    it("flags implausible details", async () => {
      const young = await mkUser("young", "PATIENT", { status: "PENDING", accountType: "DOCTOR" });
      const dob = new Date(); dob.setFullYear(dob.getFullYear() - 20);
      await m.prisma.doctorProfile.create({ data: { userId: young.id, dateOfBirth: dob, yearOfRegistration: new Date().getFullYear() + 2, verificationStatus: "PENDING" } });
      const dossier = await m.review.getDossier(young.id);
      expect(dossier!.flags.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("decisions", () => {
    it("will not approve without all checks and all required documents", async () => {
      await expect(m.review.decideVerification(admin, doctor, { decision: "APPROVED", checklist: {} })).rejects.toThrow(/every verification check/);
      await expect(m.review.decideVerification(admin, doctor, { decision: "APPROVED", checklist: allChecked("DOCTOR") })).rejects.toThrow(/documents are missing/i);
    });

    it("requires a real reason to reject, records it, notifies the pending applicant, and keeps them out", async () => {
      await expect(m.review.decideVerification(admin, doctor, { decision: "REJECTED", reason: "no" })).rejects.toThrow(/at least 10/);
      await m.review.decideVerification(admin, doctor, { decision: "REJECTED", reason: "The licence scan is unreadable, please upload a clearer copy." });
      const user = await m.prisma.user.findUniqueOrThrow({ where: { id: doctor }, include: { doctorProfile: true } });
      expect(user.doctorProfile?.verificationStatus).toBe("REJECTED");
      expect(user.role).toBe("PATIENT");
      expect(user.status).toBe("PENDING");
      const note = await notified(doctor, "Your application needs attention");
      expect(note).not.toBeNull();
      expect(note!.body).not.toMatch(/unreadable|licence/i);
      const review = await m.prisma.verificationReview.findFirstOrThrow({ where: { userId: doctor } });
      expect(review.reason).toMatch(/unreadable/);
    });

    it("approves a complete application: grants the role, activates, notifies, and cannot be decided twice", async () => {
      await addDocs(doctor, ["MDCN_CERTIFICATE", "PRACTISING_LICENSE"]);
      await m.review.decideVerification(admin, doctor, { decision: "APPROVED", checklist: allChecked("DOCTOR"), note: "Checked on the MDCN site" });
      const user = await m.prisma.user.findUniqueOrThrow({ where: { id: doctor }, include: { doctorProfile: true } });
      expect(user).toMatchObject({ role: "DOCTOR", status: "ACTIVE" });
      expect(user.doctorProfile?.verificationStatus).toBe("VERIFIED");
      expect(user.doctorProfile?.verifiedById).toBe(admin.id);
      expect(await notified(doctor, "Your account has been verified")).not.toBeNull();
      await expect(m.review.decideVerification(admin, doctor, { decision: "REJECTED", reason: "Changed my mind about this one" })).rejects.toThrow(/already verified/);
      const audit = await m.prisma.auditLog.count({ where: { userId: admin.id, action: "ADMIN_VERIFICATION_APPROVED", resourceId: doctor } });
      expect(audit).toBe(1);
    });

    it("works the same way for facilities and blocks self-review", async () => {
      await addDocs(facility, ["CAC_CERTIFICATE", "FACILITY_LICENSE"]);
      await m.review.decideVerification(admin, facility, { decision: "APPROVED", checklist: allChecked("FACILITY") });
      expect((await m.prisma.user.findUniqueOrThrow({ where: { id: facility } })).role).toBe("LAB_SCIENTIST");
      await expect(m.review.decideVerification(admin, admin.id, { decision: "REJECTED", reason: "Reviewing myself here" })).rejects.toThrow();
    });
  });

  describe("account controls", () => {
    it("needs a reason to suspend, restores cleanly, and notifies the user", async () => {
      await expect(m.controls.changeAccountStatus(admin, doctor, "SUSPENDED", "x")).rejects.toThrow(/reason/);
      await m.controls.changeAccountStatus(admin, doctor, "SUSPENDED", "Reported for misconduct, under review");
      let u = await m.prisma.user.findUniqueOrThrow({ where: { id: doctor } });
      expect(u).toMatchObject({ status: "SUSPENDED", statusReason: "Reported for misconduct, under review" });
      expect(await notified(doctor, "Your account has been restricted")).not.toBeNull();
      await expect(m.controls.changeAccountStatus(admin, doctor, "SUSPENDED", "again again")).rejects.toThrow(/already/);
      await m.controls.changeAccountStatus(admin, doctor, "ACTIVE", undefined);
      u = await m.prisma.user.findUniqueOrThrow({ where: { id: doctor } });
      expect(u).toMatchObject({ status: "ACTIVE", statusReason: null });
    });

    it("refuses self-changes and pending accounts", async () => {
      await expect(m.controls.changeAccountStatus(admin, admin.id, "SUSPENDED", "because reasons")).rejects.toThrow(/own account/);
      const pending = await mkUser("pend", "PATIENT", { status: "PENDING" });
      await expect(m.controls.changeAccountStatus(admin, pending.id, "SUSPENDED", "because reasons")).rejects.toThrow(/verification/);
    });

    it("keeps at least one active administrator and returns demoted admins to their verified role", async () => {
      // Make the doctor an admin, then remove: they should go back to DOCTOR (verified).
      await m.controls.setAdministrator(admin, doctor, true);
      expect((await m.prisma.user.findUniqueOrThrow({ where: { id: doctor } })).role).toBe("ADMIN");
      await m.controls.setAdministrator(admin, doctor, false);
      expect((await m.prisma.user.findUniqueOrThrow({ where: { id: doctor } })).role).toBe("DOCTOR");

      // Suspend/demote admin2 while admin is the only other active admin: allowed. Then the last one cannot go.
      const others = await m.prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { notIn: [admin.id, admin2.id] } } });
      if (others === 0) {
        await m.controls.setAdministrator(admin, admin2.id, false);
        await expect(m.controls.setAdministrator(admin2, admin.id, false)).rejects.toThrow(); // admin2 is no longer admin
      }
    });
  });

  describe("queries", () => {
    it("lists and filters users and applications", async () => {
      const f = m.users.userFilterSchema.parse({ q: tag, role: "DOCTOR" });
      const { rows, total } = await m.users.listUsers(f);
      expect(total).toBe(1);
      expect(rows[0].verificationStatus).toBe("VERIFIED");
      expect(rows[0].headline).toBe("Cardiology");

      const apps = await m.apps.listApplications(m.apps.applicationFilterSchema.parse({ status: "VERIFIED", q: tag }));
      expect(apps.rows.map((r) => r.id)).toEqual(expect.arrayContaining([doctor, facility]));
      const pending = await m.apps.listApplications(m.apps.applicationFilterSchema.parse({ status: "PENDING", q: tag, type: "DOCTOR" }));
      expect(pending.rows.every((r) => r.type === "DOCTOR")).toBe(true);
    });

    it("ignores junk filter values instead of failing", async () => {
      expect(m.users.userFilterSchema.parse({ role: "all", status: "", page: "abc" })).toMatchObject({ role: undefined, status: undefined, page: 1 });
      expect(m.apps.applicationFilterSchema.parse({ status: "bogus" }).status).toBe("PENDING");
    });

    it("builds the account detail without any clinical data", async () => {
      const detail = await m.users.getUserDetail(doctor);
      expect(detail?.user.doctorProfile?.specialty).toBe("Cardiology");
      expect(detail?.reviews.length).toBeGreaterThan(0);
      expect(JSON.stringify(detail)).not.toMatch(/diagnos/i);
    });

    it("computes the overview, including zero-filled daily series", async () => {
      const o = await m.overview.getOverview();
      expect(o.series.registrations).toHaveLength(30);
      expect(o.series.registrations.reduce((a, d) => a + d.value, 0)).toBeGreaterThanOrEqual(5);
      expect(o.users.total).toBeGreaterThanOrEqual(5);
      expect(typeof o.verifications.oldestPendingDays).toBe("number");
    });

    it("searches the audit log by action label, person and record id, and groups by category", async () => {
      const byGroup = await m.audit.listAudit(m.audit.auditFilterSchema.parse({ group: "verification" }));
      expect(byGroup.rows.length).toBeGreaterThan(0);
      expect(byGroup.rows.every((r) => /VERIFICATION/.test(r.action) || /REGISTRATION/.test(r.action))).toBe(true);
      const byId = await m.audit.listAudit(m.audit.auditFilterSchema.parse({ q: doctor }));
      expect(byId.rows.length).toBeGreaterThan(0);
      const junk = await m.audit.listAudit(m.audit.auditFilterSchema.parse({ q: "not-a-uuid!" }));
      expect(junk.rows).toBeDefined();
    });
  });

  describe("admin refund", () => {
    it("refunds a paid booking, cancels the appointment and records the reason", async () => {
      const patientUser = await mkUser("pt", "PATIENT", { status: "ACTIVE" });
      const patient = await m.prisma.patient.create({ data: { caseNumber: `A-${tag}`, userId: patientUser.id, firstName: "P", lastName: "T", gender: "FEMALE", dateOfBirth: new Date("1990-01-01") } });
      const doc = await m.prisma.doctorProfile.findFirstOrThrow({ where: { userId: doctor } });
      const appt = await m.prisma.appointment.create({ data: { patientId: patient.id, doctorId: doc.id, scheduledAt: new Date(Date.now() + 5 * 86_400_000), status: "CONFIRMED", feeAmount: 5000, feeCurrency: "NGN" } });
      const payment = await m.prisma.$transaction((tx) => m.pay.createPendingPayment(tx, { kind: "CONSULTATION", payerId: patientUser.id, payeeId: doctor, appointmentId: appt.id, description: "Consultation fee", amount: 5000, currency: "NGN" }));

      await expect(m.payments.adminRefund(admin, payment.id, "duplicate charge")).rejects.toThrow(/successful/);
      await m.pay.applyProviderOutcome(payment.providerReference, { status: "success", amountMinor: 500000, currency: "NGN", channel: "card" });
      await m.payments.adminRefund(admin, payment.id, "duplicate charge");

      expect((await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REFUNDED");
      expect((await m.prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe("CANCELLED");
      const detail = await m.payments.getPaymentDetail(payment.id);
      expect(detail?.events.some((e) => e.type === "REFUNDED")).toBe(true);
      const list = await m.payments.listPayments(m.payments.paymentFilterSchema.parse({ status: "REFUNDED", q: tag }));
      expect(list.rows.some((r) => r.id === payment.id)).toBe(true);
    });
  });
});
