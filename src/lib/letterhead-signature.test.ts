import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({
  presignUpload: vi.fn().mockResolvedValue("https://s3.example/signed-put"),
  inspectObject: vi.fn(),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  getObjectStream: vi.fn(),
  UPLOAD_URL_TTL_SECONDS: 300,
}));

import {
  isSignatureKey,
  loadSignatureImageBytes,
  presignSignatureUpload,
  verifySignatureUpload,
} from "./letterhead-signature";
import { inspectObject, deleteObject, getObjectStream } from "./storage";

const pngHead = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpegHead = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const pngBytes = new Uint8Array([...pngHead, ...Array.from({ length: 40 }, (_, i) => i)]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSignatureKey", () => {
  it("only accepts keys under the signature prefix", () => {
    expect(isSignatureKey("letterhead-signatures/abc")).toBe(true);
    expect(isSignatureKey("medical-media/final/x")).toBe(false);
    expect(isSignatureKey("https://evil.example/s.png")).toBe(false);
    expect(isSignatureKey("")).toBe(false);
  });
});

describe("presignSignatureUpload", () => {
  it("presigns a PNG or JPEG within the size limit", async () => {
    const result = await presignSignatureUpload("owner-1", "image/png", 1024);
    expect(result.key.startsWith("letterhead-signatures/owner-1/")).toBe(true);
    expect(result.uploadUrl).toContain("s3.example");
    expect(result.headers).toEqual({ "Content-Type": "image/png" });
  });
  it("rejects other types and oversize files", async () => {
    await expect(presignSignatureUpload("owner-1", "image/webp", 1024)).rejects.toThrow(/PNG or JPEG/);
    await expect(presignSignatureUpload("owner-1", "image/png", 3 * 1024 * 1024)).rejects.toThrow(/2 MB/);
  });
});

describe("verifySignatureUpload", () => {
  it("accepts a real PNG within the limit", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ sizeBytes: 1000, head: pngHead, etag: "e" });
    const result = await verifySignatureUpload("letterhead-signatures/abc.png");
    expect(result.mimeType).toBe("image/png");
    expect(deleteObject).not.toHaveBeenCalled();
  });
  it("accepts a JPEG and reports its type", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ sizeBytes: 1000, head: jpegHead, etag: "e" });
    expect((await verifySignatureUpload("letterhead-signatures/abc.jpg")).mimeType).toBe("image/jpeg");
  });
  it("deletes and rejects files that are not PNG or JPEG", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ sizeBytes: 1000, head: new Uint8Array([1, 2, 3, 4]), etag: "e" });
    await expect(verifySignatureUpload("letterhead-signatures/abc.png")).rejects.toThrow(/PNG or JPEG/);
    expect(deleteObject).toHaveBeenCalledWith("letterhead-signatures/abc.png");
  });
  it("deletes and rejects oversize files", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ sizeBytes: 3 * 1024 * 1024, head: pngHead, etag: "e" });
    await expect(verifySignatureUpload("letterhead-signatures/abc.png")).rejects.toThrow(/2 MB/);
    expect(deleteObject).toHaveBeenCalledWith("letterhead-signatures/abc.png");
  });
});

describe("loadSignatureImageBytes", () => {
  const streamOf = (chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({
    start(controller) { chunks.forEach((c) => controller.enqueue(c)); controller.close(); },
  });

  it("reads a stored PNG in full", async () => {
    vi.mocked(getObjectStream).mockResolvedValue({ stream: streamOf([pngBytes.subarray(0, 10), pngBytes.subarray(10)]), contentType: "image/png" });
    const bytes = await loadSignatureImageBytes("letterhead-signatures/abc.png");
    expect(bytes).toEqual(pngBytes);
  });
  it("returns null for invalid or missing keys", async () => {
    expect(await loadSignatureImageBytes(null)).toBeNull();
    expect(await loadSignatureImageBytes("other/x.png")).toBeNull();
    expect(await loadSignatureImageBytes(undefined)).toBeNull();
  });
  it("returns null when storage fails or content is not an image", async () => {
    vi.mocked(getObjectStream).mockRejectedValue(new Error("down"));
    expect(await loadSignatureImageBytes("letterhead-signatures/abc.png")).toBeNull();
    vi.mocked(getObjectStream).mockResolvedValue({ stream: streamOf([new Uint8Array([1, 2, 3])]), contentType: "image/png" });
    expect(await loadSignatureImageBytes("letterhead-signatures/abc.png")).toBeNull();
  });
});
