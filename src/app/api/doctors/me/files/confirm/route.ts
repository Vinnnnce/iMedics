import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { confirmUploadSchema, verifyUpload } from "@/lib/uploads";
import { writeAudit } from "@/lib/audit";

// POST /api/doctors/me/files/confirm — step 2: verify a finished upload and record it as the doctor's own file.
// The key prefix proves ownership: only keys this doctor was issued can be confirmed.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const { key, fileName, mimeType } = await parseBody(req, confirmUploadSchema);

  if (!key.startsWith(`doctor-files/${doctor.id}/`)) throw notFound("Upload not found");
  const { sizeBytes } = await verifyUpload(key, mimeType);

  const file = await prisma.doctorFile.create({
    data: { doctorId: doctor.id, storageKey: key, fileName, mimeType, sizeBytes },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_FILE_UPLOADED", resourceType: "DoctorFile", resourceId: file.id, req });
  return NextResponse.json({ file }, { status: 201 });
});
