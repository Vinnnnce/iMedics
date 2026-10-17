import { prisma } from "../prisma";
import { queueNotification } from "../notifications/service";

/** Tell every active administrator that a professional application is waiting. Await it from a route handler. */
export async function notifyAdminsOfApplication(applicantId: string, resubmitted: boolean): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true } });
  for (const admin of admins) queueNotification(admin.id, { kind: "VERIFICATION_SUBMITTED", applicantId, resubmitted });
}
