import { PrismaClient } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

export async function getDbUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: {
      doctorProfile: true,
      labStaffProfile: true,
    },
  });

  if (!user) {
    // Auto-create user from Clerk on first visit
    const email = clerkUser.emailAddresses[0]?.emailAddress || "";
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";

    // Get role from Clerk metadata
    const role = ((clerkUser.publicMetadata as Record<string, unknown>)?.role as string) ||
      ((clerkUser.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

    user = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email,
        name,
        role: role as any,
        password: "",
      },
      include: {
        doctorProfile: true,
        labStaffProfile: true,
      },
    });
  }

  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const { sessionClaims } = await auth();
  const role = ((sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((sessionClaims?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  if (!allowedRoles.includes(role)) {
    throw new Error(`Access denied. Required role: ${allowedRoles.join(" or ")}`);
  }

  return role;
}

export { prisma };
