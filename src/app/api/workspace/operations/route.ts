import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVerifiedFacilityProfile } from "@/lib/access";
import { badRequest, notFound } from "@/lib/errors";
import { extensionAudit } from "@/lib/workspace/extensions";
import { requestRefund } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { facilityBookingVisible } from "@/lib/facilities";

export const GET = withAuth(null, async (_req, { user }) => {
  await extensionAudit(user, "WORKSPACE_OPERATIONS_READ");
  const admin = user.role === "ADMIN";
  const disputes = admin
    ? await prisma.$queryRaw`SELECT id, payment_id, status, reason, resolution, created_at FROM workspace_disputes ORDER BY created_at DESC LIMIT 100`
    : await prisma.$queryRaw`SELECT id, payment_id, status, reason, resolution, created_at FROM workspace_disputes WHERE opened_by = ${user.id}::uuid ORDER BY created_at DESC LIMIT 100`;
  const subscriptions = admin
    ? await prisma.$queryRaw`SELECT s.id, s.owner_id, u.name, s.plan, s.status, s.renews_at FROM workspace_subscriptions s JOIN users u ON u.id = s.owner_id ORDER BY s.updated_at DESC LIMIT 100`
    : await prisma.$queryRaw`SELECT id, owner_id, plan, status, renews_at FROM workspace_subscriptions WHERE owner_id = ${user.id}::uuid`;
  const resources = user.role === "LAB_SCIENTIST" ? await prisma.$queryRaw`
    SELECT r.id, r.kind, r.name, r.capacity, r.active, COUNT(b.id)::int AS assignments,
    COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at)) / 3600),0)::float AS booked_hours
    FROM workspace_resources r LEFT JOIN workspace_resource_bookings b ON b.resource_id = r.id
    WHERE r.owner_id = ${user.id}::uuid GROUP BY r.id ORDER BY r.name` : [];
  const delivery = admin ? await prisma.$queryRaw`SELECT
    COUNT(*) FILTER (WHERE email_done AND push_done)::int AS completed,
    COUNT(*) FILTER (WHERE NOT (email_done AND push_done) AND attempts < 5)::int AS pending,
    COUNT(*) FILTER (WHERE NOT (email_done AND push_done) AND attempts >= 5)::int AS needs_review
    FROM workspace_delivery` : [];
  return Response.json({ disputes, subscriptions, resources, delivery }, { headers: { "Cache-Control": "private, no-store" } });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dispute"), paymentId: z.uuid(), reason: z.string().trim().min(10).max(2000) }),
  z.object({ action: z.literal("resolve"), id: z.uuid(), status: z.enum(["REVIEWING", "RESOLVED"]), resolution: z.string().trim().min(5).max(2000) }),
  z.object({ action: z.literal("subscription"), ownerId: z.uuid(), plan: z.string().trim().min(1).max(80), status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]), renewsAt: z.iso.datetime().optional() }),
  z.object({ action: z.literal("resource"), kind: z.enum(["STAFF", "ROOM"]), name: z.string().trim().min(1).max(100), capacity: z.number().int().min(1).max(100) }),
  z.object({ action: z.literal("assign"), resourceId: z.uuid(), bookingId: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }),
  z.object({ action: z.literal("unassign"), id: z.uuid() }),
  z.object({ action: z.literal("refund"), paymentId: z.uuid(), reason: z.string().trim().min(10).max(2000), confirm: z.literal(true) }),
]);
export const POST = withAuth(null, async (req, { user }) => {
  const b = await parseBody(req, schema);
  if (b.action === "dispute") {
    const payment = await prisma.payment.findFirst({ where: { id: b.paymentId, OR: [{ payerId: user.id }, { payeeId: user.id }] }, select: { id: true } });
    if (!payment) throw notFound("Payment not found");
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${b.paymentId}::uuid FOR UPDATE`;
      const existing = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM workspace_disputes WHERE payment_id = ${b.paymentId}::uuid AND opened_by = ${user.id}::uuid AND status IN ('OPEN', 'REVIEWING')`;
      if (existing.length) throw badRequest("An open dispute already exists for this payment");
      await tx.$executeRaw`INSERT INTO workspace_disputes(id, payment_id, opened_by, reason) VALUES(${randomUUID()}::uuid, ${b.paymentId}::uuid, ${user.id}::uuid, ${b.reason})`;
      await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_DISPUTE_OPENED", resourceType: "Payment", resourceId: b.paymentId } });
    });
    await queueNotification(user.id, { kind: "DISPUTE_UPDATED", paymentId: b.paymentId });
  } else if (b.action === "resource" || b.action === "assign" || b.action === "unassign") {
    if (user.role !== "LAB_SCIENTIST") throw notFound();
    const facility = await getVerifiedFacilityProfile(user);
    if (b.action === "unassign") {
      await prisma.$transaction(async tx => {
        const count = await tx.$executeRaw`DELETE FROM workspace_resource_bookings b USING workspace_resources r
          WHERE b.id = ${b.id}::uuid AND b.resource_id = r.id AND r.owner_id = ${user.id}::uuid`;
        if (!count) throw notFound("Allocation not found");
        await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_RESOURCE_UNASSIGNED", resourceType: "ResourceAllocation", resourceId: b.id } });
      });
    } else if (b.action === "resource") {
      await extensionAudit(user, "WORKSPACE_RESOURCE_CREATED");
      await prisma.$executeRaw`INSERT INTO workspace_resources(id, owner_id, kind, name, capacity) VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${b.kind}, ${b.name}, ${b.capacity})`;
    } else {
      if (Date.parse(b.endsAt) <= Date.parse(b.startsAt) || Date.parse(b.endsAt) - Date.parse(b.startsAt) > 7 * 86400000) throw badRequest("Choose an ordered allocation of up to seven days");
      const booking = await prisma.facilityBooking.findFirst({ where: { AND: [facilityBookingVisible, { id: b.bookingId, service: { facilityId: facility.id }, status: { in: ["REQUESTED", "CONFIRMED"] } }] }, select: { id: true } });
      if (!booking) throw notFound("Booking not found");
      await prisma.$transaction(async tx => {
        const resource = await tx.$queryRaw<{ capacity: number }[]>`SELECT capacity FROM workspace_resources WHERE id = ${b.resourceId}::uuid AND owner_id = ${user.id}::uuid AND active = true FOR UPDATE`;
        if (!resource[0]) throw notFound("Resource not found");
        const overlaps = await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM workspace_resource_bookings b WHERE resource_id = ${b.resourceId}::uuid AND starts_at < ${new Date(b.endsAt)} AND ends_at > ${new Date(b.startsAt)}
          AND EXISTS(SELECT 1 FROM facility_bookings f WHERE f.id = b.booking_id AND f.status <> 'CANCELLED')`;
        if (overlaps[0].count >= resource[0].capacity) throw badRequest("Resource capacity is already allocated in this interval");
        await tx.$executeRaw`INSERT INTO workspace_resource_bookings(id, resource_id, booking_id, starts_at, ends_at) VALUES(${randomUUID()}::uuid, ${b.resourceId}::uuid, ${b.bookingId}::uuid, ${new Date(b.startsAt)}, ${new Date(b.endsAt)})`;
        await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_RESOURCE_ASSIGNED", resourceType: "WorkspaceResource", resourceId: b.resourceId } });
      });
    }
  } else {
    if (user.role !== "ADMIN") throw notFound();
    if (b.action === "resolve") {
      const dispute = await prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<{ payment_id: string; opened_by: string }[]>`UPDATE workspace_disputes SET status = ${b.status}, resolution = ${b.resolution}, updated_at = now()
          WHERE id = ${b.id}::uuid AND status IN ('OPEN','REVIEWING') RETURNING payment_id, opened_by`;
        if (!rows[0]) throw notFound("Open dispute not found");
        await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_DISPUTE_UPDATED", resourceType: "PaymentDispute", resourceId: b.id, details: { status: b.status } } });
        return rows[0];
      });
      await queueNotification(dispute.opened_by, { kind: "DISPUTE_UPDATED", paymentId: dispute.payment_id });
    } else if (b.action === "subscription") {
      const owner = await prisma.user.findFirst({ where: { id: b.ownerId, deletedAt: null }, select: { id: true } });
      if (!owner) throw notFound("Account not found");
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`INSERT INTO workspace_subscriptions(id, owner_id, plan, status, renews_at) VALUES(${randomUUID()}::uuid, ${b.ownerId}::uuid, ${b.plan}, ${b.status}, ${b.renewsAt ? new Date(b.renewsAt) : null})
          ON CONFLICT(owner_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, renews_at = EXCLUDED.renews_at, updated_at = now()`;
        await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_SUBSCRIPTION_UPDATED", resourceType: "Subscription", resourceId: b.ownerId, details: { status: b.status } } });
      });
      await queueNotification(b.ownerId, { kind: "SUBSCRIPTION_UPDATED" });
    } else {
      const payment = await prisma.payment.findUnique({ where: { id: b.paymentId }, select: { id: true, status: true } });
      if (!payment) throw notFound("Payment not found");
      if (payment.status !== "SUCCESSFUL") throw badRequest("Only a successful payment can be refunded");
      await extensionAudit(user, "WORKSPACE_ADMIN_REFUND_REQUESTED", b.paymentId);
      await requestRefund(b.paymentId, b.reason);
    }
  }
  return Response.json({ success: true });
});
