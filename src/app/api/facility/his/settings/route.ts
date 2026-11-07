import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const schema = z.object({
  displayName: z.string().trim().max(200).nullish(),
  letterheadLines: z.array(z.string().trim().max(200)).max(5).optional(),
  logoUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Logo must be an https URL").nullish(),
  addressLine: z.string().trim().max(300).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  contactEmail: z.string().email().max(120).nullish(),
  defaultLanguage: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"]).optional(),
  timeZone: z.string().max(60).optional(),
  documentNumberPrefix: z.string().regex(/^[A-Z0-9]{2,12}$/, "2–12 capital letters or digits").optional(),
  pageSize: z.enum(["A4", "LETTER", "A5"]).optional(),
  footerText: z.string().trim().max(300).nullish(),
  enabledModules: z.array(z.enum(["EMERGENCY", "INPATIENT", "OUTPATIENT", "SURGERY", "LABORATORY", "IMAGING", "PHARMACY", "INSURANCE", "REHABILITATION"])).optional(),
  terminology: z.record(z.string().max(40), z.string().max(60)).optional(),
  triageProtocol: z.string().trim().max(120).nullish(),
  triageCategories: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  overdueMinutes: z.number().int().min(5).max(1440).optional(),
  independentTemplateApproval: z.boolean().optional(),
  defaultRetentionCategory: z.string().trim().max(40).optional(),
});

// GET /api/facility/his/settings — hospital configuration and its revision history.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const settings = await prisma.hospitalSettings.findUnique({
    where: { facilityId: access.facility.id },
    include: { revisions: { orderBy: { version: "desc" }, take: 20, select: { version: true, createdAt: true, changedById: true } } },
  });
  return NextResponse.json({ settings });
});

// PUT /api/facility/his/settings — update configuration; every change is versioned.
export const PUT = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const data = await parseBody(req, schema);
  if (data.triageCategories?.length && !data.triageProtocol) {
    const existing = await prisma.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { triageProtocol: true } });
    if (!existing?.triageProtocol) data.triageCategories = [];
  }
  const settings = await prisma.$transaction(async (tx) => {
    const current = await tx.hospitalSettings.findUnique({ where: { facilityId: access.facility.id } });
    const saved = current
      ? await tx.hospitalSettings.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 }, updatedById: user.id } })
      : await tx.hospitalSettings.create({ data: { ...data, facilityId: access.facility.id, updatedById: user.id } });
    const { revisions: _ignored, ...snapshot } = { ...saved, revisions: undefined };
    void _ignored;
    await tx.hospitalSettingsRevision.create({ data: { settingsId: saved.id, version: saved.version, snapshot: JSON.parse(JSON.stringify(snapshot)), changedById: user.id } });
    return saved;
  });
  await auditHis(access, "HIS_SETTINGS_UPDATED", "HospitalSettings", settings.id, req, { details: { version: settings.version } });
  return NextResponse.json({ settings });
});
