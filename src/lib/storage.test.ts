/**
 * Storage-level test for copyObject: the actual S3 command parameters,
 * including the MetadataDirective: REPLACE behaviour that a mocked copyObject
 * at the profile-images level cannot catch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const s3 = vi.hoisted(() => ({
  inputs: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  const record = (ctor: string) =>
    class {
      constructor(input: Record<string, unknown>) {
        s3.inputs.push({ ctor: ctor, ...input });
      }
    };
  return {
    S3Client: class {
      send = s3.send;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_config: unknown) {}
    },
    DeleteObjectCommand: record("DeleteObjectCommand"),
    GetObjectCommand: record("GetObjectCommand"),
    HeadObjectCommand: record("HeadObjectCommand"),
    PutObjectCommand: record("PutObjectCommand"),
    CopyObjectCommand: record("CopyObjectCommand"),
  };
});

process.env.S3_BUCKET = "test-bucket";
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY_ID = "test-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";

import { copyObject } from "./storage";

const copyInputs = () =>
  s3.inputs.filter((i) => i.ctor === "CopyObjectCommand");

describe("storage.copyObject", () => {
  beforeEach(() => {
    s3.inputs.length = 0;
    s3.send.mockReset();
    s3.send.mockResolvedValue({});
  });

  it("copies with an ETag condition and replaces metadata with the detected content type", async () => {
    await copyObject(
      "profile-image-uploads/u1/staging",
      "profile-images/u1/final",
      '"v1"',
      "image/png",
    );

    const input = copyInputs()[0];
    expect(input.Bucket).toBe("test-bucket");
    expect(input.CopySource).toBe(
      "test-bucket/profile-image-uploads/u1/staging",
    );
    expect(input.Key).toBe("profile-images/u1/final");
    expect(input.CopySourceIfMatch).toBe('"v1"');
    expect(input.ContentType).toBe("image/png");
    // Without REPLACE, S3 copies the source metadata and ignores ContentType.
    expect(input.MetadataDirective).toBe("REPLACE");
  });

  it("omits the condition and the metadata directive when not provided", async () => {
    await copyObject("a", "b");

    const input = copyInputs()[0];
    expect(input.CopySourceIfMatch).toBeUndefined();
    expect(input.ContentType).toBeUndefined();
    expect(input.MetadataDirective).toBeUndefined();
  });
});
