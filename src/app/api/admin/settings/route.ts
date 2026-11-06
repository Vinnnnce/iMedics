import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { forbidden } from "@/lib/errors";

/**
 * Global platform settings (branding, defaults, retention, limits). Values are
 * stored as JSON and every change is audited with before/after values. Keys in
 * the protected list can only be changed by the Super Admin because they alter
 * security-relevant behaviour.
 */

const PROTECTED_KEYS = ["security.passwordMinLength", "security.sessionTimeoutMinutes", "security.loginAttemptLimit", "security.mfaRequiredForAdmins", "privacy.dataRetentionDays", "privacy.exportRequiresApproval", "backup.reference", "release.approved"] as const;

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "SETTINGS", "VIEW");
  const settings = await prisma.platformSetting.findMany({ orderBy: { key: "asc" }, select: { key: true, value: true, description: true, updatedAt: true, updatedBy: { select: { name: true } } } });
  return NextResponse.json({ settings, protectedKeys: PROTECTED_KEYS });
});

const schema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,4}$/, "Keys look like section.name"),
  value: z.unknown(),
  description: z.string().trim().max(300).default(""),
});

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  await requireAdminPermission(user, "SETTINGS", "CONFIGURE");
  const access = await requireAdminPermission(user, "SETTINGS", "CONFIGURE");
  if ((PROTECTED_KEYS as readonly string[]).includes(body.key) && !access.superAdmin) {
    throw forbidden("Security and privacy settings can only be changed by the Super Admin.");
  }
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    const before = await tx.platformSetting.findUnique({ where: { key: body.key } });
    const setting = await tx.platformSetting.upsert({
      where: { key: body.key },
      create: { key: body.key, value: body.value as object, description: body.description, updatedById: user.id },
      update: { value: body.value as object, description: body.description, updatedById: user.id },
    });
    await controlAudit(tx, user.id, null, "PLATFORM_SETTING_CHANGED", setting.key, { before: before?.value ?? null, after: setting.value, description: setting.description });
    return setting;
  }) }, { status: 201 });
});
