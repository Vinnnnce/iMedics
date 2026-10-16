import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, conflict } from "@/lib/errors";
import { MAX_VERIFICATION_DOCUMENTS, confirmUploadSchema, verifyUpload } from "@/lib/uploads";
import { writeAudit } from "@/lib/audit";

// POST /api/me/documents/confirm — step 2: check the uploaded object and attach it to the profile.
export const POST = withAuth(null, async (req, { user }) => {
  const { key, mimeType } = await parseBody(req, confirmUploadSchema);
  if (!key.startsWith(`verification/${user.id}/`)) throw badRequest("Invalid upload key");

  const [doctor, lab] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { id: true, verificationStatus: true, documentKeys: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { id: true, verificationStatus: true, documentKeys: true } }),
  ]);
  const profile = doctor ?? lab;
  if (!profile) throw conflict("Complete your professional registration first");
  if (profile.verificationStatus === "VERIFIED") throw conflict("Your account is already verified");
  if (profile.documentKeys.includes(key)) throw conflict("This document is already attached");
  if (profile.documentKeys.length >= MAX_VERIFICATION_DOCUMENTS) throw conflict("Document limit reached");

  await verifyUpload(key, mimeType);

  if (doctor) {
    await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { documentKeys: { push: key } } });
  } else if (lab) {
    await prisma.labStaffProfile.update({ where: { id: lab.id }, data: { documentKeys: { push: key } } });
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "VERIFICATION_DOCUMENT_ADDED",
    resourceType: "User",
    resourceId: user.id,
    req,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}, { allowOnboarding: true });
