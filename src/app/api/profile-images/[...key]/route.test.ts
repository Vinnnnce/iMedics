/**
 * Always-running tests for the public profile-image reader: only well-formed,
 * account-attached images are served, with image content types and nosniff.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the S3-backed helpers are mocked; the real key validation is exercised.
vi.mock("@/lib/profile-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile-images")>()),
  isProfileImageAttached: vi.fn(),
  readProfileImage: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { isProfileImageAttached, readProfileImage } from "@/lib/profile-images";

const invoke = (pathname: string) =>
  GET(new NextRequest(`https://care.example${pathname}`), {
    params: Promise.resolve({
      key: pathname.replace("/api/profile-images/", "").split("/"),
    }),
  });

const UUID = "0f0e0d0c-0b0a-4009-8008-700600500400";
const OWNER = "11111111-2222-4333-8444-555555555555";

describe("GET /api/profile-images/[...key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves an attached image with its content type and nosniff", async () => {
    vi.mocked(isProfileImageAttached).mockResolvedValue(true);
    vi.mocked(readProfileImage).mockResolvedValue({
      stream: new ReadableStream(),
      contentType: "image/png",
    });

    const response = await invoke(`/api/profile-images/${OWNER}/${UUID}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("public");
  });

  it("rejects a well-formed key that is not attached to any account", async () => {
    vi.mocked(isProfileImageAttached).mockResolvedValue(false);

    const response = await invoke(`/api/profile-images/${OWNER}/${UUID}`);
    expect(response.status).toBe(404);
    expect(vi.mocked(readProfileImage)).not.toHaveBeenCalled();
  });

  it("rejects malformed keys before any storage or database access", async () => {
    for (const pathname of [
      `/api/profile-images/${OWNER}/short`,
      `/api/profile-images/${OWNER}/../../etc/passwd`,
      `/api/profile-images/${OWNER}/${UUID}/extra`,
      `/api/profile-images/not-a-uuid/${UUID}`,
    ]) {
      const response = await invoke(pathname);
      expect(response.status).toBe(404);
    }
    expect(vi.mocked(isProfileImageAttached)).not.toHaveBeenCalled();
    expect(vi.mocked(readProfileImage)).not.toHaveBeenCalled();
  });

  it("rejects a non-image content type on the stored object", async () => {
    vi.mocked(isProfileImageAttached).mockResolvedValue(true);
    vi.mocked(readProfileImage).mockResolvedValue({
      stream: new ReadableStream(),
      contentType: "application/pdf",
    });

    const response = await invoke(`/api/profile-images/${OWNER}/${UUID}`);
    expect(response.status).toBe(404);
  });
});
