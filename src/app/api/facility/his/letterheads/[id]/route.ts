import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const signatureBlockSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(120).nullish(),
  registrationId: z.string().trim().max(80).nullish(),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  department: z.string().trim().max(120).nullish(),
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
  showQr: z.boolean().optional(),
  watermark: z.string().trim().max(60).nullish(),
  signatureBlocks: z.array(signatureBlockSchema).max(4).optional(),
});

async function loadLetterhead(facilityId: string, id: string) {
  const letterhead = await prisma.letterheadProfile.findFirst({ where: { id, facilityId } });
  if (!letterhead) throw notFound("Letterhead not found");
  return letterhead;
}

// GET /api/facility/his/letterheads/[id] — one letterhead profile.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const letterhead = await loadLetterhead(access.facility.id, parseId((await params).id));
  return NextResponse.json({ letterhead });
});

// PATCH /api/facility/his/letterheads/[id] — update a letterhead. Promoting it
// to default demotes the other letterheads in the same department.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const id = parseId((await params).id);
  await loadLetterhead(access.facility.id, id);
  const body = await parseBody(req, bodySchema);
  const letterhead = await prisma.$transaction(async (tx) => {
    const department = "department" in body ? body.department ?? null : undefined;
    if (body.isDefault) {
      await tx.letterheadProfile.updateMany({
        where: {
          facilityId: access.facility.id,
          id: { not: id },
          isDefault: true,
          ...(department !== undefined ? { department } : {}),
        },
        data: { isDefault: false },
      });
    }
    return tx.letterheadProfile.update({
      where: { id },
      data: {
        ...body,
        ...(department !== undefined ? { department } : {}),
      },
    });
  });
  await auditHis(access, "HIS_LETTERHEAD_UPDATED", "LetterheadProfile", letterhead.id, req, {
    details: { name: letterhead.name, department: letterhead.department, isDefault: letterhead.isDefault },
  });
  return NextResponse.json({ letterhead });
});

// DELETE /api/facility/his/letterheads/[id] — remove a letterhead. If the
// default letterhead is deleted, the next one for that department becomes default.
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const id = parseId((await params).id);
  const letterhead = await loadLetterhead(access.facility.id, id);
  await prisma.$transaction(async (tx) => {
    await tx.letterheadProfile.delete({ where: { id } });
    if (letterhead.isDefault) {
      const next = await tx.letterheadProfile.findFirst({
        where: { facilityId: access.facility.id, department: letterhead.department },
        orderBy: { createdAt: "asc" },
      });
      if (next) await tx.letterheadProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  await auditHis(access, "HIS_LETTERHEAD_DELETED", "LetterheadProfile", letterhead.id, req, {
    details: { name: letterhead.name, department: letterhead.department },
  });
  return NextResponse.json({ ok: true });
});
