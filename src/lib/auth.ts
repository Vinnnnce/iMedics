import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma, type Role, type User } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError, forbidden, unauthorized } from "./errors";

/**
 * Authorization model
 * -------------------
 * Clerk proves WHO the caller is. WHAT they may do is decided only by the
 * `role` and `status` columns in our own database, which can be changed
 * exclusively by server code (admin routes). Client-writable Clerk metadata
 * (`unsafeMetadata`) is never trusted for authorization.
 *
 * New accounts are always PATIENT. Doctors and lab staff register as PATIENT
 * with a pending profile and are promoted by an admin after verification.
 * The very first admins are bootstrapped from the ADMIN_EMAILS env var, and
 * only when Clerk reports the email address as verified.
 */

const BLOCKED_STATUSES: ReadonlySet<string> = new Set(["SUSPENDED", "BANNED"]);
type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function bootstrapAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function provisionUser(clerkId: string, clerkUser: ClerkUser | null): Promise<User> {
  const primary = clerkUser?.primaryEmailAddress;
  if (!clerkUser || !primary) {
    throw new ApiError(400, "Your account has no email address");
  }
  const lastLoginAt = clerkUser.lastSignInAt === null ? null : new Date(clerkUser.lastSignInAt);

  const email = primary.emailAddress.toLowerCase();
  const isVerified = primary.verification?.status === "verified";
  const isAdmin = isVerified && bootstrapAdminEmails().has(email);
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email.split("@")[0];

  try {
    return await prisma.user.create({
      data: {
        clerkId,
        email,
        name,
        avatarUrl: clerkUser.imageUrl,
        lastLoginAt,
        role: isAdmin ? "ADMIN" : "PATIENT",
        onboardingComplete: isAdmin,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Another request may have provisioned this Clerk user after our initial lookup.
      const concurrentUser = await prisma.user.findUnique({ where: { clerkId } });
      if (concurrentUser) return concurrentUser;
    }

    throw error;
  }
}

/** The signed-in user's database record, or null when signed out. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  const user = existing ?? (await provisionUser(userId, await currentUser()));
  if (user) void touchLastActive(user.id);
  return user;
});

/**
 * Privacy-conscious inactivity signal: record that an authenticated user was
 * meaningfully active (a signed-in page view or API call). Throttled to one
 * write per user per 5 minutes; failures are ignored — monitoring must never
 * break requests.
 */
const LAST_ACTIVE_THROTTLE_MS = 5 * 60_000;
const lastActiveSeen = new Map<string, number>();
async function touchLastActive(userId: string): Promise<void> {
  const now = Date.now();
  const seen = lastActiveSeen.get(userId);
  if (seen && now - seen < LAST_ACTIVE_THROTTLE_MS) return;
  lastActiveSeen.set(userId, now);
  if (lastActiveSeen.size > 5000) lastActiveSeen.clear();
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } });
    recordPatientActivityIfAny(userId, new Date(now));
  } catch {
    /* non-critical */
  }
}

/** Resolve any open welfare alert for the patient behind a now-active user. */
async function recordPatientActivityIfAny(userId: string, at: Date): Promise<void> {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
    if (!patient) return;
    await prisma.welfareAlert.updateMany({
      where: { status: { in: ["PENDING", "SENT", "ESCALATED"] }, rule: { patientId: patient.id } },
      data: { status: "RESOLVED_NO_ACTION", resolvedAt: at },
    });
  } catch {
    /* non-critical */
  }
}

/** Require a signed-in, active user. Throws 401 / 403. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (user.deletedAt) throw forbidden("This account has been removed");
  if (BLOCKED_STATUSES.has(user.status)) throw forbidden("This account is suspended");
  return user;
}

/** Require a signed-in, active user holding one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}
