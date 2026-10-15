import { prisma } from "./prisma";
import { notifyUsers } from "./notifications/service";

const HOUR = 3_600_000;

/**
 * Remind both sides of confirmed appointments 24 hours and 1 hour ahead. Each reminder is stamped on the
 * appointment before sending, so overlapping runs never send twice.
 */
export async function sendDueAppointmentReminders(now = new Date()) {
  let sent = 0;
  // Each reminder covers a band: the day-before reminder only goes to appointments more than 12 hours away,
  // so a booking made this morning for this afternoon gets just the 1-hour reminder.
  for (const [window, field, ahead, minAhead] of [
    ["24h", "reminder24hSentAt", 24 * HOUR, 12 * HOUR],
    ["1h", "reminder1hSentAt", HOUR, 0],
  ] as const) {
    const due = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        [field]: null,
        scheduledAt: { gt: new Date(now.getTime() + minAhead), lte: new Date(now.getTime() + ahead) },
      },
      select: { id: true, patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
      take: 200,
    });

    for (const a of due) {
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, [field]: null }, data: { [field]: now } });
      if (claimed.count === 0) continue;
      await notifyUsers([a.patient.userId, a.doctor.userId], { kind: "APPOINTMENT_REMINDER", appointmentId: a.id, window });
      sent += 1;
    }
  }
  return sent;
}
