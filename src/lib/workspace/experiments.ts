import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extensionsInstalled } from "./extensions";
import { experimentVariant } from "./intelligence";
export const EXPERIMENTS = ["homepage-cta", "dashboard-engagement"] as const;
/** Server-only conversion: an authenticated booking request after an opted-in exposure. */
export async function recordBookingConversion(user: User, bookingId: string, tx?: Prisma.TransactionClient) {
  if (!await extensionsInstalled()) return;
  const db = tx ?? prisma;
  await db.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
  for (const experiment of EXPERIMENTS) {
    const exposed = await db.$queryRaw<{ id: string }[]>`SELECT id FROM workspace_experiments
      WHERE owner_id = ${user.id}::uuid AND experiment = ${experiment} AND event = 'exposure'
      AND created_at > now() - interval '30 days' LIMIT 1`;
    if (!exposed.length) continue;
    await db.$executeRaw`INSERT INTO workspace_experiments(owner_id, experiment, variant, event)
      SELECT ${user.id}::uuid, ${experiment}, ${experimentVariant(user.id, experiment)}, 'conversion'
      WHERE NOT EXISTS(SELECT 1 FROM workspace_experiments WHERE owner_id = ${user.id}::uuid
        AND experiment = ${experiment} AND event = 'conversion' AND created_at::date = current_date)`;
  }
  await db.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "EXPERIMENT_BOOKING_CONVERSION_CHECKED", resourceType: "Appointment", resourceId: bookingId } });
}
