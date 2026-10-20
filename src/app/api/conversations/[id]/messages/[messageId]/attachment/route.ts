import { NextResponse } from "next/server";
import { withAuth, parseId } from "@/lib/api";
import { findConversation } from "@/lib/chat";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { presignView } from "@/lib/storage";

// GET /api/conversations/[id]/messages/[messageId]/attachment — a short-lived URL
// that displays an image message inline. Only participants of the conversation
// can request it, and the message must belong to that same conversation, so an
// image can never be read by anyone outside the doctor/patient thread.
export const GET = withAuth<{ id: string; messageId: string }>(null, async (_req, { user, params }) => {
  const routeParams = await params;
  const conversation = await findConversation(user, parseId(routeParams.id));

  const message = await prisma.chatMessage.findFirst({
    where: { id: parseId(routeParams.messageId), conversationId: conversation.id },
    select: { type: true, attachmentKey: true },
  });
  if (!message || message.type !== "IMAGE" || !message.attachmentKey) throw notFound("Image not found");

  const url = await presignView(message.attachmentKey, "image");
  return NextResponse.json({ url });
});
