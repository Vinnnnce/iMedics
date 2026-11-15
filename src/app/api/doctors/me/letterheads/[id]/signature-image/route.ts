import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { readSignatureImageStream } from "@/lib/letterhead-signature";

// GET /api/doctors/me/letterheads/[id]/signature-image — stream the doctor's
// stored signature image. Private storage is never exposed publicly; only the
// owning doctor can read it.
export const GET = withAuth<{ id: string }>(["DOCTOR"], async (_req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  const letterhead = await prisma.letterheadProfile.findFirst({ where: { id, userId: doctor.userId }, select: { signatureUrl: true } });
  if (!letterhead) throw notFound("Letterhead not found");
  if (!letterhead.signatureUrl) throw notFound("No signature image on this letterhead");
  const { stream, contentType } = await readSignatureImageStream(letterhead.signatureUrl);
  if (!stream) throw notFound("Signature image not found");
  return new NextResponse(stream, {
    status: 200,
    headers: { "Content-Type": contentType ?? "application/octet-stream", "Cache-Control": "private, no-store" },
  });
});
