import { NextResponse } from "next/server";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { findConversation, assertCanSend, CHAT_IMAGE_MIME_TYPES, CHAT_IMAGE_MAX_BYTES } from "@/lib/chat";
import { presignUpload, UPLOAD_URL_TTL_SECONDS } from "@/lib/storage";
import { newObjectKey } from "@/lib/uploads";
import { z } from "zod";

const requestSchema = z.object({
  mimeType: z.enum(CHAT_IMAGE_MIME_TYPES, { error: "Only PNG, JPEG or WebP images can be sent" }),
  sizeBytes: z.number().int().min(1).max(CHAT_IMAGE_MAX_BYTES),
});

// POST /api/conversations/[id]/messages/upload — a short-lived URL the browser
// can PUT a chat image to. The object key is bound to this conversation and the
// signed-in sender, so an uploaded image can only be attached to a message in
// this conversation, and only while messaging is allowed (patient in care).
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const conversation = await findConversation(user, parseId((await params).id));
  await assertCanSend(conversation);

  const { mimeType, sizeBytes } = await parseBody(req, requestSchema);
  const key = newObjectKey(`chat-attachments/${conversation.id}/${user.id}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({ key, uploadUrl, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
});
