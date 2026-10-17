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
  return existing ?? provisionUser(userId, await currentUser());
});

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
