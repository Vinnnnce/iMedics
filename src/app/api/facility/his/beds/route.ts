import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";

// GET /api/facility/his/beds — bed board with current occupancy.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const url = new URL(req.url);
  const wardId = url.searchParams.get("wardId");
  const status = url.searchParams.get("status");

  const beds = await prisma.bed.findMany({
    where: {
      facilityId: access.facility.id,
      ...(wardId ? { wardId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ ward: { name: "asc" } }, { label: "asc" }],
    select: {
      id: true, label: true, status: true, isolationReason: true,
      cleanedAt: true, reservedUntil: true, notes: true,
      ward: { select: { id: true, name: true, genderPolicy: true } },
      currentAdmission: {
        select: {
          id: true, admissionDate: true, reason: true,
          patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
        },
      },
      reservedForAdmission: {
        select: {
          id: true, admissionDate: true,
          patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return NextResponse.json({ beds });
});
