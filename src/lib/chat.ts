import type { Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import { forbidden, notFound } from "./errors";

/** Conversations the caller is a participant in. */
export function conversationAccess(user: User): Prisma.ConversationWhereInput {
  return user.role === "DOCTOR" ? { doctor: { userId: user.id } } : { patient: { userId: user.id } };
}

/** Load a conversation the caller belongs to, or throw 404. */
export async function findConversation(user: User, id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { AND: [{ id }, conversationAccess(user)] },
    select: { id: true, patientId: true, doctorId: true },
  });
  if (!conversation) throw notFound("Conversation not found");
  return conversation;
}

/** Messaging is only allowed while the patient is in the doctor's care. */
export async function assertCanSend(conversation: { patientId: string; doctorId: string }) {
  const assignment = await prisma.patientAssignment.findFirst({
    where: { patientId: conversation.patientId, doctorId: conversation.doctorId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignment) throw forbidden("This conversation is read-only because the patient is not currently in the doctor's care");
}
