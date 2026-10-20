/**
 * Always-running tests for chat image finalization: the verified staging
 * upload is copied to a server-only final key (so the still-writable staging
 * URL cannot replace it) and mismatched or oversized uploads are rejected
 * and cleaned up.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  inspectObject: vi.fn(),
  copyObject: vi.fn(),
  deleteObject: vi.fn(),
}));

import { finalizeChatImage } from "./uploads";
import { inspectObject, copyObject, deleteObject } from "./storage";
import { badRequest } from "./errors";

const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const staged = (key: string, overrides: Partial<{ sizeBytes: number; head: Uint8Array; etag: string }> = {}) => ({
  key,
  sizeBytes: 1024,
  head: PNG_HEAD,
  etag: '"etag-1"',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inspectObject).mockResolvedValue(staged("k") as never);
  vi.mocked(copyObject).mockResolvedValue(undefined);
  vi.mocked(deleteObject).mockResolvedValue(undefined);
});

describe("finalizeChatImage", () => {
  it("copies the verified staging image to a server-only final key and deletes the staging object", async () => {
    vi.mocked(inspectObject).mockResolvedValueOnce(staged("s", { etag: '"e1"' })).mockResolvedValueOnce(staged("f", { etag: '"e2"' }));
    const finalKey = await finalizeChatImage(
      "chat-attachments/staging/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555/abc",
      "image/png",
    );
    expect(finalKey).toBe("chat-attachments/final/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555/abc");
    // The copy is conditional on the inspected version.
    expect(copyObject).toHaveBeenCalledWith(
      "chat-attachments/staging/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555/abc",
      "chat-attachments/final/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555/abc",
      '"e1"',
      "image/png",
    );
    expect(deleteObject).toHaveBeenCalledWith("chat-attachments/staging/0f0e0d0c-0b0a-4009-8008-700600500400/11111111-2222-4333-8444-555555555555/abc");
  });

  it("rejects keys outside the chat staging prefix before any storage access", async () => {
    for (const key of ["doctor-files/d1/abc", "chat-attachments/final/conv/user/abc", "../etc/passwd"]) {
      await expect(finalizeChatImage(key, "image/png")).rejects.toMatchObject({ message: expect.stringContaining("not uploaded") });
    }
    expect(inspectObject).not.toHaveBeenCalled();
  });

  it("deletes the staging object and rejects when the content does not match the declared image type", async () => {
    vi.mocked(inspectObject).mockResolvedValueOnce(staged("s", { head: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }));
    await expect(finalizeChatImage("chat-attachments/staging/c/u/abc", "image/png")).rejects.toMatchObject({ status: 400 });
    expect(deleteObject).toHaveBeenCalledWith("chat-attachments/staging/c/u/abc");
    expect(copyObject).not.toHaveBeenCalled();
  });

  it("rejects oversized images before any copy", async () => {
    vi.mocked(inspectObject).mockResolvedValueOnce(staged("s", { sizeBytes: 15 * 1024 * 1024 + 1 }));
    await expect(finalizeChatImage("chat-attachments/staging/c/u/abc", "image/png")).rejects.toMatchObject({ status: 400 });
    expect(copyObject).not.toHaveBeenCalled();
  });

  it("cleans up both objects when the copied image fails re-verification", async () => {
    vi.mocked(inspectObject)
      .mockResolvedValueOnce(staged("s", { sizeBytes: 1024 }))
      .mockResolvedValueOnce(staged("f", { sizeBytes: 2048 })); // copy raced / changed
    await expect(finalizeChatImage("chat-attachments/staging/c/u/abc", "image/png")).rejects.toMatchObject({ status: 400 });
    expect(deleteObject).toHaveBeenCalledWith("chat-attachments/final/c/u/abc");
    expect(deleteObject).toHaveBeenCalledWith("chat-attachments/staging/c/u/abc");
  });
});
