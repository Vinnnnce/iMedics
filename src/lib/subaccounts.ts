import type { Prisma, ProviderType, SubaccountStatus, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { badRequest, notFound } from "./errors";
import { commissionPercentFor } from "./commissions";
import { getPaymentProvider } from "./payments/provider";
import { providerTypeForAccountType } from "./providers/types";

type Db = PrismaClient | Prisma.TransactionClient;

export interface PayoutSettings {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
}

/**
 * Save (or update) a provider's payout details. The record starts PENDING and is only sent to
 * the gateway once the provider is verified and the details are complete.
 */
export async function savePayoutSettings(userId: string, input: PayoutSettings, db: Db = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, accountType: true, doctorProfile: true, labStaffProfile: true },
  });
  if (!user) throw notFound("User not found");
  if (user.accountType === "PATIENT" || (!user.doctorProfile && !user.labStaffProfile)) {
    throw badRequest("Payout settings are only available to providers");
  }
  const providerType = providerTypeForAccountType(user.accountType) ?? (user.doctorProfile ? "DOCTOR" : "LABORATORY");

  return db.providerSubaccount.upsert({
    where: { userId },
    create: {
      userId,
      provider: providerType,
      doctorId: user.doctorProfile?.id ?? null,
      facilityId: user.labStaffProfile?.id ?? null,
      businessName: input.businessName,
      settlementBank: input.settlementBank,
      accountNumber: input.accountNumber,
      status: "PENDING",
    },
    update: {
      businessName: input.businessName,
      settlementBank: input.settlementBank,
      accountNumber: input.accountNumber,
      // Details changed: the previous gateway subaccount is no longer valid, so a fresh one
      // is provisioned on the next attempt (verification, admin retry or the scheduled job).
      subaccountCode: null,
      status: "PENDING",
      lastError: null,
    },
  });
}

/**
 * Create the gateway subaccount for a verified provider. Called right after admin
 * verification, and retried from the admin screen or the scheduled job. Idempotent:
 * a provider whose subaccount already exists keeps it.
 */
export async function provisionSubaccountForUser(userId: string, db: Db = prisma): Promise<SubaccountStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      status: true,
      accountType: true,
      doctorProfile: { select: { id: true, verificationStatus: true } },
      labStaffProfile: { select: { id: true, verificationStatus: true, laboratoryName: true } },
      providerSubaccount: true,
    },
  });
  if (!user) throw notFound("User not found");

  const providerType = user.doctorProfile ? ("DOCTOR" as ProviderType) : providerTypeForAccountType(user.accountType);
  if (!providerType) return "FAILED";

  const verified =
    user.doctorProfile?.verificationStatus === "VERIFIED" || user.labStaffProfile?.verificationStatus === "VERIFIED";
  if (!verified) return "PENDING"; // not verified yet: nothing to do

  const record = await db.providerSubaccount.upsert({
    where: { userId },
    create: {
      userId,
      provider: providerType,
      doctorId: user.doctorProfile?.id ?? null,
      facilityId: user.labStaffProfile?.id ?? null,
      businessName: user.labStaffProfile?.laboratoryName || user.name,
      settlementBank: "",
      accountNumber: "",
      status: "PENDING",
    },
    update: {},
  });

  // Already created: keep the gateway code.
  if (record.subaccountCode) {
    return db.providerSubaccount
      .update({ where: { id: record.id }, data: { status: "CREATED" }, select: { status: true } })
      .then((r) => r.status);
  }

  if (!record.settlementBank || !record.accountNumber) {
    await db.providerSubaccount.update({
      where: { id: record.id },
      data: { status: "PENDING", lastError: "Waiting for the provider's bank details" },
    });
    return "PENDING";
  }

  try {
    const provider = getPaymentProvider();
    if (!provider.createSubaccount) throw new Error("This gateway does not support subaccounts");
    const percent = await commissionPercentFor(
      providerType,
      db,
      user.labStaffProfile?.id ?? null,
    );
    const { code } = await provider.createSubaccount({
      businessName: record.businessName,
      settlementBank: record.settlementBank,
      accountNumber: record.accountNumber,
      percentageCharge: percent,
    });
    await db.providerSubaccount.update({
      where: { id: record.id },
      data: { subaccountCode: code, status: "CREATED", lastError: null },
    });
    return "CREATED";
  } catch (error) {
    await db.providerSubaccount.update({
      where: { id: record.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" },
    });
    return "FAILED";
  }
}

/** The gateway subaccount code to route a provider's charges through, or null for platform-owned charges. */
export async function activeSubaccountCodeForUser(userId: string, db: Db = prisma): Promise<string | null> {
  const record = await db.providerSubaccount.findUnique({ where: { userId }, select: { subaccountCode: true, status: true } });
  if (!record?.subaccountCode) return null;
  return record.subaccountCode;
}

/** The provider's live subaccount code and its configured commission percentage, when provisioned. */
export async function activeSubaccountForUser(
  userId: string,
  db: Db = prisma,
): Promise<{ subaccountCode: string; percentageCharge: number } | null> {
  const record = await db.providerSubaccount.findUnique({
    where: { userId },
    select: { subaccountCode: true, percentageCharge: true, status: true },
  });
  // Only a provisioned subaccount (a code the gateway actually issued) can receive charges.
  if (!record?.subaccountCode || record.status === "PENDING" || record.status === "FAILED") return null;
  return { subaccountCode: record.subaccountCode, percentageCharge: Number(record.percentageCharge) };
}

/** Retry every FAILED subaccount provisioning (called by the scheduled job). */
export async function retryFailedSubaccounts(): Promise<number> {
  const failed = await prisma.providerSubaccount.findMany({ where: { status: "FAILED" }, select: { userId: true }, take: 50 });
  let fixed = 0;
  for (const record of failed) {
    const status = await provisionSubaccountForUser(record.userId);
    if (status === "CREATED") fixed += 1;
  }
  return fixed;
}

/** Keep a provider's gateway subaccount commission in step with the active commission rule. */
export async function syncSubaccountCharges(providerType: ProviderType, facilityId: string | null): Promise<void> {
  const percent = await commissionPercentFor(providerType, prisma, facilityId);
  const provider = getPaymentProvider();
  if (!provider.updateSubaccountCharge) return;

  // When a type default changes, only providers whose facility has no override of its own
  // (an active rule of any kind) follow it.
  let where: Prisma.ProviderSubaccountWhereInput = { provider: providerType, subaccountCode: { not: null } };
  if (facilityId) {
    where = { ...where, facilityId };
  } else {
    where = {
      ...where,
      OR: [
        { facilityId: null },
        { facility: { commissionRules: { none: { active: true } } } },
      ],
    };
  }

  const records = await prisma.providerSubaccount.findMany({ where, select: { subaccountCode: true } });
  for (const record of records) {
    if (!record.subaccountCode) continue;
    try {
      await provider.updateSubaccountCharge(record.subaccountCode, percent);
    } catch (error) {
      console.error(`Could not sync subaccount ${record.subaccountCode}:`, error);
    }
  }
}
