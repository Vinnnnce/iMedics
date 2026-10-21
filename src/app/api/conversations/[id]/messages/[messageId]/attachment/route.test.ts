/**
 * Always-running tests for the chat image reader: only conversation
 * participants can request a viewing URL, and only for image messages that
 * belong to that same conversation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
  requireFacilityAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { chatMessage: { findFirst: vi.fn() } } }));
vi.mock("@/lib/chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat")>()),
  findConversation: vi.fn(),
}));
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  presignView: vi.fn().mockResolvedValue("https://s3.example/signed-view"),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { requireUser } from "@/lib/auth";
import { findConversation } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { presignView } from "@/lib/storage";
import { notFound } from "@/lib/errors";

const CONVERSATION_ID = "0f0e0d0c-0b0a-4009-8008-700600500400";
const MESSAGE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const USER = { id: "11111111-2222-4333-8444-555555555555", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;
const CONVERSATION = { id: CONVERSATION_ID, patientId: "p1", doctorId: "d1" };
const MY_KEY = `chat-attachments/${CONVERSATION_ID}/11111111-2222-4333-8444-555555555555/abc`;

const invoke = () =>
  GET(
    new NextRequest(`https://care.example/api/conversations/${CONVERSATION_ID}/messages/${MESSAGE_ID}/attachment`),
    { params: Promise.resolve({ id: CONVERSATION_ID, messageId: MESSAGE_ID }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(findConversation).mockResolvedValue(CONVERSATION as never);
});

describe("GET /api/conversations/[id]/messages/[messageId]/attachment", () => {
  it("returns a short-lived viewing URL for an image message", async () => {
    vi.mocked(prisma.chatMessage.findFirst).mockResolvedValue({ type: "IMAGE", attachmentKey: MY_KEY } as never);
    const response = await invoke();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe("https://s3.example/signed-view");
    expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith({
      where: { id: MESSAGE_ID, conversationId: CONVERSATION_ID },
      select: { type: true, attachmentKey: true },
    });
    expect(presignView).toHaveBeenCalledWith(MY_KEY, "image");
  });

  it("404s when the message is not an image message", async () => {
    vi.mocked(prisma.chatMessage.findFirst).mockResolvedValue({ type: "TEXT", attachmentKey: null } as never);
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(presignView).not.toHaveBeenCalled();
  });

  it("404s when the message belongs to another conversation", async () => {
    vi.mocked(prisma.chatMessage.findFirst).mockResolvedValue(null);
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(presignView).not.toHaveBeenCalled();
  });

  it("404s for callers outside the conversation", async () => {
    vi.mocked(findConversation).mockRejectedValue(notFound("Conversation not found"));
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(prisma.chatMessage.findFirst).not.toHaveBeenCalled();
  });
});
