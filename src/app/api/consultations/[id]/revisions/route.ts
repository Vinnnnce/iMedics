import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { notFound } from "@/lib/errors";

// GET /api/consultations/[id]/revisions — the amendment history of a report,
// visible only to the doctor who wrote it. Each entry is the content as it
// stood before the amendment, with the reason the report was changed.
export const GET = withAuth<{ id: string }>(["DOCTOR"], async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const doctor = await getVerifiedDoctorProfile(user);

  const consultation = await prisma.consultation.findFirst({
    where: { id, doctorId: doctor.id },
    select: { id: true, revision: true, amendedAt: true },
  });
  if (!consultation) throw notFound("Consultation not found");

  const revisions = await prisma.consultationRevision.findMany({
    where: { consultationId: id },
    orderBy: { revision: "desc" },
    take: 50,
    select: { id: true, revision: true, reason: true, snapshot: true, createdAt: true },
  });
  return NextResponse.json({ current: consultation, revisions });
});
