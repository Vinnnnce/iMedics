import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { provisionSubaccountForUser, savePayoutSettings } from "@/lib/subaccounts";
import { writeAudit } from "@/lib/audit";

const settingsSchema = z.object({
  businessName: z.string().min(2, "Enter the name the account is registered to").max(120),
  settlementBank: z.string().min(2, "Enter your bank").max(120),
  accountNumber: z.string().regex(/^[0-9]{6,20}$/, "Enter a valid account number"),
});

// GET /api/me/payout-settings — where a provider's earnings are settled.
export const GET = withAuth(null, async (req, { user }) => {
  const record = await prisma.providerSubaccount.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    settings: record
      ? {
          businessName: record.businessName,
          settlementBank: record.settlementBank,
          accountNumber: record.accountNumber,
          status: record.status,
          subaccountCode: record.subaccountCode,
          lastError: record.lastError,
        }
      : null,
  });
});

// PUT /api/me/payout-settings — a provider submits or updates their settlement details.
// The gateway subaccount is (re)created once the provider is verified and the details are complete;
// verified providers are provisioned immediately so they are never left stuck waiting for a retry.
export const PUT = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req, { user }) => {
  const data = await parseBody(req, settingsSchema);
  const record = await savePayoutSettings(user.id, data);
  let provisioning: Awaited<ReturnType<typeof provisionSubaccountForUser>> | null = null;
  try {
    provisioning = await provisionSubaccountForUser(user.id);
  } catch (error) {
    console.error(`Subaccount provisioning failed for user ${user.id}:`, error);
  }
  await writeAudit({ userId: user.id, actorRole: user.role, action: "PAYOUT_SETTINGS_UPDATED", resourceType: "ProviderSubaccount", resourceId: record.id, details: { bank: data.settlementBank, provisioning }, req });
  return NextResponse.json({
    settings: {
      businessName: record.businessName,
      settlementBank: record.settlementBank,
      accountNumber: record.accountNumber,
      status: record.status,
      subaccountCode: record.subaccountCode,
      lastError: record.lastError,
    },
  });
});
