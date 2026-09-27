import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, unauthorized } from "@/lib/admin-guard";

// GET /api/admin/ads — list advertisements
export async function GET(req: NextRequest) {
  try {
    const admin = isAdminRequest(req);
    const ads = admin
      ? await prisma.ad.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.ad.findMany({
          where: { active: true },
          orderBy: { createdAt: "desc" },
        });
    return Response.json({ ads });
  } catch (error) {
    console.error("List ads error:", error);
    return Response.json({ error: "Failed to list ads" }, { status: 500 });
  }
}

// POST /api/admin/ads — publish an advertisement
// Body: { title, content, placement }
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const { title, content, placement } = (await req.json()) as {
      title?: string;
      content?: string;
      placement?: string;
    };
    if (!title?.trim() || !content?.trim()) {
      return Response.json(
        { error: "Ad title and content are required" },
        { status: 400 }
      );
    }
    const validPlacements = ["sidebar", "dashboard", "login"];
    const ad = await prisma.ad.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        placement: validPlacements.includes(placement || "")
          ? (placement as string)
          : "sidebar",
      },
    });
    return Response.json({ success: true, ad }, { status: 201 });
  } catch (error) {
    console.error("Create ad error:", error);
    return Response.json({ error: "Failed to create ad" }, { status: 500 });
  }
}

// PATCH /api/admin/ads — toggle an ad active state
// Body: { id, active }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const { id, active } = (await req.json()) as { id?: string; active?: boolean };
    if (!id || typeof active !== "boolean") {
      return Response.json(
        { error: "Ad id and active boolean are required" },
        { status: 400 }
      );
    }
    const ad = await prisma.ad.update({ where: { id }, data: { active } });
    return Response.json({ success: true, ad });
  } catch (error) {
    console.error("Update ad error:", error);
    return Response.json({ error: "Failed to update ad" }, { status: 500 });
  }
}
