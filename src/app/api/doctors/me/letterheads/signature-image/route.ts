import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { presignSignatureUpload } from "@/lib/letterhead-signature";

const bodySchema = z.object({
  mimeType: z.enum(["image/png", "image/jpeg"]),
  sizeBytes: z.number().int().min(1).max(2 * 1024 * 1024),
});

// POST /api/doctors/me/letterheads/signature-image — presign an upload slot for
// the doctor's handwritten signature. The browser PUTs the image to the
// presigned URL, then attaches the returned key to a letterhead (PATCH), which
// verifies the stored content before it is accepted.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  await getVerifiedDoctorProfile(user);
  const body = await parseBody(req, bodySchema);
  const presigned = await presignSignatureUpload(body.mimeType, body.sizeBytes);
  return NextResponse.json(presigned, { status: 200 });
});
