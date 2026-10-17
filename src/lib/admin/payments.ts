import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { optional, pageSchema } from "./params";
import { conflict, notFound } from "../errors";
import { requestRefund } from "../payments/service";
import { queueNotification } from "../notifications/service";
import { writeAudit } from "../audit";

export const PAYMENT_PAGE_SIZE = 25;

export const paymentFilterSchema = z.object({
  q: optional(z.string().trim().max(100)),
  status: optional(z.enum(["PENDING", "SUCCESSFUL", "FAILED", "REFUND_PENDING", "REFUNDED", "CANCELLED"])),
  kind: optional(z.enum(["CONSULTATION", "FACILITY_SERVICE"])),
  from: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  page: pageSchema,
});
export type PaymentFilters = z.infer<typeof paymentFilterSchema>;

function buildWhere(f: PaymentFilters): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { providerReference: { contains: f.q, mode: "insensitive" } },
        { receiptNumber: { contains: f.q, mode: "insensitive" } },
        { payer: { name: { contains: f.q, mode: "insensitive" } } },
        { payer: { email: { contains: f.q, mode: "insensitive" } } },
        { payee: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.status) and.push({ status: f.status });
  if (f.kind) and.push({ kind: f.kind });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
  if (f.to) and.push({ createdAt: { lt: new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000) } });
  return and.length ? { AND: and } : {};
}

const rowSelect = {
  id: true, kind: true, description: true, amount: true, currency: true, method: true, status: true,
  receiptNumber: true, providerReference: true, createdAt: true, paidAt: true,
  payer: { select: { id: true, name: true } },
  payee: { select: { id: true, name: true } },
} satisfies Prisma.PaymentSelect;

export async function listPayments(filters: PaymentFilters, options: { all?: boolean } = {}) {
  const where = buildWhere(filters);
  const paging: { skip?: number; take: number } = options.all ? { take: 5000 } : { skip: (filters.page - 1) * PAYMENT_PAGE_SIZE, take: PAYMENT_PAGE_SIZE };
  const [total, rows, totals] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, select: rowSelect, ...paging }),
    prisma.payment.groupBy({ by: ["currency", "status"], where, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAYMENT_PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    totals: totals.map((t) => ({ currency: t.currency, status: t.status, amount: Number(t._sum.amount ?? 0), count: t._count._all })),
  };
}

export async function getPaymentDetail(id: string) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      ...rowSelect, failureReason: true, expiresAt: true, refundedAt: true, provider: true, appointmentId: true, facilityBookingId: true,
      payer: { select: { id: true, name: true, email: true } },
      payee: { select: { id: true, name: true, email: true } },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, type: true, createdAt: true } },
    },
  });
  return payment && { ...payment, amount: Number(payment.amount) };
}

/**
 * Refund a successful payment in full on an administrator's say-so (for example after a dispute). An appointment
 * or service booking that has not happened yet is cancelled with it, so nobody is left holding a paid-for slot.
 */
export async function adminRefund(admin: { id: string; role: "ADMIN" }, paymentId: string, reason: string, req?: Request) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, status: true, appointmentId: true, facilityBookingId: true, payeeId: true } });
  if (!payment) throw notFound("Payment not found");
  if (payment.status !== "SUCCESSFUL") throw conflict("Only a successful payment can be refunded");

  if (payment.appointmentId) {
    const cancelled = await prisma.appointment.updateMany({ where: { id: payment.appointmentId, status: { in: ["BOOKED", "CONFIRMED"] } }, data: { status: "CANCELLED" } });
    if (cancelled.count > 0) queueNotification(payment.payeeId, { kind: "APPOINTMENT_CANCELLED", appointmentId: payment.appointmentId });
  }
  if (payment.facilityBookingId) {
    await prisma.facilityBooking.updateMany({ where: { id: payment.facilityBookingId, status: { in: ["REQUESTED", "CONFIRMED"] } }, data: { status: "CANCELLED" } });
  }

  await requestRefund(paymentId, `Refunded by an administrator: ${reason}`);
  await writeAudit({ userId: admin.id, actorRole: "ADMIN", action: "ADMIN_REFUND", resourceType: "Payment", resourceId: paymentId, details: { reason }, req });
}
