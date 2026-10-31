import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";

// GET /api/facility/his/medication-orders/administrations?patientId= — the
// patient's MAR: every administration entry with its order context.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const patientId = new URL(req.url).searchParams.get("patientId") ?? "";
  if (!patientId) return NextResponse.json({ administrations: [] });
  await assertPatientLinked(access.facility.id, patientId);
  const administrations = await prisma.medicationAdministration.findMany({
    where: { facilityId: access.facility.id, patientId },
    orderBy: { administeredAt: "desc" },
    take: 200,
    include: {
      order: { select: { id: true, medicationName: true, strength: true, dose: true, route: true, frequency: true, status: true } },
    },
  });
  return NextResponse.json({ administrations });
});
