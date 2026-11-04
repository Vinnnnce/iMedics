import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { createBreakGlassAccess, closeBreakGlassAccess, getStaffMembership } from "@/lib/staff-access";
import { auth } from "@clerk/nextjs/server";

const createSchema = z.object({
  patientId: z.string().uuid(),
  justification: z.string().min(20).max(2000),
  minutes: z.number().int().min(1).max(480).optional(),
});

/** Create (or return the live) break-glass grant for the caller. */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, null, req);
  const membership = await getStaffMembership(user, access.facility.id);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");

  const grant = await createBreakGlassAccess(
    membership,
    parsed.data.patientId,
    parsed.data.justification,
    parsed.data.minutes,
  );
  return NextResponse.json({ grant });
}

/** Close a break-glass grant early. */
export async function DELETE(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, null, req);
  const membership = await getStaffMembership(user, access.facility.id);

  const grantId = new URL(req.url).searchParams.get("id");
  if (!grantId) throw badRequest("id query parameter is required");
  const reason = new URL(req.url).searchParams.get("reason") ?? "Closed early";
  await closeBreakGlassAccess(membership, grantId, reason);
  return NextResponse.json({ ok: true });
}

/** Audit list of break-glass grants (MANAGE_STAFF or VIEW_AUDIT_LOG). */
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req);
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";

  const grants = await prisma.breakGlassAccess.findMany({
    where: {
      facilityId: access.facility.id,
      ...(mine ? { staffId: access.staffId } : {}),
    },
    orderBy: { grantedAt: "desc" },
    take: 100,
    select: {
      id: true,
      staffId: true,
      patientId: true,
      justification: true,
      grantedAt: true,
      expiresAt: true,
      closedAt: true,
      closedReason: true,
      staff: { select: { fullName: true, professionalTitle: true, facilityRole: true } },
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
    },
  });
  return NextResponse.json({ grants });
}
