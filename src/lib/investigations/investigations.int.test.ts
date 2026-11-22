/**
 * End-to-end integration test of the investigations pipeline against a real,
 * migrated, disposable Postgres database. All data is synthetic.
 *
 * Skipped unless INVESTIGATIONS_TEST_DATABASE_URL is set to a database whose
 * name ends in _test.
 */
import { randomBytes } from "node:crypto";
import type { InvestigationItemStatus, LabStaffProfile, User } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.INVESTIGATIONS_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("_test")) throw new Error("Investigation integration tests require a disposable *_test database");
if (url) process.env.DATABASE_URL = url;

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

describe.skipIf(!url)("investigations pipeline (database)", () => {
  const run = randomBytes(4).toString("hex");
  let prisma: typeof import("@/lib/prisma").prisma;
  let svc: typeof import("./service");
  let orders: typeof import("./orders");
  let results: typeof import("./results");
  let alerts: typeof import("./alerts");
  let seed: typeof import("./catalogue-seed");
  const ids: Record<string, string> = {};
  let doctorUser: User;
  let techA: User;
  let techB: User;
  let facility: LabStaffProfile;
  const itemIds: Record<string, string> = {};

  const mkUser = (tag: string, role: "DOCTOR" | "LAB_SCIENTIST" | "PATIENT") =>
    prisma.user.create({
      data: { clerkId: `inv_${run}_${tag}`, email: `inv-${run}-${tag}@example.test`, name: `Synthetic ${tag}`, role, status: "ACTIVE", onboardingComplete: true, accountType: role === "DOCTOR" ? "DOCTOR" : role === "PATIENT" ? "PATIENT" : "LABORATORY" },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    svc = await import("./service");
    orders = await import("./orders");
    results = await import("./results");
    alerts = await import("./alerts");
    seed = await import("./catalogue-seed");

    await seed.seedInvestigationCatalogue();
    doctorUser = await mkUser("doc", "DOCTOR");
    techA = await mkUser("techa", "LAB_SCIENTIST");
    techB = await mkUser("techb", "LAB_SCIENTIST");
    const patientUser = await mkUser("pat", "PATIENT");
    const doctor = await prisma.doctorProfile.create({ data: { userId: doctorUser.id, specialty: "General practice", licenseNumber: `SYN-${run}`, verificationStatus: "VERIFIED" } as never });
    const patient = await prisma.patient.create({ data: { userId: patientUser.id, caseNumber: `MC-SYN-${run}`, firstName: "Synthetic", lastName: "Patient", dateOfBirth: new Date("1990-01-01"), gender: "OTHER" } });
    await prisma.patientAssignment.create({ data: { patientId: patient.id, doctorId: doctor.id, status: "ACTIVE" } as never });
    facility = await prisma.labStaffProfile.create({ data: { userId: techA.id, laboratoryName: `SYNTHETIC LAB ${run}`, kind: "LABORATORY", verificationStatus: "VERIFIED", departments: ["Laboratory"] } });
    ids.patient = patient.id;

    // The facility switches on the standard laboratory catalogue.
    const cats = await prisma.investigation_categories.findMany({ where: { domain: "LABORATORY" }, select: { id: true } });
    const standard = await prisma.investigation_catalogue_items.findMany({ where: { categoryId: { in: cats.map((c) => c.id) } }, select: { id: true } });
    await prisma.facility_investigations.createMany({ data: standard.map((i) => ({ facilityId: facility.id, catalogueItemId: i.id })) });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const find = async (name: string) => (await prisma.investigation_catalogue_items.findFirstOrThrow({ where: { name, source: "SYSTEM" } })).id;

  it("seeds the full spec catalogue: 11 laboratory disciplines and 16 diagnostic departments", async () => {
    expect(await prisma.investigation_categories.count({ where: { domain: "LABORATORY" } })).toBe(11);
    expect(await prisma.investigation_categories.count({ where: { domain: "DIAGNOSTIC" } })).toBe(16);
    expect(await prisma.investigation_catalogue_items.count()).toBeGreaterThan(350);
    const before = await prisma.investigation_catalogue_items.count();
    await seed.seedInvestigationCatalogue();
    expect(await prisma.investigation_catalogue_items.count()).toBe(before);
  });

  it("routes a multi-test order to the correct departments automatically", async () => {
    const names = ["Full Blood Count", "Blood Culture", "Stool Routine Examination", "Routine Urinalysis", "Liver Function Panel"];
    const catalogueItemIds = await Promise.all(names.map(find));
    const id = await orders.saveDraft(doctorUser, { domain: "LABORATORY", patientId: ids.patient, priority: "URGENT", clinicalIndication: "Synthetic fever work-up", items: catalogueItemIds.map((catalogueItemId) => ({ catalogueItemId })) });
    const draft = await prisma.investigation_orders.findUniqueOrThrow({ where: { id } });
    expect(draft.status).toBe("DRAFT");
    await expect(orders.submitOrder(doctorUser, id, { authorise: false })).rejects.toThrow(/authorisation/i);

    const submitted = await orders.submitOrder(doctorUser, id, { authorise: true });
    expect(submitted.routed).toBe(5);
    const items = await prisma.investigation_order_items.findMany({ where: { orderId: id }, orderBy: { nameSnapshot: "asc" } });
    const dept = Object.fromEntries(items.map((i) => [i.nameSnapshot, i.departmentKey]));
    expect(dept).toMatchObject({
      "Full Blood Count": "haematology",
      "Blood Culture": "microbiology",
      "Liver Function Panel": "clinical-biochemistry",
      "Routine Urinalysis": "urinalysis-body-fluids",
      "Stool Routine Examination": "urinalysis-body-fluids",
    });
    expect(items.every((i) => i.performingFacilityId === facility.id && i.status === "NEW_REQUEST" && i.dueAt)).toBe(true);
    expect(await prisma.investigation_status_history.count({ where: { itemId: { in: items.map((i) => i.id) } } })).toBe(5);
    for (const i of items) itemIds[i.nameSnapshot] = i.id;
  });

  it("flags duplicates, including a test covered by a recent panel, and accepts a documented reason", async () => {
    const fbc = await find("Full Blood Count");
    const hb = await find("Haemoglobin");
    const hits = await svc.findDuplicates(ids.patient, [fbc, hb], "LABORATORY");
    expect(hits.map((h) => [h.name, h.reason])).toEqual(expect.arrayContaining([["Full Blood Count", "SAME_INVESTIGATION"], ["Haemoglobin", "COVERED_BY_PANEL"]]));

    const id = await orders.saveDraft(doctorUser, { domain: "LABORATORY", patientId: ids.patient, priority: "ROUTINE", clinicalIndication: "Repeat", items: [{ catalogueItemId: fbc }] });
    await expect(orders.submitOrder(doctorUser, id, { authorise: true })).rejects.toThrow(/duplicate/i);
    await orders.saveDraft(doctorUser, { domain: "LABORATORY", patientId: ids.patient, priority: "ROUTINE", clinicalIndication: "Repeat", items: [{ catalogueItemId: fbc, duplicateOverrideReason: "Post-transfusion recount" }] }, id);
    await expect(orders.submitOrder(doctorUser, id, { authorise: true })).resolves.toMatchObject({ routed: 1 });
  });

  it("keeps an unlisted (custom) investigation without a facility in a referral-pending state instead of dropping it", async () => {
    const id = await orders.saveDraft(doctorUser, { domain: "LABORATORY", patientId: ids.patient, priority: "ROUTINE", clinicalIndication: "Rare assay", items: [{ custom: { name: "Synthetic rare assay", discipline: "Immunology" } }] });
    const res = await orders.submitOrder(doctorUser, id, { authorise: true });
    expect(res.referralPending).toBe(1);
    const item = await prisma.investigation_order_items.findFirstOrThrow({ where: { orderId: id } });
    expect(item).toMatchObject({ status: "REFERRAL_PENDING", isCustom: true, performingFacilityId: null, departmentKey: "other-laboratory" });
  });

  it("runs specimen -> result -> maker-checker verification -> sign -> release with a critical alert", async () => {
    const itemId = itemIds["Full Blood Count"];
    const item0 = await prisma.investigation_order_items.findUniqueOrThrow({ where: { id: itemId } });
    const advance = async (to: InvestigationItemStatus) => {
      const cur = await prisma.investigation_order_items.findUniqueOrThrow({ where: { id: itemId } });
      await prisma.$transaction((tx) => svc.transitionItem(tx, cur, to, { userId: techA.id }));
    };
    await expect(prisma.$transaction((tx) => svc.transitionItem(tx, item0, "PROCESSING", { userId: techA.id }))).rejects.toThrow();
    for (const s of ["AWAITING_SAMPLE", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "ASSIGNED_TO_SECTION", "PROCESSING", "ANALYSIS_COMPLETED"] as const) await advance(s);

    const { accessionNumber, barcode } = await prisma.$transaction((tx) => svc.nextAccession(tx, facility.id));
    expect(accessionNumber).toMatch(/^SPC-\d{4}-\d{6}$/);
    expect(barcode).not.toContain("-");

    await results.saveResult(techA, facility, itemId, {
      observations: [
        { analyteCode: "HB", name: "Haemoglobin", loincCode: "718-7", valueNumeric: 4.1, unit: "g/dL", refLow: 12, refHigh: 16, criticalLow: 7 },
        { analyteCode: "WBC", name: "White blood cell count", valueNumeric: 6.2, unit: "10*9/L", refLow: 4, refHigh: 11 },
      ],
    });
    let rows = await prisma.investigation_observations.findMany({ where: { result: { itemId } }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.flag)).toEqual(["CRITICAL_LOW", "NORMAL"]);

    // The doctor sees nothing until release.
    expect(await results.releasedResultFor(itemId)).toBeNull();
    await results.submitForVerification(techA, facility, itemId);
    await expect(results.verifyResult(techA, facility, itemId, { approve: true })).rejects.toThrow(/different professional/);
    const v = await results.verifyResult(techB, facility, itemId, { approve: true });
    expect(v).toMatchObject({ returned: false, critical: 1 });

    const alert = await prisma.investigation_critical_alerts.findFirstOrThrow({ where: { itemId }, include: { events: true } });
    expect(alert).toMatchObject({ status: "SENT", notifiedUserId: doctorUser.id });
    expect(alert.events.map((e) => e.kind)).toEqual(["SENT"]);
    await expect(alerts.acknowledgeAlert(techB.id, alert.id)).rejects.toThrow(); // only the notified doctor

    await expect(results.releaseResult(techB, facility, itemId)).rejects.toThrow(/signed/i);
    await results.signResult(techB, facility, itemId, "Reviewed and approved");
    expect(await results.releasedResultFor(itemId)).toBeNull();
    await results.releaseResult(techB, facility, itemId);

    const released = await results.releasedResultFor(itemId);
    expect(released?.status).toBe("RELEASED");
    expect(released?.observations).toHaveLength(2);
    expect((await prisma.investigation_order_items.findUniqueOrThrow({ where: { id: itemId } })).status).toBe("DELIVERED");
    const history = await prisma.investigation_status_history.findMany({ where: { itemId }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.toStatus).slice(-4)).toEqual(["VERIFIED", "SIGNED", "RELEASED", "DELIVERED"]);

    const ack = await alerts.acknowledgeAlert(doctorUser.id, alert.id, "Patient contacted");
    expect(ack.status).toBe("ACKNOWLEDGED");
    rows = await prisma.investigation_observations.findMany({ where: { resultId: released!.id } });
    expect(rows).toHaveLength(2);
  });

  it("makes signed reports immutable at the database level and amends by appending a version", async () => {
    const itemId = itemIds["Full Blood Count"];
    const v1 = await prisma.investigation_results.findFirstOrThrow({ where: { itemId, version: 1 } });
    await expect(prisma.investigation_results.update({ where: { id: v1.id }, data: { findings: "silently changed" } })).rejects.toThrow(/immutable/i);
    await expect(prisma.investigation_observations.deleteMany({ where: { resultId: v1.id } })).rejects.toThrow(/immutable/i);
    await expect(prisma.investigation_results.delete({ where: { id: v1.id } })).rejects.toThrow(/cannot be deleted/i);
    await expect(prisma.investigation_results.update({ where: { id: v1.id }, data: { status: "DRAFT" } })).rejects.toThrow(/immutable/i);

    await results.startAmendment(techA, facility, itemId, "Corrected haemoglobin transcription");
    // v1 stays the visible report until v2 is released.
    expect((await results.releasedResultFor(itemId))?.version).toBe(1);
    await results.saveResult(techA, facility, itemId, { observations: [{ analyteCode: "HB", name: "Haemoglobin", valueNumeric: 14.1, unit: "g/dL", refLow: 12, refHigh: 16 }] });
    await results.submitForVerification(techA, facility, itemId);
    await results.verifyResult(techB, facility, itemId, { approve: true });
    await results.signResult(techB, facility, itemId, "Amendment approved");
    await results.releaseResult(techB, facility, itemId);
    const live = await results.releasedResultFor(itemId);
    expect(live?.version).toBe(2);
    expect((await prisma.investigation_results.findFirstOrThrow({ where: { itemId, version: 1 } })).status).toBe("SUPERSEDED");
    expect(live?.amendmentReason).toMatch(/Corrected/);
  });

  it("escalates unacknowledged critical alerts in widening levels", async () => {
    const itemId = itemIds["Liver Function Panel"];
    const item = await prisma.investigation_order_items.findUniqueOrThrow({ where: { id: itemId } });
    const result = await prisma.investigation_results.create({ data: { itemId, version: 1, status: "VERIFIED" } });
    const alert = await alerts.raiseCriticalAlert({ resultId: result.id, itemId, patientId: ids.patient, orderId: item.orderId, doctorUserId: doctorUser.id, facilityId: facility.id, count: 1 });
    const later = new Date(Date.now() + 70 * 60_000);
    const summary = await alerts.escalateInvestigationAlerts(later);
    expect(summary.escalated).toBeGreaterThanOrEqual(1);
    const after = await prisma.investigation_critical_alerts.findUniqueOrThrow({ where: { id: alert.id }, include: { events: true } });
    expect(after).toMatchObject({ status: "ESCALATED", escalationLevel: 2 });
    expect(after.events.map((e) => e.kind)).toContain("ESCALATED");
  });

  it("computes facility analytics", async () => {
    const a = await (await import("./analytics")).facilityAnalytics(facility.id);
    expect(a.open).toBeGreaterThan(0);
    expect(a.releasedLast30Days).toBeGreaterThanOrEqual(1);
  });
});
