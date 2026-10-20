import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, parseQuery } from "@/lib/api";
import { assertCanSend, findConversation, CHAT_IMAGE_MIME_TYPES } from "@/lib/chat";
import { verifyUpload } from "@/lib/uploads";
import { queueNotification } from "@/lib/notifications/service";

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
      attachmentKey: m.attachmentKey,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
  });
});

const sendSchema = z
  .object({
    body: z.string().trim().max(4000),
    image: z
      .object({
        key: z.string().min(1).max(300),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.enum(CHAT_IMAGE_MIME_TYPES, { error: "Only PNG, JPEG or WebP images can be sent" }),
      })
      .optional(),
  })
  .refine((value) => value.image !== undefined || value.body.length > 0, {
    message: "Message cannot be empty",
  });

// POST /api/conversations/[id]/messages — send a text message, optionally with an image
export const POST = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const conversation = await findConversation(user, id);
  await assertCanSend(conversation);
  const data = await parseBody(req, sendSchema);

  let type: "TEXT" | "IMAGE" = "TEXT";
  let attachmentKey: string | null = null;
  if (data.image) {
    // Only images uploaded for this conversation by this sender can be attached.
    const expectedPrefix = `chat-attachments/${conversation.id}/${user.id}/`;
    if (!data.image.key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "This image cannot be attached to this conversation" }, { status: 403 });
    }
    // Re-verify the upload server-side: the object exists, is within limits and
    // its content matches the declared image type (magic bytes check).
    await verifyUpload(data.image.key, data.image.mimeType);
    type = "IMAGE";
    attachmentKey = data.image.key;
  }

  const message = await prisma.chatMessage.create({
    data: { conversationId: id, senderId: user.id, body: data.body, type, attachmentKey },
  });

  // Tell the other participant (the text itself is never included). Rapid-fire messages are coalesced.
  const participants = await prisma.conversation.findUnique({
    where: { id },
    select: { patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
  });
  const recipient = participants && (participants.patient.userId === user.id ? participants.doctor.userId : participants.patient.userId);
  queueNotification(recipient, { kind: "MESSAGE_RECEIVED", conversationId: id });

  return NextResponse.json(
    { message: { id: message.id, mine: true, type: message.type, body: message.body, attachmentKey: message.attachmentKey, createdAt: message.createdAt, readAt: null } },
    { status: 201 },
  );
});
