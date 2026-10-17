import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { onboardingChecklist, providerTypeForAccountType } from "@/lib/providers/types";
import type { ProviderType } from "@prisma/client";

// GET /api/admin/providers — the provider verification workflow view: every professional account,
// their onboarding checklist, and the state of their gateway settlement subaccount.
export const GET = withAuth(["ADMIN"], async () => {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { role: "DOCTOR" },
        { role: "LAB_SCIENTIST" },
        { accountType: { in: ["DOCTOR", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      accountType: true,
      doctorProfile: {
        select: {
          verificationStatus: true,
          specialty: true,
          consultationFee: true,
          mdcnRegistrationNumber: true,
          subaccount: { select: { status: true, subaccountCode: true, lastError: true, settlementBank: true, accountNumber: true, businessName: true } },
        },
      },
      labStaffProfile: {
        select: {
          verificationStatus: true,
          laboratoryName: true,
          cacRegistrationNumber: true,
          facilityLicenseNumber: true,
          operatingHours: true,
          addressLine: true,
          subaccount: { select: { status: true, subaccountCode: true, lastError: true, settlementBank: true, accountNumber: true, businessName: true } },
          services: { where: { isActive: true }, select: { id: true } },
        },
      },
      verificationDocuments: { select: { id: true } },
    },
  });

  const providers = users
    .map((user) => {
      const doctor = user.doctorProfile;
      const facility = user.labStaffProfile;
      if (!doctor && !facility) return null;

      const providerType: ProviderType = doctor
        ? "DOCTOR"
        : (providerTypeForAccountType(user.accountType) ?? "LABORATORY");
      const checklist = onboardingChecklist(providerType, {
        name: user.name,
        email: user.email,
        phone: user.phone,
        mdcnRegistrationNumber: doctor?.mdcnRegistrationNumber ?? null,
        specialty: doctor?.specialty ?? null,
        consultationFee: doctor?.consultationFee,
        laboratoryName: facility?.laboratoryName ?? null,
        cacRegistrationNumber: facility?.cacRegistrationNumber ?? null,
        facilityLicenseNumber: facility?.facilityLicenseNumber ?? null,
        operatingHours: facility?.operatingHours ?? null,
        addressLine: facility?.addressLine ?? null,
        documentKeys: user.verificationDocuments.map((document) => document.id),
        serviceCount: facility?.services.length,
      });
      const subaccount = doctor?.subaccount ?? facility?.subaccount ?? null;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        accountStatus: user.status,
        providerType,
        verificationStatus: (doctor?.verificationStatus ?? facility?.verificationStatus) ?? null,
        missingRequirements: checklist.filter((item) => !item.met).map((item) => item.label),
        subaccount: subaccount
          ? {
              status: subaccount.status,
              subaccountCode: subaccount.subaccountCode,
              lastError: subaccount.lastError,
              settlementBank: subaccount.settlementBank,
              accountNumber: subaccount.accountNumber,
              businessName: subaccount.businessName,
            }
          : null,
      };
    })
    .filter((provider): provider is NonNullable<typeof provider> => provider !== null);

  return NextResponse.json({ providers });
});
