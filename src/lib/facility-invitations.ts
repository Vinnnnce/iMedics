import type { Prisma, FacilityStaffRole } from "@prisma/client";
import { prisma } from "./prisma";
import { conflict, forbidden, notFound } from "./errors";
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
    invitedById: string;
  },
  tx?: Prisma.TransactionClient,
): Promise<{ staffId: string; inviteToken: string; redeemUrl: string; expiresAt: Date }> {
  const db = tx ?? prisma;
  const email = input.email.trim().toLowerCase();

  const existing = await db.facilityStaff.findUnique({
    where: { facilityId_email: { facilityId: input.facilityId, email } },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "TERMINATED") {
    throw conflict("That email is already on this facility's staff list");
  }

  const inviteToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);

  const staff = await db.facilityStaff.upsert({
    where: { facilityId_email: { facilityId: input.facilityId, email } },
    create: {
      facilityId: input.facilityId,
      email,
      fullName: input.fullName,
      facilityRole: input.facilityRole,
      departmentId: input.departmentId ?? null,
      branchId: input.branchId ?? null,
      status: "INVITED",
      inviteToken,
      inviteExpiresAt: expiresAt,
      invitedById: input.invitedById,
    },
    update: {
      fullName: input.fullName,
      facilityRole: input.facilityRole,
      status: "INVITED",
      inviteToken,
      inviteExpiresAt: expiresAt,
      userId: null,
      acceptedAt: null,
    },
  });

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
    html: `<p>${input.inviterName} has invited you to join <strong>${input.facilityName}</strong> as a staff member on Medic1905.</p>
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
export async function redeemStaffInvitation(user: User, token: string) {
  const staff = await prisma.facilityStaff.findUnique({ where: { inviteToken: token } });
  if (!staff) throw notFound("Invitation not found");
  if (staff.userId || staff.acceptedAt) throw conflict("This invitation has already been used");
  if (staff.inviteExpiresAt && staff.inviteExpiresAt < new Date()) throw conflict("This invitation has expired");
  if (staff.status === "TERMINATED") throw forbidden("This invitation has been revoked");

  const userEmail = user.email.toLowerCase();
  if (staff.email.toLowerCase() !== userEmail) {
    throw forbidden("This invitation was sent to a different email address. Sign in with the invited email.");
  }

  const updated = await prisma.facilityStaff.update({
    where: { id: staff.id },
    data: {
      userId: user.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
      lastLoginAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });
  return updated;
}
