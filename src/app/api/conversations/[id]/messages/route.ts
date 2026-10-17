import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, parseQuery } from "@/lib/api";
import { assertCanSend, findConversation } from "@/lib/chat";
import { queueNotification } from "@/lib/notifications/service";
import { requireEntitlement } from "@/lib/subscriptions";

const listSchema = z.object({
  after: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/conversations/[id]/messages — the latest messages, or only those after `after` (for polling).
// Opening a conversation marks the other person's messages as read.
export const GET = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  await findConversation(user, id);
  const { after, limit } = parseQuery(req, listSchema);
  await prisma.auditLog.create({ data: {
    userId: user.id, actorRole: user.role, action: "MESSAGES_READ",
    resourceType: "Conversation", resourceId: id,
  } });

  const rows = after
    ? await prisma.chatMessage.findMany({ where: { conversationId: id, createdAt: { gt: after } }, orderBy: { createdAt: "asc" }, take: limit })
    : (await prisma.chatMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, take: limit })).reverse();

  await prisma.chatMessage.updateMany({
    where: { conversationId: id, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      mine: m.senderId === user.id,
      type: m.type,
      body: m.body,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
  });
});

const sendSchema = z.object({ body: z.string().trim().min(1, "Message cannot be empty").max(4000) });

// POST /api/conversations/[id]/messages — send a text message
export const POST = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  // Patient chat is a subscription-gated feature for doctors, enforced on every message.
  if (user.role === "DOCTOR") await requireEntitlement(user.id, "chat");
  const conversation = await findConversation(user, id);
  await assertCanSend(conversation);
  const { body } = await parseBody(req, sendSchema);

  const message = await prisma.chatMessage.create({
    data: { conversationId: id, senderId: user.id, body },
  });

  // Tell the other participant (the text itself is never included). Rapid-fire messages are coalesced.
  const participants = await prisma.conversation.findUnique({
    where: { id },
    select: { patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
  });
  const recipient = participants && (participants.patient.userId === user.id ? participants.doctor.userId : participants.patient.userId);
  await queueNotification(recipient, { kind: "MESSAGE_RECEIVED", conversationId: id });

  return NextResponse.json(
    { message: { id: message.id, mine: true, type: message.type, body: message.body, createdAt: message.createdAt, readAt: null } },
    { status: 201 },
  );
});
