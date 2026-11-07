import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { User } from "@prisma/client";
import { NextRequest } from "next/server";
import { forbidden, unauthorized } from "@/lib/errors";

const identity = vi.hoisted(() => {
  const url = process.env.ORG_TEST_DATABASE_URL;
  if (url) {
    if (!new URL(url).pathname.endsWith("_test")) throw new Error("Organization integration tests require a disposable *_test database");
    process.env.DATABASE_URL = url;
  }
  return { actor: null as User | null, fva: [0, 0], verified: true };
});
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ sessionClaims: { fva: identity.fva } }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: identity.actor?.email, verification: { status: identity.verified ? "verified" : "unverified" } }] }),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => identity.actor,
  requireUser: async () => {
    if (!identity.actor || identity.actor.status !== "ACTIVE") throw unauthorized();
    return identity.actor;
  },
  requireRole: async (...roles: string[]) => {
    if (!identity.actor || !roles.includes(identity.actor.role)) throw forbidden();
    return identity.actor;
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ queueNotification: vi.fn(async () => undefined) }));
import { prisma } from "@/lib/prisma";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { createStaffInvitation, redeemStaffInvitation, hashInviteToken } from "@/lib/facility-invitations";
import { controlAudit } from "./security";
import { assertClinicalPrivilege } from "./privileges";
import { getStaffMembership, assertStaffCanReachPatient } from "@/lib/staff-access";
import { enforceRequestPolicy, requireSuperAdmin } from "@/lib/platform/access";
import * as departments from "@/app/api/facility/departments/route";
import * as department from "@/app/api/facility/departments/[id]/route";
import * as organization from "@/app/api/facility/organization/route";
import * as staffAccess from "@/app/api/facility/staff/[id]/access/route";
import * as staff from "@/app/api/facility/staff/[id]/route";
import * as master from "@/app/api/admin/control/route";
import * as clinicalPrivileges from "@/app/api/facility/staff/[id]/privileges/route";
import * as accountControls from "@/app/api/admin/users/[id]/route";
import * as accountDirectory from "@/app/api/admin/users/route";

const enabled = Boolean(process.env.ORG_TEST_DATABASE_URL);
const token = randomUUID();
let owner: User, other: User, clinician: User, admin: User;
let facilityId: string, otherFacilityId: string, staffId: string, otherStaffId: string;
let departmentId: string, childId: string, positionId: string, patientId: string, credentialId: string;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };
const request = (path: string, method = "GET", body?: object, selected = facilityId) => new NextRequest(`http://localhost/api${path}${path.includes("?") ? "&" : "?"}facilityId=${selected}`, {
  method, headers: { "Content-Type": "application/json", Origin: "http://localhost" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const makeUser = (name: string, role: "PATIENT" | "ADMIN" = "PATIENT") => prisma.user.create({ data: {
  clerkId: `${token}-${name}`, email: `${token}-${name.toLowerCase()}@example.invalid`, name, role, onboardingComplete: true, country: "NG",
} });

describe.skipIf(!enabled)("organization and platform control: real PostgreSQL boundaries", () => {
  beforeAll(async () => {
    owner = await makeUser("Owner"); other = await makeUser("Other"); clinician = await makeUser("Clinician"); admin = await makeUser("Admin", "ADMIN");
    const a = await prisma.labStaffProfile.create({ data: { userId: owner.id, laboratoryName: "Synthetic Acceptance Hospital A", kind: "HOSPITAL", departments: [], verificationStatus: "VERIFIED" } });
    const b = await prisma.labStaffProfile.create({ data: { userId: other.id, laboratoryName: "Synthetic Acceptance Hospital B", kind: "HOSPITAL", departments: [], verificationStatus: "VERIFIED" } });
    facilityId = a.id; otherFacilityId = b.id;
    await prisma.facilityStaff.create({ data: { facilityId, userId: owner.id, fullName: owner.name, email: owner.email, facilityRole: "OWNER", status: "ACTIVE", accessLevel: "FULL" } });
    await prisma.facilityStaff.create({ data: { facilityId: otherFacilityId, userId: other.id, fullName: other.name, email: other.email, facilityRole: "OWNER", status: "ACTIVE", accessLevel: "FULL" } });
    const member = await prisma.facilityStaff.create({ data: { facilityId, userId: clinician.id, fullName: clinician.name, email: clinician.email, facilityRole: "NURSE", status: "ACTIVE", accessLevel: "LIMITED" } });
    staffId = member.id;
    const second = await prisma.facilityStaff.create({ data: { facilityId: otherFacilityId, userId: clinician.id, fullName: clinician.name, email: clinician.email, facilityRole: "ACCOUNTANT", status: "ACTIVE", accessLevel: "READ_ONLY" } });
    otherStaffId = second.id;
    const p = await prisma.patient.create({ data: { caseNumber: `ORG-${token}`, firstName: "Synthetic", lastName: "Patient", gender: "FEMALE", dateOfBirth: new Date("1990-01-01") } });
    patientId = p.id;
    const credential = await prisma.staffCredential.create({ data: { staffId, type: "NURSING_LICENCE", number: token, authority: "Synthetic authority", verificationStatus: "UNVERIFIED" } });
    credentialId = credential.id;
    identity.actor = owner;
  }, 30000);
  afterAll(async () => { if (enabled) await prisma.$disconnect(); });
  beforeEach(() => { identity.actor = owner; identity.fva = [0, 0]; identity.verified = true; });

  it("keeps one account with independent memberships and requires explicit selection", async () => {
    await expect(requireFacilityAccess(clinician, null)).rejects.toMatchObject({ status: 400 });
    const a = await requireFacilityAccess(clinician, null, request("/facility/staff", "GET"));
    const b = await requireFacilityAccess(clinician, null, request("/facility/staff", "GET", undefined, otherFacilityId));
    expect(a.facility.id).toBe(facilityId); expect(a.facilityRole).toBe("NURSE");
    expect(b.facilityRole).toBe("ACCOUNTANT"); expect(b.permissions).not.toContain("MANAGE_STAFF");
  });
  it("rejects duplicate memberships without creating duplicate users", async () => {
    await expect(prisma.facilityStaff.create({ data: { facilityId, userId: clinician.id, email: `duplicate-${clinician.email}`, fullName: "Duplicate", facilityRole: "NURSE" } })).rejects.toThrow();
  });
  it("creates a department and laboratory subdepartment through real APIs", async () => {
    identity.actor = owner;
    const response = await departments.POST(request("/facility/departments", "POST", { name: `Laboratory ${token}`, code: `LAB-${token}`.slice(0, 30) }), noParams);
    expect(response.status).toBe(201);
    departmentId = (await response.json()).department.id;
    const sub = await departments.POST(request("/facility/departments", "POST", { name: "Microbiology", parentId: departmentId, leadStaffId: staffId }), noParams);
    expect(sub.status).toBe(201); childId = (await sub.json()).department.id;
  });
  it("rejects a cross-facility department head through the API and database", async () => {
    const response = await departments.POST(request("/facility/departments", "POST", { name: "Wrong head", leadStaffId: otherStaffId }), noParams);
    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(prisma.facilityDepartment.create({ data: { facilityId, slug: `bad-${token}`, name: "Cross tenant", leadStaffId: otherStaffId } })).rejects.toThrow("Cross-facility");
    await expect(prisma.facilityStaff.update({ where: { id: staffId }, data: { facilityId: otherFacilityId } })).rejects.toThrow("immutable");
  });
  it("rejects departmental cycles at the API and SQL boundaries", async () => {
    const response = await department.PATCH(request(`/facility/departments/${departmentId}`, "PATCH", { parentId: childId }), ctx(departmentId));
    expect(response.status).toBe(400);
    await expect(prisma.facilityDepartment.update({ where: { id: departmentId }, data: { parentId: childId } })).rejects.toThrow("cycle");
  });
  it("creates a vacancy and records an acting appointment without clinical authorization", async () => {
    const response = await organization.POST(request("/facility/organization", "POST", { action: "POSITION", title: "Head of Microbiology", category: "Laboratory", rank: 10, departmentId: childId, parentId: null }), noParams);
    expect(response.status).toBe(201); positionId = (await response.json()).result.id;
    const appointed = await organization.POST(request("/facility/organization", "POST", { action: "APPOINT", positionId, staffId, kind: "ACTING", effectiveAt: new Date(Date.now() - 1000).toISOString(), endsAt: null, reason: "Synthetic authorized leadership appointment" }), noParams);
    expect(appointed.status).toBe(201);
    await expect(assertClinicalPrivilege(staffId, "VERIFY_RESULTS")).rejects.toMatchObject({ status: 403 });
  });
  it("rejects overlapping or cross-tenant appointments", async () => {
    const body = { action: "APPOINT", positionId, staffId, kind: "ACTING", effectiveAt: new Date().toISOString(), endsAt: null, reason: "Synthetic overlapping appointment denied" };
    expect((await organization.POST(request("/facility/organization", "POST", body), noParams)).status).toBe(409);
    expect((await organization.POST(request("/facility/organization", "POST", { ...body, kind: "DEPUTY", staffId: otherStaffId }), noParams)).status).toBe(404);
  });
  it.each([
    ["Doctor", "DOCTOR"], ["Nurse", "NURSE"], ["Laboratory scientist", "LAB_SCIENTIST"],
    ["Radiologist", "RADIOLOGIST"], ["Diagnostic specialist", "DIAGNOSTIC_SPECIALIST"],
    ["Accountant", "ACCOUNTANT"], ["Cashier", "CASHIER"], ["Legal practitioner", "CUSTOM"],
    ["Media officer", "CUSTOM"],
  ] as const)("creates a safe specialist invitation for %s", async (title, role) => {
    // Professional titles are distinct from authorization roles; custom professions use a safe existing role.
    const allowedRole = role === "CASHIER" ? "BILLING_OFFICER" : role === "CUSTOM" ? "RECEPTIONIST" : role;
    const invitation = await createStaffInvitation({ facilityId, email: `${randomUUID()}@example.invalid`, fullName: title, facilityRole: allowedRole as never, professionalTitle: title, departmentId: childId, invitedById: owner.id });
    const saved = await prisma.facilityStaff.findUniqueOrThrow({ where: { id: invitation.staffId } });
    expect(saved.inviteToken).toBe(hashInviteToken(invitation.inviteToken));
    expect(saved.accessLevel).toBe("LIMITED"); expect(saved.userId).toBeNull();
  });
  it("accepts once into an existing verified account and rejects reuse", async () => {
    const user = await makeUser("Invitee");
    const invite = await createStaffInvitation({ facilityId, email: user.email, fullName: user.name, facilityRole: "NURSE", invitedById: owner.id });
    identity.actor = user;
    const result = await redeemStaffInvitation(user, invite.inviteToken);
    expect(result.userId).toBe(user.id); expect(result.inviteToken).toBeNull();
    await expect(redeemStaffInvitation(user, invite.inviteToken)).rejects.toThrow();
    identity.actor = owner;
  });
  it("rejects wrong email, unverified email, expiry and cancelled invitations", async () => {
    const user = await makeUser("Rejected");
    const invite = await createStaffInvitation({ facilityId, email: user.email, fullName: user.name, facilityRole: "NURSE", invitedById: owner.id });
    await expect(redeemStaffInvitation(owner, invite.inviteToken)).rejects.toMatchObject({ status: 403 });
    identity.actor = user; identity.verified = false;
    await expect(redeemStaffInvitation(user, invite.inviteToken)).rejects.toMatchObject({ status: 403 });
    identity.verified = true;
    const rejected = await redeemStaffInvitation(user, invite.inviteToken, true);
    expect(rejected.invitationState).toBe("REJECTED"); expect(rejected.userId).toBeNull();
    const expired = await createStaffInvitation({ facilityId, email: `${randomUUID()}@example.invalid`, fullName: "Expired", facilityRole: "NURSE", invitedById: owner.id });
    await prisma.facilityStaff.update({ where: { id: expired.staffId }, data: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    await expect(redeemStaffInvitation(user, expired.inviteToken)).rejects.toMatchObject({ status: 409 });
    identity.actor = owner;
  });
  it("denies cross-tenant staff updates and role escalation", async () => {
    const crossed = await staffAccess.PATCH(request(`/facility/staff/${otherStaffId}/access`, "PATCH", { accessLevel: "FULL" }), ctx(otherStaffId));
    expect(crossed.status).toBe(404);
    identity.actor = clinician;
    const escalated = await staffAccess.PATCH(request(`/facility/staff/${staffId}/access`, "PATCH", { accessLevel: "CUSTOM", permissionOverrides: { add: ["MANAGE_STAFF"], remove: [] } }), ctx(staffId));
    expect(escalated.status).toBe(403); identity.actor = owner;
  });
  it("enforces limited patient access and immediate revocation", async () => {
    await prisma.encounter.create({ data: { facilityId, patientId, encounterNumber: token, type: "SCHEDULED_OUTPATIENT", createdById: owner.id } });
    const membership = await getStaffMembership(clinician, facilityId);
    await expect(requireFacilityAccess(clinician, null, request("/facility/his/documents"))).rejects.toMatchObject({ status: 404 });
    await expect(assertStaffCanReachPatient(membership, patientId)).rejects.toMatchObject({ status: 404 });
    expect((await staffAccess.POST(request(`/facility/staff/${staffId}/access`, "POST", { action: "GRANT", patientId, scope: "CARE_TEAM", justification: "Synthetic assigned care team" }), ctx(staffId))).status).toBe(200);
    await expect(assertStaffCanReachPatient(membership, patientId)).resolves.toBeUndefined();
    await expect(requireFacilityAccess(clinician, null, request(`/facility/his/documents?patientId=${patientId}`))).resolves.toBeTruthy();
    expect((await staffAccess.POST(request(`/facility/staff/${staffId}/access`, "POST", { action: "REVOKE", patientId, justification: "Synthetic immediate revocation" }), ctx(staffId))).status).toBe(200);
    await expect(assertStaffCanReachPatient(membership, patientId)).rejects.toMatchObject({ status: 404 });
  });
  it("requires verified credentials plus an explicit current clinical privilege", async () => {
    await expect(prisma.clinicalPrivilege.create({ data: { staffId: otherStaffId, credentialId, permission: "ADMINISTER_MEDICATIONS", grantedById: owner.id, reason: "Synthetic cross-membership privilege must fail", expiresAt: new Date(Date.now() + 86400000) } })).rejects.toThrow();
    await expect(assertClinicalPrivilege(staffId, "ADMINISTER_MEDICATIONS")).rejects.toMatchObject({ status: 403 });
    await prisma.staffCredential.update({ where: { id: credentialId }, data: { verificationStatus: "VERIFIED" } });
    await expect(assertClinicalPrivilege(staffId, "ADMINISTER_MEDICATIONS")).rejects.toMatchObject({ status: 403 });
    const granted = await clinicalPrivileges.POST(request(`/facility/staff/${staffId}/privileges`, "POST", { credentialId, permission: "ADMINISTER_MEDICATIONS", reason: "Synthetic authorized regulated privilege", expiresAt: new Date(Date.now() + 86400000).toISOString(), confirmation: "GRANT CLINICAL PRIVILEGE" }), ctx(staffId));
    expect(granted.status).toBe(201);
    const p = (await granted.json()).privilege;
    await expect(assertClinicalPrivilege(staffId, "ADMINISTER_MEDICATIONS")).resolves.toBeUndefined();
    expect((await clinicalPrivileges.DELETE(request(`/facility/staff/${staffId}/privileges`, "DELETE", { id: p.id, reason: "Synthetic clinical privilege revocation" }), ctx(staffId))).status).toBe(200);
    await expect(assertClinicalPrivilege(staffId, "ADMINISTER_MEDICATIONS")).rejects.toMatchObject({ status: 403 });
  });
  it("revokes a facility membership without affecting the second facility", async () => {
    const response = await staff.PATCH(request(`/facility/staff/${staffId}`, "PATCH", { status: "SUSPENDED" }), ctx(staffId));
    expect(response.status).toBe(200);
    await expect(requireFacilityAccess(clinician, null, request("/facility/staff"))).rejects.toMatchObject({ status: 403 });
    expect((await requireFacilityAccess(clinician, null, request("/facility/staff", "GET", undefined, otherFacilityId))).facility.id).toBe(otherFacilityId);
    const snapshot = await (await organization.GET(request("/facility/organization"), noParams)).json();
    expect(snapshot.positions.find((p: { id: string }) => p.id === positionId).appointments).toHaveLength(0);
    expect(snapshot.history.some((a: { staffId: string; positionId: string }) => a.staffId === staffId && a.positionId === positionId)).toBe(true);
    await prisma.facilityStaff.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  });
  it("requires an explicit grant, current MFA, and sensitive-action confirmation", async () => {
    identity.actor = admin;
    await expect(requireSuperAdmin(admin)).rejects.toMatchObject({ status: 403 });
    await prisma.superAdminGrant.create({ data: { userId: admin.id, grantedBy: "Synthetic test operator", reason: "Isolated automated acceptance only" } });
    identity.fva = [1, -1]; await expect(requireSuperAdmin(admin)).rejects.toMatchObject({ status: 403 });
    identity.fva = [1, 11]; await expect(requireSuperAdmin(admin)).rejects.toMatchObject({ status: 403 });
    identity.fva = [0, 0]; await expect(requireSuperAdmin(admin)).resolves.toBeTruthy();
    const pending = await prisma.staffCredential.create({ data: { staffId, type: "PROFESSIONAL_CERTIFICATION", number: `REVIEW-${token}`, authority: "Synthetic independently checked authority", verificationStatus: "UNVERIFIED" } });
    expect((await master.POST(request("/admin/control", "POST", { action: "VERIFY_CREDENTIAL", id: pending.id, decision: "VERIFIED", reason: "Synthetic verification evidence checked independently", confirmation: "REVIEW CREDENTIAL" }), noParams)).status).toBe(201);
    expect((await prisma.staffCredential.findUniqueOrThrow({ where: { id: pending.id } })).verificationStatus).toBe("VERIFIED");
    const response = await master.POST(request("/admin/control", "POST", { action: "POLICY", key: `test-${token}`, kind: "FEATURE", resource: "STAFF", mode: "DISABLED", rules: { facilityIds: [facilityId] }, expectedRevision: 0, reason: "Synthetic restriction with invalid confirmation", confirmation: "incorrect" }), noParams);
    expect(response.status).toBe(400);
  });
  it("applies a global restriction on the backend and reverses it by a new audited revision", async () => {
    identity.actor = admin;
    const body = { action: "POLICY", key: `test-${token}`, kind: "FEATURE", resource: "STAFF", mode: "DISABLED", rules: { facilityIds: [facilityId] }, expectedRevision: 0, reason: "Synthetic reversible access restriction", confirmation: "APPLY POLICY" };
    expect((await master.POST(request("/admin/control", "POST", body), noParams)).status).toBe(201);
    await expect(enforceRequestPolicy(owner, request("/facility/staff"))).rejects.toMatchObject({ status: 403 });
    await expect(enforceRequestPolicy(other, request("/facility/staff", "GET", undefined, otherFacilityId))).resolves.toBeUndefined();
    expect((await master.POST(request("/admin/control", "POST", body), noParams)).status).toBe(409);
    expect((await master.POST(request("/admin/control", "POST", { ...body, mode: "ENABLED", expectedRevision: 1 }), noParams)).status).toBe(201);
    await expect(enforceRequestPolicy(owner, request("/facility/staff"))).resolves.toBeUndefined();
  });
  it("requires the same safeguards on both legacy and current account-control endpoints", async () => {
    const ungranted = await makeUser("OrdinaryAdmin", "ADMIN");
    const target = await makeUser("AccountTarget");
    const body = { id: target.id, role: "ADMIN", reason: "Synthetic authorized administrator assignment", confirmation: "CONFIRM ACCOUNT CHANGE" };
    identity.actor = ungranted;
    expect((await accountDirectory.PATCH(request("/admin/users", "PATCH", body), noParams)).status).toBe(403);
    identity.actor = admin; identity.fva = [1, -1];
    expect((await accountDirectory.PATCH(request("/admin/users", "PATCH", body), noParams)).status).toBe(403);
    identity.fva = [0, 0];
    expect((await accountDirectory.PATCH(request("/admin/users", "PATCH", { ...body, confirmation: "incorrect" }), noParams)).status).toBe(400);
    expect((await accountDirectory.PATCH(request("/admin/users", "PATCH", { ...body, role: "DOCTOR" }), noParams)).status).toBe(400);
    expect((await accountDirectory.PATCH(request("/admin/users", "PATCH", body), noParams)).status).toBe(200);
    expect((await accountControls.PATCH(request(`/admin/users/${target.id}`, "PATCH", { administrator: false, reason: body.reason, confirmation: body.confirmation }), ctx(target.id))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("PATIENT");
    expect(await prisma.controlAuditEvent.count({ where: { resourceId: target.id } })).toBe(2);
  });
  it("blocks document collection/download APIs without deleting any document rows", async () => {
    identity.actor = admin;
    const body = { action: "POLICY", key: `doc-${token}`, kind: "DOCUMENT", resource: "*", mode: "RESTRICTED", rules: { deniedActions: ["DOWNLOAD", "PRINT"] }, expectedRevision: 0, reason: "Synthetic document download restriction", confirmation: "APPLY POLICY" };
    expect((await master.POST(request("/admin/control", "POST", body), noParams)).status).toBe(201);
    await expect(enforceRequestPolicy(owner, request("/facility/his/documents/export"))).rejects.toMatchObject({ status: 403 });
    await expect(enforceRequestPolicy(owner, request("/facility/his/documents"))).resolves.toBeUndefined();
    expect((await master.POST(request("/admin/control", "POST", { ...body, mode: "ENABLED", expectedRevision: 1 }), noParams)).status).toBe(201);
  });
  it("blocks non-admin master-control requests", async () => {
    identity.actor = clinician;
    expect((await master.GET(request("/admin/control"), noParams)).status).toBe(403);
    identity.actor = owner;
  });
  it("deactivates departments non-destructively", async () => {
    expect((await department.DELETE(request(`/facility/departments/${childId}`, "DELETE"), ctx(childId))).status).toBe(200);
    expect((await prisma.facilityDepartment.findUniqueOrThrow({ where: { id: childId } })).active).toBe(false);
  });
  it("commits immutable hash-chained events and verifies the full chain", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, n) => prisma.$transaction((tx) => controlAudit(tx, owner.id, facilityId, "CONCURRENT_ACCEPTANCE", `${token}-${n}`, {}))));
    const result = await prisma.$queryRaw<{ invalid: bigint }[]>`
      SELECT count(*) AS invalid FROM (
        SELECT *, lag(hash, 1, '') OVER (ORDER BY sequence) AS expected_previous FROM control_audit_events
      ) e WHERE previous_hash <> expected_previous OR hash <> encode(sha256(convert_to(
        jsonb_build_array(previous_hash, sequence, actor_id, facility_id, action, resource_id, details, occurred_at)::text, 'UTF8')), 'hex')`;
    expect(Number(result[0].invalid)).toBe(0);
    await expect(prisma.controlAuditEvent.updateMany({ data: { action: "TAMPERED" } })).rejects.toThrow("Append-only");
    await expect(prisma.controlAuditEvent.deleteMany()).rejects.toThrow("Append-only");
    await expect(prisma.platformPolicy.updateMany({ data: { mode: "DISABLED" } })).rejects.toThrow("Append-only");
  });
  it("optionally exports synthetic acceptance fixtures for responsive component QA", async () => {
    if (process.env.ORG_EXPORT_QA !== "1") return;
    await prisma.staffCredential.create({ data: { staffId, type: "PROFESSIONAL_CERTIFICATION", number: `QA-${token}`, authority: "Synthetic evidence awaiting independent review", verificationStatus: "UNVERIFIED" } });
    await mkdir("qa/feature-audit/dist", { recursive: true });
    identity.actor = owner;
    const org = await organization.GET(request("/facility/organization"), noParams);
    expect(org.status).toBe(200);
    const payload = await org.json();
    await writeFile("qa/feature-audit/dist/organization-acceptance.json", JSON.stringify({ facilityId, payload }));
    const staffDetails: Record<string, object> = {};
    for (const s of payload.staff) {
      const a = await staffAccess.GET(request(`/facility/staff/${s.id}/access`), ctx(s.id));
      const p = await clinicalPrivileges.GET(request(`/facility/staff/${s.id}/privileges`), ctx(s.id));
      expect(a.status).toBe(200); expect(p.status).toBe(200);
      staffDetails[s.id] = { access: await a.json(), privileges: await p.json() };
    }
    await writeFile("qa/feature-audit/dist/organization-staff-acceptance.json", JSON.stringify(staffDetails));
    identity.actor = admin;
    const control = await master.GET(request("/admin/control"), noParams);
    expect(control.status).toBe(200);
    await writeFile("qa/feature-audit/dist/control-acceptance.json", JSON.stringify(await control.json()));
  });
});
