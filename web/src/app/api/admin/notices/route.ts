import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, unauthorized } from "@/lib/admin-guard";

// GET /api/admin/notices — list notices (active ones also readable publicly)
export async function GET(req: NextRequest) {
  try {
    const admin = isAdminRequest(req);
    const notices = admin
      ? await prisma.notice.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.notice.findMany({
          where: { active: true },
          orderBy: { createdAt: "desc" },
        });
    return Response.json({ notices });
  } catch (error) {
    console.error("List notices error:", error);
    return Response.json({ error: "Failed to list notices" }, { status: 500 });
  }
}

// POST /api/admin/notices — publish a notice
// Body: { text }
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || !text.trim()) {
      return Response.json({ error: "Notice text is required" }, { status: 400 });
    }
    const notice = await prisma.notice.create({
      data: { text: text.trim() },
    });
    return Response.json({ success: true, notice }, { status: 201 });
  } catch (error) {
    console.error("Create notice error:", error);
    return Response.json({ error: "Failed to create notice" }, { status: 500 });
  }
}

// PATCH /api/admin/notices — toggle a notice active state
// Body: { id, active }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const { id, active } = (await req.json()) as { id?: string; active?: boolean };
    if (!id || typeof active !== "boolean") {
      return Response.json(
        { error: "Notice id and active boolean are required" },
        { status: 400 }
      );
    }
    const notice = await prisma.notice.update({
      where: { id },
      data: { active },
    });
    return Response.json({ success: true, notice });
  } catch (error) {
    console.error("Update notice error:", error);
    return Response.json({ error: "Failed to update notice" }, { status: 500 });
  }
}
