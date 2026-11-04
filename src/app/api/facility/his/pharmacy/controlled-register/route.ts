import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireHisAccess } from "@/lib/his/access";

// GET /api/facility/his/pharmacy/controlled-register — legally required
// controlled-substance register (receipts, dispenses, destructions, adjustments).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const url = new URL(req.url);
  const medication = url.searchParams.get("medication");

  const events = await prisma.controlledSubstanceEvent.findMany({
    where: {
      facilityId: access.facility.id,
      ...(medication ? { medicationName: { contains: medication, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, medicationName: true, eventType: true, quantity: true, unit: true,
      patientId: true, reference: true, notes: true, createdAt: true,
      staff: { select: { name: true } },
      patient: { select: { caseNumber: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ events });
});
