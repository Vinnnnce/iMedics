/**
 * Real PostgreSQL + actual route guards/workflows, with identity/provider mocks.
 * This is NOT live Clerk/S3/browser acceptance. Uses its own synthetic-only DB.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { acceptanceRoster } from "./acceptance-config";
import { createAcceptanceFixtures, type AcceptanceManifest } from "../../../scripts/lib/his-fixtures";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.HIS_TEST_DATABASE_URL }) }) };
});
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth";
import { POST as createTemplate } from "@/app/api/facility/his/templates/route";
import { GET as getTemplate } from "@/app/api/facility/his/templates/[id]/route";
import { POST as templateAction } from "@/app/api/facility/his/templates/[id]/actions/route";
import { POST as createDocument } from "@/app/api/facility/his/documents/route";
import { GET as getDocument, PUT as saveDocument } from "@/app/api/facility/his/documents/[id]/route";
import { POST as documentAction } from "@/app/api/facility/his/documents/[id]/actions/route";
import { GET as pdf } from "@/app/api/facility/his/documents/[id]/pdf/route";
import { GET as fhir } from "@/app/api/facility/his/documents/[id]/fhir/route";
import { GET as patientList } from "@/app/api/patient/clinical-documents/route";
import { GET as patientPdf } from "@/app/api/patient/clinical-documents/[id]/pdf/route";
import { GET as encounters } from "@/app/api/facility/his/encounters/route";
import { POST as acknowledge } from "@/app/api/facility/critical-alerts/[id]/route";
import { POST as createLetterhead, GET as listLetterheads } from "@/app/api/facility/his/letterheads/route";
import { GET as getLetterhead, PATCH as patchLetterhead, DELETE as deleteLetterhead } from "@/app/api/facility/his/letterheads/[id]/route";
import { GET as previewLetterhead } from "@/app/api/facility/his/letterheads/[id]/preview/route";
import { GET as listDoctorLetterheads, POST as createDoctorLetterhead } from "@/app/api/doctors/me/letterheads/route";
import { PATCH as patchDoctorLetterhead } from "@/app/api/doctors/me/letterheads/[id]/route";
import { resolveDoctorLetterhead, resolveFacilityLetterhead } from "@/lib/letterheads";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { documentEvent } from "./audit";

const url = process.env.HIS_TEST_DATABASE_URL;
describe.skipIf(!url)("HIS real-database safety and workflows", () => {
  const runId = randomBytes(6).toString("hex");
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000",
    expiresAt: new Date(Date.now() + 86400000).toISOString(), instanceId: null,
    databaseHost: "localhost", databaseName: "imedics_his_acceptance", users: [], facilities: [],
  };
  const def = { sections: [{ id: "assessment", title: "Synthetic acceptance only", fields: [{ id: "note", label: "Synthetic note", type: "textarea", required: true, locked: true }] }],
    signatures: [{ role: "AUTHOR", label: "Synthetic authenticated author", required: true, locked: true }],
    workflow: { requiresReview: true, independentReview: true } };
  let templateId = "", docId = "", radiologyLetterheadId = "";
  const fac = (hospital: "a" | "b" = "a") => manifest.facilities.find((f) => f.hospital === hospital)!;
  const as = async (role: string, hospital: "a" | "b" = "a") => {
    const fixture = manifest.users.find((u) => u.role === role && u.hospital === hospital)!;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.userId } });
    vi.mocked(requireUser).mockResolvedValue(user);
    vi.mocked(requireRole).mockImplementation(async (...roles) => {
      if (!roles.includes(user.role)) throw new Error("Fixture does not have requested platform role");
      return user;
    });
  };
  const request = (path: string, method = "GET", body?: unknown, hospital: "a" | "b" = "a") => new NextRequest(`http://localhost:3000${path}`, {
    method, headers: { "x-facility-id": fac(hospital).id, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const action = (body: unknown) => documentAction(request(`/api/facility/his/documents/${docId}/actions`, "POST", body), ctx(docId));

  beforeAll(async () => {
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(prisma, manifest, identities);
  }, 30000);
  afterAll(async () => { await prisma.$disconnect(); });

  it("creates 22 expiring, unpublished synthetic accounts across two independent hospitals", async () => {
    expect(manifest.users).toHaveLength(22);
    expect(await prisma.labStaffProfile.count({ where: { id: { in: manifest.facilities.map((f) => f.id) }, isPublished: false } })).toBe(2);
    expect(await prisma.user.count({ where: { id: { in: manifest.users.map((u) => u.userId) }, testAccountExpiresAt: { not: null } } })).toBe(22);
  });
  it("lets an administrator create a custom template", async () => {
    await as("owner");
    const response = await createTemplate(request("/api/facility/his/templates", "POST", { mode: "custom", name: `Synthetic acceptance ${runId}`, groupCode: "B", definition: def }), { params: Promise.resolve({}) });
    expect(response.status).toBe(201);
    templateId = (await response.json()).template.id;
  });
  it("requires independent approval and isolates published versions", async () => {
    await as("owner");
    expect((await templateAction(request("/actions", "POST", { action: "submit" }), ctx(templateId))).status).toBe(200);
    expect((await templateAction(request("/actions", "POST", { action: "approve" }), ctx(templateId))).status).toBe(403);
    await as("reviewer");
    expect((await templateAction(request("/actions", "POST", { action: "approve" }), ctx(templateId))).status).toBe(200);
    await as("owner");
    expect((await templateAction(request("/actions", "POST", { action: "publish" }), ctx(templateId))).status).toBe(200);
    await as("owner", "b");
    expect((await getTemplate(request("/template", "GET", undefined, "b"), ctx(templateId))).status).toBe(404);
  });
  it("creates, saves, submits, independently reviews and signs a document", async () => {
    await as("author");
    const response = await createDocument(request("/api/facility/his/documents", "POST", { templateId, patientId: fac().patientId, encounterId: fac().encounterIds[0] }), { params: Promise.resolve({}) });
    expect(response.status).toBe(201);
    docId = (await response.json()).document.id;
    expect((await saveDocument(request("/document", "PUT", { content: { note: "SYNTHETIC ACCEPTANCE ONLY. Not a clinical record." } }), ctx(docId))).status).toBe(200);
    expect((await action({ action: "submit" })).status).toBe(200);
    expect((await action({ action: "review" })).status).toBe(403);
    await as("reviewer");
    expect((await action({ action: "review" })).status).toBe(200);
    await as("author");
    expect((await action({ action: "finalize" })).status).toBe(400);
    expect((await action({ action: "sign", role: "AUTHOR" })).status).toBe(200);
    expect((await action({ action: "finalize" })).status).toBe(200);
  });
  it("renders an authenticated PDF with no-store caching", async () => {
    await as("author");
    const response = await pdf(request("/pdf"), ctx(docId));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("exports linked FHIR resources without embedding a public media URL", async () => {
    await as("author");
    const response = await fhir(request("/fhir"), ctx(docId));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/fhir+json");
    const bundle = await response.json();
    expect(bundle.entry).toHaveLength(3);
    expect(bundle.entry[1].resource.content[0].attachment.url).toContain(`/api/facility/his/documents/${docId}/pdf`);
  });
  it("does not disclose an unreleased report to its patient", async () => {
    await as("patient");
    const response = await patientList(request("/api/patient/clinical-documents"), { params: Promise.resolve({}) });
    expect((await response.json()).documents.some((d: { id: string }) => d.id === docId)).toBe(false);
  });
  it("releases a final report only to the correct patient", async () => {
    await as("reviewer");
    expect((await action({ action: "release" })).status).toBe(200);
    await as("patient");
    const response = await patientList(request("/patient"), { params: Promise.resolve({}) });
    expect((await response.json()).documents.some((d: { id: string }) => d.id === docId)).toBe(true);
    expect((await patientPdf(request("/patient/pdf"), ctx(docId))).status).toBe(200);
  });
  it("denies another patient and another hospital access to the same document", async () => {
    await as("patient", "b");
    expect((await patientPdf(request("/patient/pdf", "GET", undefined, "b"), ctx(docId))).status).toBe(404);
    await as("owner", "b");
    expect((await getDocument(request("/document", "GET", undefined, "b"), ctx(docId))).status).toBe(404);
    expect((await fhir(request("/fhir", "GET", undefined, "b"), ctx(docId))).status).toBe(404);
  });
  it("records the real synthetic account, exact version, timestamp and hash of its electronic signature", async () => {
    const signature = await prisma.documentSignature.findFirstOrThrow({ where: { documentId: docId, role: "AUTHOR" } });
    expect(signature.signerUserId).toBe(manifest.users.find((u) => u.hospital === "a" && u.role === "author")!.userId);
    expect(signature.templateVersion).toBe(1);
    expect(signature.signedAt).toBeInstanceOf(Date);
    expect(signature.contentHash).toHaveLength(64);
    // The author signs under a separately authorized clinical privilege backed by a
    // verified synthetic credential, so the signature records that registration.
    expect(signature.registrationId).toMatch(/^QA-/);
    expect(signature.attestedById).toBeNull();
  });
  it("preserves finalized content when starting an amendment", async () => {
    await as("author");
    const original = await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: docId } });
    const response = await action({ action: "amend", reason: "Synthetic correction for acceptance only" });
    expect(response.status).toBe(200);
    const changed = await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: docId } });
    expect(changed.content).toEqual(original.content);
    expect(changed.contentHash).toBe(original.contentHash);
    const amendment = await prisma.clinicalDocument.findUniqueOrThrow({ where: { supersedesId: docId } });
    expect(amendment.status).toBe("DRAFT");
    expect(amendment.revision).toBe(2);
  });
  it("enforces role permissions for document creation and critical acknowledgements", async () => {
    await as("receptionist");
    expect((await createDocument(request("/documents", "POST", { templateId, patientId: fac().patientId }), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await acknowledge(request("/ack", "POST", {}), ctx("11111111-1111-4111-8111-111111111111"))).status).toBe(403);
  });
  it("separates emergency and planned encounter boards", async () => {
    await as("owner");
    const ed = await encounters(request("/encounters?board=emergency"), { params: Promise.resolve({}) });
    const planned = await encounters(request("/encounters?board=planned"), { params: Promise.resolve({}) });
    expect((await ed.json()).encounters.every((e: { priority: string }) => e.priority === "EMERGENCY")).toBe(true);
    expect((await planned.json()).encounters.every((e: { type: string }) => e.type === "SCHEDULED_OUTPATIENT")).toBe(true);
  });
  it("blocks cross-tenant template links even through a direct database write", async () => {
    const version = await prisma.clinicalDocumentTemplateVersion.findFirstOrThrow({ where: { templateId } });
    await expect(prisma.clinicalDocument.create({ data: {
      facilityId: fac("b").id, patientId: fac("b").patientId, templateVersionId: version.id,
      documentNumber: `QA-invalid-${runId}`, title: "Synthetic invalid", groupCode: "B", authorId: manifest.users[0].userId,
    } })).rejects.toThrow(/tenant mismatch/);
  });
  it("blocks incorrect-patient media links and final storage namespaces in the database", async () => {
    const base = { facilityId: fac().id, patientId: fac().patientId, category: "XRAY" as const, examinationType: "Synthetic",
      fileName: "synthetic.pdf", formatKey: "pdf", mimeType: "application/pdf", sizeBytes: 8, sha256: "a".repeat(64), uploadedById: manifest.users[0].userId };
    await expect(prisma.medicalMedia.create({ data: { ...base, encounterId: fac("b").encounterIds[0], storageKey: `medical-media/final/${fac().id}/${fac().patientId}/invalid` } })).rejects.toThrow(/scope mismatch/);
    await expect(prisma.medicalMedia.create({ data: { ...base, storageKey: "medical-media/final/wrong-tenant/file" } })).rejects.toThrow(/storage scope mismatch/);
  });
  it("retains historical payer identity while allowing eligibility verification and ending", async () => {
    const coverage = await prisma.payerCoverage.create({ data: { facilityId: fac().id, patientId: fac().patientId, category: "SELF_PAY", createdById: manifest.users[0].userId } });
    const encounter = await prisma.encounter.create({ data: { facilityId: fac().id, patientId: fac().patientId, encounterNumber: `QA-payer-${runId}`,
      type: "FOLLOW_UP", priority: "ROUTINE", coverageId: coverage.id, payerCategory: "SELF_PAY", createdById: manifest.users[0].userId } });
    await expect(prisma.payerCoverage.update({ where: { id: coverage.id }, data: { category: "PRIVATE_INSURANCE" } })).rejects.toThrow(/historical coverage/);
    await prisma.payerCoverage.update({ where: { id: coverage.id }, data: { eligibility: "VERIFIED", active: false, endedAt: new Date() } });
    expect((await prisma.encounter.findUniqueOrThrow({ where: { id: encounter.id } })).payerCategory).toBe("SELF_PAY");
    await expect(prisma.encounter.update({ where: { id: encounter.id }, data: { payerCategory: "UNINSURED" } })).rejects.toThrow(/immutable/);
  });
  it("writes facility/patient-tagged authoritative audit records with document events", async () => {
    expect(await prisma.auditLog.count({ where: { resourceId: docId, facilityId: fac().id, patientId: fac().patientId, action: "HIS_DOCUMENT_FINALIZED" } })).toBe(1);
  });
  it("commits review, signature and patient-release notifications into the durable outbox", async () => {
    const recipients = ["reviewer", "author", "patient"].map((role) => manifest.users.find((u) => u.hospital === "a" && u.role === role)!.userId);
    for (const id of recipients) {
      expect(await prisma.notification.count({ where: { userId: id, data: { path: ["documentId"], equals: docId } } })).toBeGreaterThan(0);
      const jobs = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM workspace_delivery WHERE owner_id = ${id}::uuid`;
      expect(Number(jobs[0].count)).toBeGreaterThan(0);
    }
  });
  it("rolls back clinical content changes when the authoritative audit cannot be written", async () => {
    const before = await prisma.clinicalDocument.findUniqueOrThrow({ where: { supersedesId: docId } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.clinicalDocument.update({ where: { id: before.id }, data: { title: "MUST ROLL BACK" } });
      await documentEvent(tx, before.id, "AUDIT_ROLLBACK_TEST", "00000000-0000-4000-8000-000000000000");
    })).rejects.toThrow();
    expect((await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: before.id } })).title).toBe(before.title);
  });
  it("prevents direct edits of finalized clinical content at the database boundary", async () => {
    await expect(prisma.clinicalDocument.update({ where: { id: docId }, data: { content: { note: "MUST NOT OVERWRITE" } } })).rejects.toThrow(/finalized clinical content/);
    await expect(prisma.clinicalDocument.update({ where: { id: docId }, data: { status: "DRAFT" } })).rejects.toThrow(/finalized clinical content/);
  });

  it("lets an administrator design facility letterheads, per department, with versioned audit", async () => {
    await as("owner");
    const body = {
      name: `Main letterhead ${runId}`, displayName: "Synthetic General Hospital",
      headerLines: ["Department of Medicine", "Referral hospital"], registrationInfo: "QA registration 000",
      website: "https://example.org", brandColor: "#1D4ED8", footerText: "Confidential — synthetic fixture",
      showQr: true, signatureBlocks: [{ name: "Dr. Ada", title: "Consultant", registrationId: "QA-1", side: "left" }],
    };
    const created = await createLetterhead(request("/api/facility/his/letterheads", "POST", body), { params: Promise.resolve({}) });
    expect(created.status).toBe(201);
    const letterhead = (await created.json()).letterhead as { id: string; isDefault: boolean; brandColor: string };
    expect(letterhead.isDefault).toBe(true); // first letterhead becomes the default
    expect(letterhead.brandColor).toBe("#1D4ED8");
    expect(await prisma.auditLog.count({ where: { action: "HIS_LETTERHEAD_CREATED", resourceId: letterhead.id, facilityId: fac().id } })).toBe(1);

    // A department-specific letterhead for Radiology.
    const dept = await createLetterhead(request("/api/facility/his/letterheads", "POST", { ...body, name: `Radiology letterhead ${runId}`, department: "Radiology", displayName: "Radiology Institute" }), { params: Promise.resolve({}) });
    expect(dept.status).toBe(201);
    radiologyLetterheadId = (await dept.json()).letterhead.id;

    // Resolution: department match first, facility default otherwise.
    expect((await resolveFacilityLetterhead(fac().id, "radiology"))?.displayName).toBe("Radiology Institute");
    expect(await resolveFacilityLetterhead(fac().id, null)).not.toBeNull();
    expect(await resolveFacilityLetterhead(fac("b").id, null)).toBeNull(); // tenant isolation

    // Updates and listing.
    expect((await patchLetterhead(request("/letterheads", "PATCH", { footerText: "Updated footer" }), ctx(letterhead.id))).status).toBe(200);
    const list = await listLetterheads(request("/letterheads", "GET"), { params: Promise.resolve({}) });
    expect((await list.json()).letterheads).toHaveLength(2);

    // The other hospital cannot see or touch this letterhead.
    await as("owner", "b");
    expect((await getLetterhead(request("/letterheads", "GET", undefined, "b"), ctx(letterhead.id))).status).toBe(404);
    expect((await patchLetterhead(request("/letterheads", "PATCH", { footerText: "steal" }, "b"), ctx(letterhead.id))).status).toBe(404);
    expect((await deleteLetterhead(request("/letterheads", "DELETE", undefined, "b"), ctx(letterhead.id))).status).toBe(404);
    await as("owner");
  });

  it("previews a department letterhead (Radiology) as a sample PDF, tenant-scoped", async () => {
    await as("owner");
    const response = await previewLetterhead(request("/preview", "GET"), ctx(radiologyLetterheadId));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // The Radiology letterhead enables the QR, so the preview embeds an image.
    expect((bytes.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length).toBeGreaterThanOrEqual(1);
    // The other hospital cannot preview this letterhead.
    await as("owner", "b");
    expect((await previewLetterhead(request("/preview", "GET", undefined, "b"), ctx(radiologyLetterheadId))).status).toBe(404);
    await as("owner");
  });

  it("renders documents under the resolved letterhead with the verification QR", async () => {
    await as("author");
    const response = await pdf(request("/pdf"), ctx(docId));
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // The finalized document is issued under the facility letterhead, which
    // enables the QR — so the rendered PDF carries an embedded QR image.
    expect((bytes.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("prints documents on the letterhead pinned to their template", async () => {
    // A template can pin one of the facility's saved letterheads; documents
    // from that template print on it regardless of department resolution.
    await as("owner");
    const create = await createTemplate(request("/api/facility/his/templates", "POST", {
      mode: "custom", name: `Pinned letterhead ${runId}`, groupCode: "B",
      definition: { ...def, output: { pageSize: "A4", letterheadId: radiologyLetterheadId } },
    }), { params: Promise.resolve({}) });
    expect(create.status).toBe(201);
    const pinnedTemplateId = (await create.json()).template.id;
    expect((await templateAction(request("/actions", "POST", { action: "submit" }), ctx(pinnedTemplateId))).status).toBe(200);
    await as("reviewer");
    expect((await templateAction(request("/actions", "POST", { action: "approve" }), ctx(pinnedTemplateId))).status).toBe(200);
    await as("owner");
    expect((await templateAction(request("/actions", "POST", { action: "publish" }), ctx(pinnedTemplateId))).status).toBe(200);
    await as("author");
    const doc = await createDocument(request("/api/facility/his/documents", "POST", {
      templateId: pinnedTemplateId, patientId: fac().patientId, encounterId: fac().encounterIds[0],
    }), { params: Promise.resolve({}) });
    expect(doc.status).toBe(201);
    const pinnedDocId = (await doc.json()).document.id;
    await saveDocument(request("/document", "PUT", { content: { note: "SYNTHETIC ACCEPTANCE ONLY. Not a clinical record." } }), ctx(pinnedDocId));

    const row = await prisma.clinicalDocument.findFirstOrThrow({ where: { id: pinnedDocId }, include: documentInclude });
    const view = await buildDocumentView(row);
    expect(view.facility.name).toBe("Radiology Institute");
    expect(view.facility.signatureBlocks).toEqual([]);
    // Unpinning falls back to the facility's automatic resolution.
    const unpinned = await buildDocumentView({ ...row, templateVersion: { ...row.templateVersion, definition: { ...(row.templateVersion.definition as Record<string, unknown>), output: { pageSize: "A4", letterheadId: null } } } });
    expect(unpinned.facility.name).toBe("Synthetic General Hospital");
  });

  it("refuses to pin a letterhead the facility does not own", async () => {
    await as("owner");
    const foreign = await createTemplate(request("/api/facility/his/templates", "POST", {
      mode: "custom", name: `Foreign pin ${runId}`, groupCode: "B",
      definition: { ...def, output: { pageSize: "A4", letterheadId: "33333333-3333-4333-8333-333333333333" } },
    }), { params: Promise.resolve({}) });
    expect(foreign.status).toBe(400);
    expect(((await foreign.json()) as { error: string }).error).toContain("not available to this facility");
    const other = await createTemplate(request("/api/facility/his/templates", "POST", {
      mode: "custom", name: `Other hospital pin ${runId}`, groupCode: "B", definition: { ...def, output: { pageSize: "A4", letterheadId: radiologyLetterheadId } },
    }, "b"), { params: Promise.resolve({}) });
    expect(other.status).toBe(400);
  });

  it("keeps doctor letterheads personal: only the owner can list, edit or resolve them", async () => {
    // A synthetic verified doctor (independent practice) outside the facility roster.
    const doctorUser = await prisma.user.create({ data: {
      clerkId: `local_test_${runId}_doctor_letterhead`, email: `qa-doctor-letterhead-${runId}@example.org`,
      name: "QA Doctor Letterhead", role: "DOCTOR", accountType: "DOCTOR", status: "ACTIVE", onboardingComplete: true,
      testAccountExpiresAt: new Date(manifest.expiresAt),
    } });
    await prisma.doctorProfile.create({ data: { userId: doctorUser.id, verificationStatus: "VERIFIED" } });
    vi.mocked(requireUser).mockResolvedValue(doctorUser);
    vi.mocked(requireRole).mockImplementation(async (...roles) => {
      if (!roles.includes(doctorUser.role)) throw new Error("Fixture does not have requested platform role");
      return doctorUser;
    });

    const created = await createDoctorLetterhead(new NextRequest("http://localhost:3000/api/doctors/me/letterheads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Practice letterhead", displayName: "Dr. Ada — Independent Practice", headerLines: ["Independent practice"], brandColor: "#7C3AED", showQr: true }),
    }), { params: Promise.resolve({}) });
    expect(created.status).toBe(201);
    const personal = (await created.json()).letterhead as { id: string; isDefault: boolean };
    expect(personal.isDefault).toBe(true);

    const list = await listDoctorLetterheads(new NextRequest("http://localhost:3000/api/doctors/me/letterheads"), { params: Promise.resolve({}) });
    expect((await list.json()).letterheads).toHaveLength(1);
    expect((await resolveDoctorLetterhead(doctorUser.id))?.brandColor).toBe("#7C3AED");

    expect((await patchDoctorLetterhead(new NextRequest(`http://localhost:3000/api/doctors/me/letterheads/${personal.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ footerText: "Personal footer" }),
    }), ctx(personal.id))).status).toBe(200);

    // A facility owner (different user) cannot resolve the doctor's letterhead.
    expect(await resolveDoctorLetterhead(manifest.users[0].userId)).toBeNull();
  });
});
