// Credential monitoring service
// Path: src/lib/services/credential-monitor.ts

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";

export async function checkCredentialExpiry() {
  const now = new Date();

  // Check for credentials expiring in 90 days, 30 days, and 7 days
  const expiryThresholds = [
    { days: 7, template: "credential-expiring" as const },
    { days: 30, template: "credential-expiring" as const },
    { days: 90, template: "credential-expiring" as const },
  ];

  for (const threshold of expiryThresholds) {
    const targetDate = new Date(now.getTime() + threshold.days * 24 * 60 * 60 * 1000);

    const expiringCredentials = await prisma.staffCredential.findMany({
      where: {
        expiryDate: {
          gte: new Date(now.getTime() + (threshold.days - 1) * 24 * 60 * 60 * 1000),
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
        },
        verificationStatus: "VERIFIED",
        staff: {
          status: "ACTIVE",
        },
      },
      include: {
        staff: true,
      },
    });

    for (const credential of expiringCredentials) {
      if (!credential.expiryDate) continue;

      const daysRemaining = Math.floor(
        (credential.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send alert email
      await sendEmail({
        to: credential.staff.email,
        subject: `Your ${credential.type} credential expires in ${daysRemaining} days`,
        text: `Hello ${credential.staff.fullName},\n\nYour ${credential.type} credential expires on ${credential.expiryDate.toLocaleDateString()} (${daysRemaining} days remaining).\n\nPlease renew your credentials to maintain access.`,
        html: `<p>Hello ${credential.staff.fullName},</p><p>Your ${credential.type} credential expires on ${credential.expiryDate.toLocaleDateString()} (${daysRemaining} days remaining).</p><p>Please renew your credentials to maintain access.</p>`,
      });

      // Log the alert
      console.log(
        `Credential expiry alert sent: ${credential.staff.fullName} - ${credential.type} expires in ${daysRemaining} days`
      );
    }
  }
}

export async function checkExpiredCredentials() {
  const now = new Date();

  // Find all expired credentials
  const expiredCredentials = await prisma.staffCredential.findMany({
    where: {
      expiryDate: { lt: now },
      verificationStatus: "VERIFIED",
    },
    include: {
      staff: true,
    },
  });

  // Update staff status based on expired credentials
  for (const credential of expiredCredentials) {
    const staff = credential.staff;

    // Check if staff has any valid credentials
    const validCredentials = await prisma.staffCredential.findMany({
      where: {
        staffId: staff.id,
        expiryDate: { gte: now },
        verificationStatus: "VERIFIED",
      },
    });

    // If no valid credentials, suspend the staff
    if (validCredentials.length === 0) {
      await prisma.facilityStaff.update({
        where: { id: staff.id },
        data: { status: "SUSPENDED" },
      });

      // Send suspension email
      await sendEmail({
        to: staff.email,
        subject: "Your laboratory access has been suspended",
        text: `Hello ${staff.fullName},\n\nYour account has been suspended due to expired credentials. Please renew your credentials to restore access.`,
        html: `<p>Hello ${staff.fullName},</p><p>Your account has been suspended due to expired credentials. Please renew your credentials to restore access.</p>`,
      });

      console.log(
        `Staff account suspended: ${staff.fullName} - all credentials expired`
      );
    }
  }
}

// Scheduled job runner (can be triggered via API or cron)
export async function runCredentialMonitoring() {
  try {
    console.log("Starting credential monitoring...");
    await checkCredentialExpiry();
    await checkExpiredCredentials();
    console.log("Credential monitoring completed");
  } catch (error) {
    console.error("Credential monitoring error:", error);
    throw error;
  }
}
