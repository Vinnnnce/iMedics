import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden } from "@/lib/errors";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";
import { dueReminderStage, CREDENTIAL_REMINDER_STAGES } from "@/lib/facility-staff";

/**
 * POST /api/cron/credential-reminders
 *
 * Scheduled dispatcher (run daily from the platform scheduler, e.g. a cron
 * worker calling this endpoint with the CRON_SECRET header). Sends, at most
 * once per threshold, the 90/60/30/7-day expiry reminders and the expired
 * notice. Reminder state is stored on the credential row, so re-running the
 * job never duplicates notifications.
 *
 * Body may be empty; requires header `x-cron-secret` matching env CRON_SECRET.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw forbidden("Credential reminders are not configured");
  if (req.headers.get("x-cron-secret") !== secret) throw forbidden("Invalid cron secret");

  const now = new Date();
  let reminders = 0;
  let expiries = 0;

  // Expiring-soon credentials that have not yet received their threshold reminder.
  const due = await prisma.staffCredential.findMany({
    where: {
      expiryDate: { gte: now },
      staff: { status: "ACTIVE" },
    },
    select: { id: true, expiryDate: true, lastReminderStage: true, staffId: true, staff: { select: { userId: true, facility: { select: { userId: true } } } } },
    take: 500,
  });

  for (const credential of due) {
    const stage = dueReminderStage(credential);
    if (stage == null) continue;
    if (credential.lastReminderStage != null && credential.lastReminderStage <= stage) continue; // already reminded at this or a tighter threshold

    await prisma.$transaction([
      prisma.staffCredential.update({
        where: { id: credential.id },
        data: { lastReminderStage: stage, renewalStatus: "RENEWAL_DUE" },
      }),
    ]);
    await queueNotification(credential.staff.userId, { kind: "CREDENTIAL_EXPIRING", credentialId: credential.id });
    await queueNotification(credential.staff.facility.userId, { kind: "CREDENTIAL_EXPIRING", credentialId: credential.id });
    reminders += 1;
  }

  // Newly expired credentials: notify once (verificationStatus flips to a
  // marker so the next run does not repeat).
  const expired = await prisma.staffCredential.findMany({
    where: {
      expiryDate: { lt: now },
      renewalStatus: { not: "LAPSED" },
      staff: { status: "ACTIVE" },
    },
    select: { id: true, staffId: true, staff: { select: { userId: true, facility: { select: { userId: true } } } } },
    take: 500,
  });

  for (const credential of expired) {
    await prisma.staffCredential.update({
      where: { id: credential.id },
      data: { renewalStatus: "LAPSED" },
    });
    await queueNotification(credential.staff.userId, { kind: "CREDENTIAL_EXPIRED", credentialId: credential.id });
    await queueNotification(credential.staff.facility.userId, { kind: "CREDENTIAL_EXPIRED", credentialId: credential.id });
    expiries += 1;
  }

  await writeAudit({
    action: "CREDENTIAL_REMINDERS_DISPATCHED",
    resourceType: "StaffCredential",
    details: { reminders, expiries, stages: CREDENTIAL_REMINDER_STAGES, ranAt: now.toISOString() },
    req,
  });

  return NextResponse.json({ reminders, expiries, ranAt: now.toISOString() });
}

// GET returns the required configuration without running anything.
export async function GET(): Promise<Response> {
  if (!process.env.CRON_SECRET) throw badRequest("Credential reminders are not configured");
  return NextResponse.json({ ok: true, schedule: "daily" });
}
