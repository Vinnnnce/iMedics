import type { Prisma, FacilityStaffRole } from "@prisma/client";
import { prisma } from "./prisma";
import { conflict, forbidden, notFound } from "./errors";
import { createHash } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { validateOrganizationLinks, controlAudit } from "./organization/security";
import { generateInviteToken, INVITE_EXPIRY_DAYS } from "./facility-staff";
import { appUrl, sendEmail } from "./notifications/email";
import type { User } from "@prisma/client";

/**
 * Secure staff account invitations.
 *
 * The facility administrator creates an invitation for a work email. The invitee
 * signs up (or signs in) with that same email through the normal Clerk flow —
 * Clerk verifies the address — and redeems the single-use token here. The
 * system never creates accounts or sets passwords on their behalf: identity,
 * password policy, forced password change on first login, 2FA and session
 * expiry all remain Clerk's verified flows, and redemption is refused unless
 * the signed-in account's email matches the invited address exactly.
 */

export async function createStaffInvitation(
  input: {
    facilityId: string;
    email: string;
    fullName: string;
    facilityRole: FacilityStaffRole;
    departmentId?: string | null;
    branchId?: string | null;
    customCategory?: string | null;
    invitedById: string;
    professionalTitle?: string | null;
    specialty?: string | null;
    employmentType?: import("@prisma/client").EmploymentType | null;
    expiryDays?: number;
  },
  tx?: Prisma.TransactionClient,
): Promise<{ staffId: string; inviteToken: string; redeemUrl: string; expiresAt: Date }> {
  if (!tx) return prisma.$transaction((transaction) => createStaffInvitation(input, transaction));
  const db = tx ?? prisma;
  const email = input.email.trim().toLowerCase();
  await validateOrganizationLinks(db, input.facilityId, input);

  const existing = await db.facilityStaff.findUnique({
    where: { facilityId_email: { facilityId: input.facilityId, email } },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "TERMINATED") {
    throw conflict("That email is already on this facility's staff list");
  }

  const inviteToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + (input.expiryDays ?? INVITE_EXPIRY_DAYS) * 86_400_000);
  const tokenHash = hashInviteToken(inviteToken);
  const reset = {
    departmentId: input.departmentId ?? null, branchId: input.branchId ?? null,
    customCategory: input.customCategory ?? null, professionalTitle: input.professionalTitle ?? null,
    specialty: input.specialty ?? null, employmentType: input.employmentType ?? null,
    permissionOverrides: {}, accessLevel: "LIMITED" as const, departmentIds: [],
    reportsToId: null, accessStartsAt: null, accessExpiresAt: null,
    invitationState: "PENDING_ACCEPTANCE",
  };
  if (existing) {
    // A new engagement never inherits an old engagement's patient/clinical grants.
    const now = new Date();
    await db.staffPatientAccess.updateMany({ where: { staffId: existing.id, revokedAt: null }, data: { revokedAt: now } });
    await db.clinicalPrivilege.updateMany({ where: { staffId: existing.id, revokedAt: null }, data: { revokedAt: now } });
    await db.breakGlassAccess.updateMany({ where: { staffId: existing.id, closedAt: null }, data: { closedAt: now } });
    await db.staffCredential.updateMany({ where: { staffId: existing.id }, data: { verificationStatus: "PENDING_VERIFICATION", verifiedAt: null, verifiedById: null } });
  }

  const staff = await db.facilityStaff.upsert({
    where: { facilityId_email: { facilityId: input.facilityId, email } },
    create: {
      ...reset,
      facilityId: input.facilityId,
      email,
      fullName: input.fullName,
      facilityRole: input.facilityRole,
      departmentId: input.departmentId ?? null,
      branchId: input.branchId ?? null,
      customCategory: input.customCategory ?? null,
      status: "INVITED",
      inviteToken: tokenHash,
      inviteExpiresAt: expiresAt,
      invitedById: input.invitedById,
    },
    update: {
      ...reset,
      fullName: input.fullName,
      facilityRole: input.facilityRole,
      status: "INVITED",
      inviteToken: tokenHash,
      inviteExpiresAt: expiresAt,
      userId: null,
      acceptedAt: null,
    },
  });

  await controlAudit(db, input.invitedById, input.facilityId, "STAFF_INVITATION_CREATED", staff.id, { email, facilityRole: input.facilityRole, expiresAt: expiresAt.toISOString() });
  return {
    staffId: staff.id,
    inviteToken,
    redeemUrl: `${appUrl()}/invite/staff/${inviteToken}`,
    expiresAt,
  };
}

export async function sendStaffInvitationEmail(input: {
  to: string;
  facilityName: string;
  redeemUrl: string;
  inviterName: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `You are invited to join ${input.facilityName} on Medic1905`,
    text: [
      `${input.inviterName} has invited you to join ${input.facilityName} as a staff member on Medic1905.`,
      "",
      "Open this link to accept the invitation (it expires in 7 days and can be used once):",
      input.redeemUrl,
      "",
      "You will sign in or create your account with this email address. Medic1905 never sets passwords on your behalf.",
    ].join("\n"),
    html: `<p>${escapeHtml(input.inviterName)} has invited you to join <strong>${escapeHtml(input.facilityName)}</strong> as a staff member on Medic1905.</p>
<p>Open this link to accept the invitation (it expires in 7 days and can be used once):<br>
<a href="${input.redeemUrl}">${input.redeemUrl}</a></p>
<p>You will sign in or create your account with this email address. Medic1905 never sets passwords on your behalf.</p>`,
    idempotencyKey: `staff-invite-${input.to}-${Date.now()}`,
  });
}

/**
 * Redeem an invitation with the signed-in account. Server-verified:
 * - the token must exist, be unexpired and unused;
 * - the account's email must match the invited address exactly;
 * - a user may only be linked to one staff record per facility.
 * The global platform role is never changed here — facility access is
 * membership-based and permission checks happen per request.
 */
export function hashInviteToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

export async function redeemStaffInvitation(user: User, token: string, reject = false) {
  const identity = await currentUser();
  if (!identity?.emailAddresses.some((e) => e.emailAddress.toLowerCase() === user.email.toLowerCase() && e.verification?.status === "verified")) throw forbidden("Verify the invited email address before responding");
  return prisma.$transaction(async (tx) => {
  // Raw fallback preserves already-issued legacy invitations until expiry.
  const staff = await tx.facilityStaff.findFirst({ where: { OR: [{ inviteToken: hashInviteToken(token) }, { inviteToken: token }] } });
  if (!staff) throw notFound("Invitation not found");
  if (staff.userId || staff.acceptedAt) throw conflict("This invitation has already been used");
  if (staff.inviteExpiresAt && staff.inviteExpiresAt < new Date()) throw conflict("This invitation has expired");
  if (staff.status !== "INVITED") throw forbidden("This invitation is no longer pending");

  const userEmail = user.email.toLowerCase();
  if (staff.email.toLowerCase() !== userEmail) {
    throw forbidden("This invitation was sent to a different email address. Sign in with the invited email.");
  }

  const changed = await tx.facilityStaff.updateMany({
    where: { id: staff.id, inviteToken: staff.inviteToken, status: "INVITED", userId: null, inviteExpiresAt: { gt: new Date() } },
    data: {
      userId: reject ? null : user.id,
      status: reject ? "TERMINATED" : "ACTIVE",
      invitationState: reject ? "REJECTED" : "ACCEPTED",
      acceptedAt: reject ? null : new Date(),
      lastLoginAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });
  if (changed.count !== 1) throw conflict("This invitation has already been used or expired");
  await controlAudit(tx, user.id, staff.facilityId, reject ? "STAFF_INVITATION_REJECTED" : "STAFF_INVITATION_ACCEPTED", staff.id, {});
  return tx.facilityStaff.findUniqueOrThrow({ where: { id: staff.id } });
  });
}
