import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { POLICY_RELEASE, policyCanBeAccepted } from "@/lib/legal/release";
import { recordPolicyReceipt } from "@/lib/legal/record";
import { conflict } from "@/lib/errors";

export const GET = withAuth(null, async (_req, { user }) => {
  const history = await prisma.policyReceipt.findMany({
    where: { userId: user.id }, include: { snapshot: true }, orderBy: { recordedAt: "desc" },
  });
  return NextResponse.json({ current: { version: POLICY_RELEASE.version, status: POLICY_RELEASE.status },
    requiresConsent: policyCanBeAccepted() && !history.some(item => item.version === POLICY_RELEASE.version && item.kind === "ACCEPTANCE"), history });
}, { allowOnboarding: true });

export const POST = withAuth(null, async (req, { user }) => {
  const body = await parseBody(req, z.object({ version: z.string(), accepted: z.literal(true) }));
  if (!policyCanBeAccepted()) throw conflict("This policy is a draft and cannot be accepted as a published agreement.");
  if (body.version !== POLICY_RELEASE.version) throw conflict("Policies changed. Review the current version before accepting.");
  await prisma.$transaction(async tx => {
    await recordPolicyReceipt(tx, user.id, user.accountType ?? user.role);
    await tx.user.update({ where: { id: user.id }, data: { termsVersion: POLICY_RELEASE.version, termsAcceptedAt: new Date() } });
  });
  return NextResponse.json({ success: true });
}, { allowOnboarding: true });
