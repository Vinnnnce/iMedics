import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, unauthorized } from "@/lib/admin-guard";

// GET /api/admin/users — list all users (admin session required)
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ users });
  } catch (error) {
    console.error("Admin list users error:", error);
    return Response.json({ error: "Failed to list users" }, { status: 500 });
  }
}

// PATCH /api/admin/users — update a user's status and/or role
// Body: { id, status?, role? }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const body = await req.json();
    const { id, status, role } = body as {
      id?: string;
      status?: string;
      role?: string;
    };

    if (!id) {
      return Response.json({ error: "User id is required" }, { status: 400 });
    }

    const validStatuses = ["active", "suspended", "banned"];
    const validRoles = ["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"];

    const data: { status?: string; role?: string } = {};
    // (values validated against validStatuses / validRoles below)
    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return Response.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = status;
    }
    if (role !== undefined) {
      if (!validRoles.includes(role)) {
        return Response.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
          { status: 400 }
        );
      }
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: "Nothing to update — provide status and/or role" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: data as { status?: string; role?: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN" },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    return Response.json({ success: true, user });
  } catch (error) {
    console.error("Admin update user error:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}
