/**
 * Always-running tests for sending chat messages: the text path is unchanged,
 * and image messages are only accepted when the upload is server-verified and
 * the object key was issued for this conversation by this sender.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  requireFacilityAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { chatMessage: { create: vi.fn(), updateMany: vi.fn() }, conversation: { findUnique: vi.fn() } } }));
vi.mock("@/lib/chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat")>()),
  findConversation: vi.fn(),
  assertCanSend: vi.fn(),
}));
vi.mock("@/lib/uploads", () => ({ verifyUpload: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ queueNotification: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { requireRole } from "@/lib/auth";
import { findConversation, assertCanSend } from "@/lib/chat";
import { verifyUpload } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { queueNotification } from "@/lib/notifications/service";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const CONVERSATION_ID = "0f0e0d0c-0b0a-4009-8008-700600500400";
const USER = { id: USER_ID, role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;
const CONVERSATION = { id: CONVERSATION_ID, patientId: "p1", doctorId: "d1" };
const MY_KEY = `chat-attachments/${CONVERSATION_ID}/${USER_ID}/abc`;

const invoke = (body: unknown) =>
  POST(
    new NextRequest(`https://care.example/api/conversations/${CONVERSATION_ID}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: CONVERSATION_ID }) },
  );

const created = (overrides: Record<string, unknown> = {}) => ({
  id: "m-1",
  senderId: USER_ID,
  body: "",
  type: "TEXT",
  attachmentKey: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(USER);
  vi.mocked(findConversation).mockResolvedValue(CONVERSATION as never);
  vi.mocked(assertCanSend).mockResolvedValue(undefined);
  vi.mocked(verifyUpload).mockResolvedValue({ sizeBytes: 1024 });
  vi.mocked(prisma.chatMessage.create).mockResolvedValue(created() as never);
  vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
    patient: { userId: "patient-user" },
    doctor: { userId: USER_ID },
  } as never);
});

describe("POST /api/conversations/[id]/messages", () => {
  it("still sends a plain text message without an image", async () => {
    const response = await invoke({ body: "Hello doctor" });
    expect(response.status).toBe(201);
    expect(verifyUpload).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: { conversationId: CONVERSATION_ID, senderId: USER_ID, body: "Hello doctor", type: "TEXT", attachmentKey: null },
    });
  });

  it("creates an IMAGE message with the attachment key and caption", async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(created({ type: "IMAGE", attachmentKey: MY_KEY, body: "Wound photo" }) as never);
    const response = await invoke({ body: "Wound photo", image: { key: MY_KEY, fileName: "wound.png", mimeType: "image/png" } });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message.type).toBe("IMAGE");
    expect(body.message.attachmentKey).toBe(MY_KEY);
    expect(verifyUpload).toHaveBeenCalledWith(MY_KEY, "image/png");
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: { conversationId: CONVERSATION_ID, senderId: USER_ID, body: "Wound photo", type: "IMAGE", attachmentKey: MY_KEY },
    });
  });

  it("allows an image with an empty caption but not an empty text-only message", async () => {
    const response = await invoke({ body: "", image: { key: MY_KEY, fileName: "wound.png", mimeType: "image/png" } });
    expect(response.status).toBe(201);

    const empty = await invoke({ body: "" });
    expect(empty.status).toBe(400);
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
  });

  it("rejects image keys issued for another conversation or sender", async () => {
    for (const key of [
      `chat-attachments/99999999-9999-4999-8999-999999999999/${USER_ID}/abc`,
      `chat-attachments/${CONVERSATION_ID}/99999999-9999-4999-8999-999999999999/abc`,
      `lab-files/${CONVERSATION_ID}/${USER_ID}/abc`,
    ]) {
      const response = await invoke({ body: "", image: { key, fileName: "x.png", mimeType: "image/png" } });
      expect(response.status).toBe(403);
    }
    expect(verifyUpload).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("does not create the message when the upload fails server-side verification", async () => {
    vi.mocked(verifyUpload).mockRejectedValue(new Error("signature mismatch"));
    const response = await invoke({ body: "", image: { key: MY_KEY, fileName: "x.png", mimeType: "image/png" } });
    expect(response.status).toBe(500);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("still queues a notification for the recipient on image messages", async () => {
    await invoke({ body: "", image: { key: MY_KEY, fileName: "x.png", mimeType: "image/png" } });
    expect(queueNotification).toHaveBeenCalledWith("patient-user", { kind: "MESSAGE_RECEIVED", conversationId: CONVERSATION_ID });
  });
});
