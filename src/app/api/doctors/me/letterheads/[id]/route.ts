import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";
import { isSignatureKey, verifySignatureUpload } from "@/lib/letterhead-signature";

const signatureBlockSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(120).nullish(),
  registrationId: z.string().trim().max(80).nullish(),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isDefault: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(200).optional(),
  headerLines: z.array(z.string().trim().max(200)).max(5).optional(),
  addressLine: z.string().trim().max(300).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  contactEmail: z.string().email().max(120).nullish(),
  website: z.string().url().max(300).nullish(),
  registrationInfo: z.string().trim().max(300).nullish(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  footerText: z.string().trim().max(300).nullish(),
  logoUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Logo must be an https URL").nullish(),
  /** Private storage key returned by the signature-image upload endpoint; null removes the image. */
  signatureUrl: z.string().trim().max(500).refine((k) => k === "" || isSignatureKey(k), "Invalid signature image reference").nullish(),
  showQr: z.boolean().optional(),
  signatureBlocks: z.array(signatureBlockSchema).max(4).optional(),
});

async function loadOwnLetterhead(userId: string, id: string) {
  const letterhead = await prisma.letterheadProfile.findFirst({ where: { id, userId } });
  if (!letterhead) throw notFound("Letterhead not found");
  return letterhead;
}

// GET /api/doctors/me/letterheads/[id] — one of the doctor's own letterheads.
export const GET = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const letterhead = await loadOwnLetterhead(doctor.userId, parseId((await params).id));
  return NextResponse.json({ letterhead });
});

// PATCH /api/doctors/me/letterheads/[id] — update a personal letterhead.
// Promoting one to default demotes the doctor's other letterheads.
export const PATCH = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  const current = await loadOwnLetterhead(doctor.userId, id);
  const body = await parseBody(req, bodySchema);
  // The referenced image must already exist in storage and be a real PNG/JPEG.
  if (body.signatureUrl) await verifySignatureUpload(body.signatureUrl);
  const letterhead = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.letterheadProfile.updateMany({
        where: { userId: doctor.userId, id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.letterheadProfile.update({ where: { id }, data: { ...body, signatureUrl: body.signatureUrl === undefined ? undefined : body.signatureUrl || null } });
  });
  // Best effort: clean up a replaced signature image so private storage holds
  // no orphaned copies. A failure here never blocks the update.
  if (body.signatureUrl !== undefined && current.signatureUrl && current.signatureUrl !== body.signatureUrl) {
    try { await deleteObject(current.signatureUrl); } catch { /* already gone */ }
  }
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_LETTERHEAD_UPDATED", resourceType: "LetterheadProfile", resourceId: letterhead.id, req });
  return NextResponse.json({ letterhead });
});

// DELETE /api/doctors/me/letterheads/[id] — remove a personal letterhead. If the
// default is deleted, the oldest remaining letterhead becomes the default.
export const DELETE = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  const letterhead = await loadOwnLetterhead(doctor.userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.letterheadProfile.delete({ where: { id } });
    if (letterhead.isDefault) {
      const next = await tx.letterheadProfile.findFirst({ where: { userId: doctor.userId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.letterheadProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_LETTERHEAD_DELETED", resourceType: "LetterheadProfile", resourceId: letterhead.id, req });
  return NextResponse.json({ ok: true });
});
