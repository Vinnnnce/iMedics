import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { isSignatureKey, verifySignatureUpload } from "@/lib/letterhead-signature";

const signatureBlockSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(120).nullish(),
  registrationId: z.string().trim().max(80).nullish(),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  isDefault: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(200),
  headerLines: z.array(z.string().trim().max(200)).max(5).default([]),
  addressLine: z.string().trim().max(300).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  contactEmail: z.string().email().max(120).nullish(),
  website: z.string().url().max(300).nullish(),
  /** The doctor's own registration identifiers, printed on their letterhead. */
  registrationInfo: z.string().trim().max(300).nullish(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Brand color must be a #RRGGBB hex value").default("#0F766E"),
  footerText: z.string().trim().max(300).nullish(),
  logoUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Logo must be an https URL").nullish(),
  /** Private storage key returned by the signature-image upload endpoint. */
  signatureUrl: z.string().trim().max(500).refine((k) => k === "" || isSignatureKey(k), "Invalid signature image reference").nullish(),
  showQr: z.boolean().optional(),
  signatureBlocks: z.array(signatureBlockSchema).max(4).default([]),
});

// GET /api/doctors/me/letterheads — the signed-in doctor's personal letterheads,
// used for reports issued from an independent practice.
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const letterheads = await prisma.letterheadProfile.findMany({
    where: { userId: doctor.userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ letterheads });
});

// POST /api/doctors/me/letterheads — create a personal letterhead. The first
// one becomes the default; at most one default exists at a time.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const body = await parseBody(req, bodySchema);
  // The referenced image must already exist in storage and be a real PNG/JPEG.
  if (body.signatureUrl) await verifySignatureUpload(body.signatureUrl);
  const letterhead = await prisma.$transaction(async (tx) => {
    const existing = await tx.letterheadProfile.findFirst({ where: { userId: doctor.userId }, select: { id: true } });
    const data = { ...body, signatureUrl: body.signatureUrl || null, isDefault: body.isDefault ?? !existing, createdById: user.id };
    if (data.isDefault) {
      await tx.letterheadProfile.updateMany({ where: { userId: doctor.userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.letterheadProfile.create({ data: { ...data, userId: doctor.userId } });
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_LETTERHEAD_CREATED", resourceType: "LetterheadProfile", resourceId: letterhead.id, req });
  return NextResponse.json({ letterhead }, { status: 201 });
});
