import { NextResponse } from "next/server";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { adminTicketUpdateSchema, isClosedStatus, slaDueAt } from "@/lib/support";

const listQuery = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

// GET /api/admin/support/tickets — newest urgent work first (admin only)
export const GET = withAuth(["ADMIN"], async (req) => {
  const { status, take } = parseQuery(req, listQuery);
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take,
    include: { events: { orderBy: { createdAt: "asc" }, take: 30 } },
  });
  return NextResponse.json({ tickets });
});

// PATCH /api/admin/support/tickets — assign, change status or priority, add an internal note
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const input = await parseBody(req, adminTicketUpdateSchema);
  const existing = await prisma.supportTicket.findUnique({ where: { id: input.id } });
  if (!existing) throw notFound("Ticket not found");

  const now = new Date();
  const events: { kind: string; fromValue?: string; toValue?: string; body?: string }[] = [];
  const data: Record<string, unknown> = {};
  if (input.status && input.status !== existing.status) {
    data.status = input.status;
    events.push({ kind: "STATUS_CHANGED", fromValue: existing.status, toValue: input.status });
    if (isClosedStatus(input.status)) data.resolvedAt = now;
    else if (existing.resolvedAt) data.resolvedAt = null;
  }
  if (input.priority && input.priority !== existing.priority) {
    data.priority = input.priority;
    data.slaDueAt = existing.firstResponseAt ? existing.slaDueAt : slaDueAt(input.priority, existing.createdAt);
    events.push({ kind: "PRIORITY_CHANGED", fromValue: existing.priority, toValue: input.priority });
  }
  if (input.assignToMe && existing.assignedToId !== user.id) {
    data.assignedToId = user.id;
    events.push({ kind: "ASSIGNED", fromValue: existing.assignedToId ?? undefined, toValue: user.id });
  }
  if (input.note) events.push({ kind: "NOTE", body: input.note });
  // The first real action stops the response-time clock.
  if (!existing.firstResponseAt && events.some((e) => e.kind !== "PRIORITY_CHANGED")) data.firstResponseAt = now;

  const ticket = await prisma.supportTicket.update({
    where: { id: input.id },
    data: { ...data, events: { create: events.map((e) => ({ ...e, actorUserId: user.id })) } },
    include: { events: { orderBy: { createdAt: "asc" }, take: 30 } },
  });
  await writeAudit({
    userId: user.id, actorRole: user.role, action: "SUPPORT_TICKET_UPDATED", resourceType: "SupportTicket", resourceId: input.id,
    details: { changes: events.map((e) => e.kind) }, req,
  });
  return NextResponse.json({ success: true, ticket });
});
