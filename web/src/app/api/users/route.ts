import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users?role=PATIENT — list users by role.
// Used by the doctor consultation report form to pick a patient.
// Protected by Clerk middleware in production (non-public API route).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");

    const validRoles = ["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"];
    const where = role && validRoles.includes(role) ? { role: role as any } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        dateOfBirth: true,
        sex: true,
      },
      orderBy: { name: "asc" },
      take: 200,
    });

    return Response.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    return Response.json({ error: "Failed to list users" }, { status: 500 });
  }
}
