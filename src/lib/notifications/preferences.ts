import type { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "../prisma";

/** Categories a user can configure. SYSTEM messages (security, account) are always delivered. */
export const CONFIGURABLE_CATEGORIES = ["APPOINTMENT", "MESSAGE", "PAYMENT", "LAB_RESULT", "PRESCRIPTION"] as const satisfies readonly NotificationType[];
export const CHANNELS = ["IN_APP", "EMAIL", "PUSH"] as const satisfies readonly NotificationChannel[];

export type PreferenceMatrix = Record<(typeof CONFIGURABLE_CATEGORIES)[number], Record<(typeof CHANNELS)[number], boolean>>;

/** Everything is on until the user turns it off. */
function defaults(): PreferenceMatrix {
  const matrix = {} as PreferenceMatrix;
  for (const category of CONFIGURABLE_CATEGORIES) {
    matrix[category] = { IN_APP: true, EMAIL: true, PUSH: true };
  }
  return matrix;
}

export async function getPreferenceMatrix(userId: string): Promise<PreferenceMatrix> {
  const rows = await prisma.notificationPreference.findMany({ where: { userId }, select: { category: true, channel: true, enabled: true } });
  const matrix = defaults();
  for (const row of rows) {
    if ((CONFIGURABLE_CATEGORIES as readonly string[]).includes(row.category)) {
      matrix[row.category as keyof PreferenceMatrix][row.channel] = row.enabled;
    }
  }
  return matrix;
}

export function isChannelEnabled(matrix: PreferenceMatrix, category: NotificationType, channel: NotificationChannel): boolean {
  if (!(category in matrix)) return true; // SYSTEM and anything unconfigurable
  return matrix[category as keyof PreferenceMatrix][channel];
}

export async function savePreferences(userId: string, matrix: Partial<PreferenceMatrix>): Promise<void> {
  const writes = [];
  for (const category of CONFIGURABLE_CATEGORIES) {
    const channels = matrix[category];
    if (!channels) continue;
    for (const channel of CHANNELS) {
      const enabled = channels[channel];
      if (typeof enabled !== "boolean") continue;
      writes.push(
        prisma.notificationPreference.upsert({
          where: { userId_category_channel: { userId, category, channel } },
          create: { userId, category, channel, enabled },
          update: { enabled },
        }),
      );
    }
  }
  await prisma.$transaction(writes);
}
