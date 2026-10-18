import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  inspectObject: vi.fn(),
  copyObject: vi.fn(),
  deleteObject: vi.fn(),
  getObjectStream: vi.fn(),
}));
vi.mock("./storage", () => storageMock);
vi.mock("./uploads", () => ({
  newObjectKey: (prefix: string) =>
    `${prefix}/0f0e0d0c-0b0a-4009-8008-700600500400`,
}));
vi.mock("./prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    labStaffProfile: { findFirst: vi.fn() },
  },
}));

import {
  finalizeProfileImage,
  isFinalProfileImageKey,
  isStagingProfileImageKey,
  isValidFinalProfileImageS3Key,
  publicProfileImageUrl,
} from "./profile-images";

const PNG_HEAD = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...Array(24).fill(0),
]);
const JPEG_HEAD = new Uint8Array([
  0xff,
  0xd8,
  0xff,
  0xe0,
  ...Array(28).fill(0),
]);
const TEXT_HEAD = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"

describe("profile image keys", () => {
  it("accepts only uuid keys under the owner's prefix", () => {
    const userId = "11111111-2222-4333-8444-555555555555";
    const uuid = "0f0e0d0c-0b0a-4009-8008-700600500400";
    expect(
      isStagingProfileImageKey(
        `profile-image-uploads/${userId}/${uuid}`,
        userId,
      ),
    ).toBe(true);
    expect(
      isFinalProfileImageKey(`profile-images/${userId}/${uuid}`, userId),
    ).toBe(true);
    expect(
      isFinalProfileImageKey(`profile-images/${userId}/${uuid}`, "other-user"),
    ).toBe(false);
    expect(
      isFinalProfileImageKey(`profile-image-uploads/${userId}/${uuid}`, userId),
    ).toBe(false);
    expect(
      isFinalProfileImageKey(`profile-images/${userId}/../../secret`, userId),
    ).toBe(false);
    expect(
      isFinalProfileImageKey(`profile-images/${userId}/not-a-uuid`, userId),
    ).toBe(false);
  });

  it("maps the s3 key to the public route path without duplicating the prefix", () => {
    expect(publicProfileImageUrl("profile-images/u1/abc")).toBe(
      "/api/profile-images/u1/abc",
    );
  });

  it("validates well-formed final keys regardless of owner", () => {
    const userId = "11111111-2222-4333-8444-555555555555";
    const uuid = "0f0e0d0c-0b0a-4009-8008-700600500400";
    expect(
      isValidFinalProfileImageS3Key(`profile-images/${userId}/${uuid}`),
    ).toBe(true);
    expect(
      isValidFinalProfileImageS3Key(`profile-image-uploads/${userId}/${uuid}`),
    ).toBe(false);
    expect(
      isValidFinalProfileImageS3Key(
        `profile-images/${userId}/../../etc/passwd`,
      ),
    ).toBe(false);
    expect(
      isValidFinalProfileImageS3Key(`profile-images/${userId}/short`),
    ).toBe(false);
    expect(
      isValidFinalProfileImageS3Key(`verification/${userId}/${uuid}`),
    ).toBe(false);
  });
});

describe("finalizeProfileImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies the verified image to a fresh final key and deletes the staging copy", async () => {
    storageMock.inspectObject.mockResolvedValue({
      sizeBytes: 1000,
      head: PNG_HEAD,
      etag: '"v1"',
    });
    storageMock.copyObject.mockResolvedValue(undefined);
    storageMock.deleteObject.mockResolvedValue(undefined);

    const stagingKey =
      "profile-image-uploads/u1/0f0e0d0c-0b0a-4009-8008-700600500400";
    const key = await finalizeProfileImage(stagingKey);

    // A fresh destination every time: re-confirming the same staging upload can
    // never overwrite an already-attached image.
    expect(key).toMatch(/^profile-images\/u1\/[0-9a-f-]{36}$/);
    expect(key).not.toBe(
      "profile-images/u1/0f0e0d0c-0b0a-4009-8008-700600500400",
    );
    expect(storageMock.copyObject).toHaveBeenCalledWith(
      stagingKey,
      key,
      '"v1"',
      "image/png",
    );
    expect(storageMock.deleteObject).toHaveBeenCalledWith(stagingKey);
  });

  it("rejects non-image content regardless of the declared type", async () => {
    storageMock.inspectObject.mockResolvedValue({
      sizeBytes: 100,
      head: TEXT_HEAD,
      etag: '"v1"',
    });
    await expect(
      finalizeProfileImage("profile-image-uploads/u1/uuid"),
    ).rejects.toMatchObject({ status: 400 });
    expect(storageMock.copyObject).not.toHaveBeenCalled();
  });

  it("cleans up and fails when the copied object does not match the inspected one", async () => {
    storageMock.inspectObject
      .mockResolvedValueOnce({ sizeBytes: 1000, head: PNG_HEAD, etag: '"v1"' })
      .mockResolvedValueOnce({ sizeBytes: 999, head: JPEG_HEAD, etag: '"v2"' });
    storageMock.deleteObject.mockResolvedValue(undefined);

    await expect(
      finalizeProfileImage("profile-image-uploads/u1/uuid"),
    ).rejects.toMatchObject({ status: 400 });
    const finalKey = storageMock.copyObject.mock.calls[0][1];
    expect(storageMock.deleteObject).toHaveBeenCalledWith(finalKey);
  });
});
