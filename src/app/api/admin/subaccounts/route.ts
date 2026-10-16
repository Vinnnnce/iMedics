import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { provisionSubaccountForUser, retryFailedSubaccounts } from "@/lib/subaccounts";

// GET /api/admin/subaccounts — every provider subaccount and its provisioning state.
export const GET = withAuth(["ADMIN"], async () => {
  const records = await prisma.providerSubaccount.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      userId: true,
      provider: true,
      businessName: true,
      settlementBank: true,
      accountNumber: true,
      percentageCharge: true,
      subaccountCode: true,
      status: true,
      lastError: true,
      createdAt: true,
      user: { select: { name: true, email: true, doctorProfile: { select: { verificationStatus: true } }, labStaffProfile: { select: { verificationStatus: true } } } },
    },
  });
  return NextResponse.json({
    subaccounts: records.map((record) => ({
      ...record,
      percentageCharge: Number(record.percentageCharge),
      verificationStatus:
        record.user.doctorProfile?.verificationStatus ?? record.user.labStaffProfile?.verificationStatus ?? null,
      user: undefined,
      name: record.user.name,
      email: record.user.email,
    })),
  });
});

const retrySchema = z.object({ userId: z.string().uuid().optional() });

// POST /api/admin/subaccounts — retry provisioning (one provider, or every failed record).
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const { userId } = await parseBody(req, retrySchema);
  if (userId) {
    const status = await provisionSubaccountForUser(userId);
    await writeAudit({ userId: user.id, actorRole: user.role, action: "SUBACCOUNT_RETRY", resourceType: "ProviderSubaccount", resourceId: userId, details: { status }, req });
    return NextResponse.json({ retried: 1, status });
  }
  const fixed = await retryFailedSubaccounts();
  await writeAudit({ userId: user.id, actorRole: user.role, action: "SUBACCOUNT_RETRY_ALL", resourceType: "ProviderSubaccount", details: { fixed }, req });
  return NextResponse.json({ retried: fixed });
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().min(2).max(120),
  settlementBank: z.string().min(2).max(120),
  accountNumber: z.string().regex(/^[0-9]{6,20}$/, "Enter a valid account number"),
});

// PUT /api/admin/subaccounts — correct a provider's bank details before provisioning.
export const PUT = withAuth(["ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, updateSchema);
  const existing = await prisma.providerSubaccount.findUnique({ where: { userId: data.userId } });
  if (!existing) throw badRequest("No payout settings found for this provider");
  await prisma.providerSubaccount.update({
    where: { userId: data.userId },
    data: {
      businessName: data.businessName,
      settlementBank: data.settlementBank,
      accountNumber: data.accountNumber,
      subaccountCode: null,
      status: "PENDING",
      lastError: null,
    },
  });
  const status = await provisionSubaccountForUser(data.userId);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "SUBACCOUNT_DETAILS_UPDATED", resourceType: "ProviderSubaccount", resourceId: existing.id, details: { status }, req });
  return NextResponse.json({ status });
});
