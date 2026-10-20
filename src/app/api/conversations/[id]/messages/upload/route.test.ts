/**
 * Always-running tests for the chat image upload presigning: only images within
 * the size ceiling are presigned, and the key is bound to the conversation and
 * the sender so it can only be attached to a message in that thread.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  requireFacilityAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { __mock: true } }));
vi.mock("@/lib/chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat")>()),
  findConversation: vi.fn(),
  assertCanSend: vi.fn(),
}));
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  presignUpload: vi.fn().mockResolvedValue("https://s3.example/signed-put"),
}));
vi.mock("@/lib/uploads", () => ({ newObjectKey: vi.fn().mockReturnValue("chat-attachments/conv-1/user-1/abc") }));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { requireUser } from "@/lib/auth";
import { findConversation, assertCanSend } from "@/lib/chat";
import { presignUpload } from "@/lib/storage";
import { newObjectKey } from "@/lib/uploads";
import { forbidden, notFound } from "@/lib/errors";

const USER = { id: "11111111-2222-4333-8444-555555555555", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;
const CONVERSATION = { id: "0f0e0d0c-0b0a-4009-8008-700600500400", patientId: "p1", doctorId: "d1" };

const invoke = (body: unknown) =>
  POST(
    new NextRequest("https://care.example/api/conversations/0f0e0d0c-0b0a-4009-8008-700600500400/messages/upload", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: CONVERSATION.id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(findConversation).mockResolvedValue(CONVERSATION as never);
  vi.mocked(assertCanSend).mockResolvedValue(undefined);
});

describe("POST /api/conversations/[id]/messages/upload", () => {
  it("presigns an image upload bound to the conversation and sender", async () => {
    const response = await invoke({ mimeType: "image/png", sizeBytes: 1024 });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.key).toBe("chat-attachments/conv-1/user-1/abc");
    expect(body.uploadUrl).toBe("https://s3.example/signed-put");
    expect(newObjectKey).toHaveBeenCalledWith("chat-attachments/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555");
    expect(presignUpload).toHaveBeenCalledWith(expect.any(String), "image/png", 1024);
  });

  it("rejects files that are not PNG, JPEG or WebP images", async () => {
    for (const mimeType of ["application/pdf", "video/mp4", "image/gif", "text/plain"]) {
      const response = await invoke({ mimeType, sizeBytes: 1024 });
      expect(response.status).toBe(400);
    }
    expect(presignUpload).not.toHaveBeenCalled();
  });

  it("rejects images above the 15 MB ceiling", async () => {
    const response = await invoke({ mimeType: "image/png", sizeBytes: 15 * 1024 * 1024 + 1 });
    expect(response.status).toBe(400);
    expect(presignUpload).not.toHaveBeenCalled();
  });

  it("refuses to presign for a conversation the caller does not belong to", async () => {
    vi.mocked(findConversation).mockRejectedValue(notFound("Conversation not found"));
    const response = await invoke({ mimeType: "image/png", sizeBytes: 1024 });
    expect(response.status).toBe(404);
    expect(presignUpload).not.toHaveBeenCalled();
  });

  it("refuses to presign when messaging is not allowed (patient not in care)", async () => {
    vi.mocked(assertCanSend).mockRejectedValue(forbidden("read-only"));
    const response = await invoke({ mimeType: "image/png", sizeBytes: 1024 });
    expect(response.status).toBe(403);
    expect(presignUpload).not.toHaveBeenCalled();
  });
});
