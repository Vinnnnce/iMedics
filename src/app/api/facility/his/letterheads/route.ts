import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const signatureBlockSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(120).nullish(),
  registrationId: z.string().trim().max(80).nullish(),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).nullish(),
  isDefault: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(200),
  headerLines: z.array(z.string().trim().max(200)).max(5).default([]),
  addressLine: z.string().trim().max(300).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  contactEmail: z.string().email().max(120).nullish(),
  website: z.string().url().max(300).nullish(),
  /** Registration / accreditation identifiers printed on the letterhead. */
  registrationInfo: z.string().trim().max(300).nullish(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Brand color must be a #RRGGBB hex value").default("#0F766E"),
  footerText: z.string().trim().max(300).nullish(),
  logoUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Logo must be an https URL").nullish(),
  showQr: z.boolean().optional(),
  watermark: z.string().trim().max(60).nullish(),
  signatureBlocks: z.array(signatureBlockSchema).max(4).default([]),
});

// GET /api/facility/his/letterheads — the facility's approved letterheads.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const letterheads = await prisma.letterheadProfile.findMany({
    where: { facilityId: access.facility.id },
    orderBy: [{ department: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ letterheads });
});

// POST /api/facility/his/letterheads — create a letterhead profile. The first
// one created for a facility (or for a department) becomes its default.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const body = await parseBody(req, bodySchema);
  const letterhead = await prisma.$transaction(async (tx) => {
    const existing = await tx.letterheadProfile.findFirst({
      where: { facilityId: access.facility.id, department: body.department ?? null },
      select: { id: true },
    });
    const data = {
      ...body,
      department: body.department ?? null,
      isDefault: body.isDefault ?? !existing,
      createdById: user.id,
    };
    // Only one default per department; promoting this one demotes the others.
    if (data.isDefault) {
      await tx.letterheadProfile.updateMany({
        where: { facilityId: access.facility.id, department: body.department ?? null, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.letterheadProfile.create({ data: { ...data, facilityId: access.facility.id } });
  });
  await auditHis(access, "HIS_LETTERHEAD_CREATED", "LetterheadProfile", letterhead.id, req, {
    details: { name: letterhead.name, department: letterhead.department, isDefault: letterhead.isDefault },
  });
  return NextResponse.json({ letterhead }, { status: 201 });
});
