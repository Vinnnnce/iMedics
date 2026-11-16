import type {
  EmploymentType,
  FacilityStaff,
  FacilityStaffRole,
  Prisma,
  User,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { conflict, forbidden, notFound } from "./errors";
import {
  controlAudit,
  validateOrganizationLinks,
} from "./organization/security";
import {
  generateInviteToken,
  INVITE_EXPIRY_DAYS,
} from "./facility-staff";
import { appUrl, sendEmail } from "./notifications/email";

const MS_PER_DAY = 86_400_000;
const MIN_INVITE_EXPIRY_DAYS = 1;
const MAX_INVITE_EXPIRY_DAYS = 30;

export interface CreateStaffInvitationInput {
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
  employmentType?: EmploymentType | null;
  expiryDays?: number;
  /** Optional personalised invitation message shown in the email. */
  personalMessage?: string | null;
}

export interface CreatedStaffInvitation {
  staffId: string;
  inviteToken: string;
  inviteUrl: string;
  redeemUrl: string;
  expiresAt: Date;
}

/** Hash invitation tokens before storage; the raw token is never persisted. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison prevents token-timing oracles. */
export function inviteTokenMatches(
  presentedToken: string,
  storedToken: string | null,
): boolean {
  if (!storedToken) return false;

  const presentedHash = hashInviteToken(presentedToken);
  const storedHash = storedToken.length === 64 ? storedToken : hashInviteToken(storedToken);

  if (presentedHash.length !== storedHash.length) return false;

  return cryptoTimingSafeEqual(presentedHash, storedHash);
}

function cryptoTimingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  if (bufferA.length !== bufferB.length) return false;

  return createHash("sha256").update(bufferA).digest().equals(
    createHash("sha256").update(bufferB).digest(),
  );
}

/** Build a stable, shareable invitation link. */
export function buildStaffInvitationUrl(token: string): string {
  const base = appUrl().replace(/\/+$/, "");
  return `${base}/invite/staff/${encodeURIComponent(token)}`;
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function expiryDate(expiryDays?: number): Date {
  const days = expiryDays ?? INVITE_EXPIRY_DAYS;

  if (
    !Number.isInteger(days) ||
    days < MIN_INVITE_EXPIRY_DAYS ||
    days > MAX_INVITE_EXPIRY_DAYS
  ) {
    throw conflict(
      `Invitation expiry must be between ${MIN_INVITE_EXPIRY_DAYS} and ${MAX_INVITE_EXPIRY_DAYS} days`,
    );
  }

  return new Date(Date.now() + days * MS_PER_DAY);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

/**
 * Revoke active patient, clinical, and break-glass access before a new
 * invitation is issued. A new engagement must never inherit grants from an
 * earlier engagement.
 */
async function revokePriorEngagementAccess(
  db: Prisma.TransactionClient,
  staffId: string,
): Promise<void> {
  const now = new Date();

  await db.staffPatientAccess.updateMany({
    where: { staffId, revokedAt: null },
    data: { revokedAt: now },
  });

  await db.clinicalPrivilege.updateMany({
    where: { staffId, revokedAt: null },
    data: { revokedAt: now },
  });

  await db.breakGlassAccess.updateMany({
    where: { staffId, closedAt: null },
    data: { closedAt: now },
  });

  await db.staffCredential.updateMany({
    where: { staffId },
    data: {
      verificationStatus: "PENDING_VERIFICATION",
      verifiedAt: null,
      verifiedById: null,
    },
  });
}

/**
 * Create or reissue a secure staff invitation.
 *
 * The returned `inviteToken` is shown or emailed exactly once. Only its
 * SHA-256 hash is stored, so a database leak does not expose usable links.
 */
export async function createStaffInvitation(
  input: CreateStaffInvitationInput,
  tx?: Prisma.TransactionClient,
): Promise<CreatedStaffInvitation> {
  if (!tx) {
    return prisma.$transaction((transaction) =>
      createStaffInvitation(input, transaction),
    );
  }

  const db = tx;
  const email = normaliseEmail(input.email);

  if (!email || !email.includes("@")) {
    throw conflict("A valid work email address is required");
  }

  if (!input.fullName?.trim()) {
    throw conflict("The staff member's full name is required");
  }

  await validateOrganizationLinks(db, input.facilityId, input);

  const existing = await db.facilityStaff.findUnique({
    where: {
      facilityId_email: {
        facilityId: input.facilityId,
        email,
      },
    },
    select: {
      id: true,
      status: true,
      invitationState: true,
    },
  });

  if (existing && existing.status !== "TERMINATED") {
    throw conflict(
      "That email is already on this facility's staff list",
    );
  }

  const inviteToken = generateInviteToken(32);
  const tokenHash = hashInviteToken(inviteToken);
  const expiresAt = expiryDate(input.expiryDays);

  const reset = {
    departmentId: input.departmentId ?? null,
    branchId: input.branchId ?? null,
    customCategory: input.customCategory ?? null,
    professionalTitle: input.professionalTitle ?? null,
    specialty: input.specialty ?? null,
    employmentType: input.employmentType ?? null,
    permissionOverrides: {},
    accessLevel: "LIMITED" as const,
    departmentIds: [],
    reportsToId: null,
    accessStartsAt: null,
    accessExpiresAt: null,
    invitationState: "PENDING_ACCEPTANCE",
  };

  if (existing) {
    await revokePriorEngagementAccess(db, existing.id);
  }

  const staff = await db.facilityStaff.upsert({
    where: {
      facilityId_email: {
        facilityId: input.facilityId,
        email,
      },
    },
    create: {
      ...reset,
      facilityId: input.facilityId,
      email,
      fullName: input.fullName.trim(),
      facilityRole: input.facilityRole,
      status: "INVITED",
      inviteToken: tokenHash,
      inviteExpiresAt: expiresAt,
      invitedById: input.invitedById,
    },
    update: {
      ...reset,
      fullName: input.fullName.trim(),
      facilityRole: input.facilityRole,
      status: "INVITED",
      inviteToken: tokenHash,
      inviteExpiresAt: expiresAt,
      userId: null,
      acceptedAt: null,
      lastLoginAt: null,
    },
  });

  const inviteUrl = buildStaffInvitationUrl(inviteToken);

  await controlAudit(
    db,
    input.invitedById,
    input.facilityId,
    "STAFF_INVITATION_CREATED",
    staff.id,
    {
      email,
      facilityRole: input.facilityRole,
      expiresAt: expiresAt.toISOString(),
    },
  );

  return {
    staffId: staff.id,
    inviteToken,
    inviteUrl,
    redeemUrl: inviteUrl,
    expiresAt,
  };
}

export interface SendStaffInvitationEmailInput {
  to: string;
  facilityName: string;
  facilityId: string;
  staffId: string;
  redeemUrl: string;
  inviterName: string;
  inviterEmail?: string | null;
  personalMessage?: string | null;
  expiresAt: Date;
}

/**
 * Send an invitation email using an idempotency key tied to the invitation,
 * recipient, and expiry. Repeated delivery attempts for the same invitation
 * will not create a new email identity.
 */
export async function sendStaffInvitationEmail(
  input: SendStaffInvitationEmailInput,
): Promise<void> {
  const recipient = normaliseEmail(input.to);
  const expiresOn = input.expiresAt.toISOString().slice(0, 10);

  const personalMessage = input.personalMessage?.trim()
    ? `<blockquote>${escapeHtml(input.personalMessage.trim())}</blockquote>`
    : "";

  await sendEmail({
    to: recipient,
    subject: `You are invited to join ${input.facilityName} on Medic1905`,
    text: [
      `${input.inviterName} has invited you to join ${input.facilityName} as a staff member on Medic1905.`,
      input.personalMessage?.trim() ? "" : null,
      input.personalMessage?.trim(),
      "",
      "Open this link to accept the invitation:",
      input.redeemUrl,
      "",
      `This invitation expires on ${expiresOn} and can be used once.`,
      "You must sign in or create an account using this email address.",
      "Medic1905 never sets passwords on your behalf.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
    html: `
      <p>${escapeHtml(input.inviterName)} has invited you to join
      <strong>${escapeHtml(input.facilityName)}</strong> as a staff member on Medic1905.</p>
      ${personalMessage}
      <p>
        <a href="${input.redeemUrl}">Accept staff invitation</a><br>
        <span style="color:#555">${escapeHtml(input.redeemUrl)}</span>
      </p>
      <p>This invitation expires on ${escapeHtml(expiresOn)} and can be used once.</p>
      <p>You must sign in or create an account using this email address.
      Medic1905 never sets passwords on your behalf.</p>
    `,
    idempotencyKey: `staff-invite:${input.facilityId}:${input.staffId}:${recipient}:${expiresOn}`,
  });
}

/**
 * Generate a fresh invitation link for an existing pending invitation.
 *
 * This rotates the stored token hash and extends the expiry. It is intended
 * for “resend invitation” flows; it does not expose a previously issued token.
 */
export async function regenerateStaffInvitationLink(
  input: {
    facilityId: string;
    staffId: string;
    requestedById: string;
    expiryDays?: number;
  },
  tx?: Prisma.TransactionClient,
): Promise<CreatedStaffInvitation> {
  if (!tx) {
    return prisma.$transaction((transaction) =>
      regenerateStaffInvitationLink(input, transaction),
    );
  }

  const staff = await tx.facilityStaff.findFirst({
    where: {
      id: input.staffId,
      facilityId: input.facilityId,
    },
    select: {
      id: true,
      email: true,
      status: true,
      invitationState: true,
    },
  });

  if (!staff) {
    throw notFound("Staff invitation not found");
  }

  if (staff.status !== "INVITED" || staff.invitationState !== "PENDING_ACCEPTANCE") {
    throw conflict("Only a pending invitation can be resent");
  }

  const inviteToken = generateInviteToken(32);
  const expiresAt = expiryDate(input.expiryDays);

  const updated = await tx.facilityStaff.updateMany({
    where: {
      id: staff.id,
      facilityId: input.facilityId,
      status: "INVITED",
      invitationState: "PENDING_ACCEPTANCE",
    },
    data: {
      inviteToken: hashInviteToken(inviteToken),
      inviteExpiresAt: expiresAt,
      invitedById: input.requestedById,
    },
  });

  if (updated.count !== 1) {
    throw conflict("This invitation has already been used or expired");
  }

  const inviteUrl = buildStaffInvitationUrl(inviteToken);

  await controlAudit(
    tx,
    input.requestedById,
    input.facilityId,
    "STAFF_INVITATION_LINK_REGENERATED",
    staff.id,
    {
      email: staff.email,
      expiresAt: expiresAt.toISOString(),
    },
  );

  return {
    staffId: staff.id,
    inviteToken,
    inviteUrl,
    redeemUrl: inviteUrl,
    expiresAt,
  };
}

/** Revoke a pending invitation without terminating an active staff record. */
export async function revokeStaffInvitation(
  input: {
    facilityId: string;
    staffId: string;
    requestedById: string;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!tx) {
    return prisma.$transaction((transaction) =>
      revokeStaffInvitation(input, transaction),
    );
  }

  const updated = await tx.facilityStaff.updateMany({
    where: {
      id: input.staffId,
      facilityId: input.facilityId,
      status: "INVITED",
      invitationState: "PENDING_ACCEPTANCE",
      userId: null,
    },
    data: {
      invitationState: "REVOKED",
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  if (updated.count !== 1) {
    throw conflict("This invitation cannot be revoked");
  }

  await controlAudit(
    tx,
    input.requestedById,
    input.facilityId,
    "STAFF_INVITATION_REVOKED",
    input.staffId,
    {},
  );
}

/**
 * Redeem an invitation using the signed-in account.
 *
 * Server-side guarantees:
 * - Clerk has verified the signed-in email address;
 * - the invitation token is valid, unused, and unexpired;
 * - the signed-in email exactly matches the invited email;
 * - the redemption update is conditional, preventing double redemption.
 *
 * The global platform role is never changed here. Facility access remains
 * membership-based, with permission checks performed per request.
 */
export async function redeemStaffInvitation(
  user: User,
  token: string,
  reject = false,
): Promise<FacilityStaff> {
  const identity = await currentUser();

  const verifiedEmail = identity?.emailAddresses.find(
    (emailAddress) =>
      emailAddress.emailAddress.toLowerCase() ===
        user.email.toLowerCase() &&
      emailAddress.verification?.status === "verified",
  );

  if (!verifiedEmail) {
    throw forbidden(
      "Verify the invited email address before responding",
    );
  }

  if (!token?.trim()) {
    throw notFound("Invitation not found");
  }

  return prisma.$transaction(async (tx) => {
    const staff = await tx.facilityStaff.findFirst({
      where: {
        inviteToken: hashInviteToken(token.trim()),
      },
    });

    if (!staff) {
      throw notFound("Invitation not found");
    }

    const now = new Date();

    if (staff.inviteExpiresAt && staff.inviteExpiresAt <= now) {
      throw conflict("This invitation has expired");
    }

    if (staff.invitationState !== "PENDING_ACCEPTANCE") {
      throw conflict("This invitation is no longer pending");
    }

    if (staff.userId || staff.acceptedAt) {
      throw conflict("This invitation has already been used");
    }

    if (staff.status !== "INVITED") {
      throw forbidden("This invitation is no longer pending");
    }

    if (normaliseEmail(staff.email) !== normaliseEmail(user.email)) {
      throw forbidden(
        "This invitation was sent to a different email address. Sign in with the invited email.",
      );
    }

    const changed = await tx.facilityStaff.updateMany({
      where: {
        id: staff.id,
        inviteToken: staff.inviteToken,
        status: "INVITED",
        invitationState: "PENDING_ACCEPTANCE",
        userId: null,
        acceptedAt: null,
        inviteExpiresAt: { gt: now },
      },
      data: {
        userId: reject ? null : user.id,
        status: reject ? "TERMINATED" : "ACTIVE",
        invitationState: reject ? "REJECTED" : "ACCEPTED",
        acceptedAt: reject ? null : now,
        lastLoginAt: now,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    if (changed.count !== 1) {
      throw conflict(
        "This invitation has already been used or expired",
      );
    }

    await controlAudit(
      tx,
      user.id,
      staff.facilityId,
      reject
        ? "STAFF_INVITATION_REJECTED"
        : "STAFF_INVITATION_ACCEPTED",
      staff.id,
      {
        invitationEmail: staff.email,
      },
    );

    return tx.facilityStaff.findUniqueOrThrow({
      where: { id: staff.id },
    });
  });
}
