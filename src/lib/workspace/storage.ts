import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/errors";
import { deleteObject } from "@/lib/storage";
import { verifyUpload } from "@/lib/uploads";

/** Final keys have never been exposed through a writable presigned URL. */
export async function sealWorkspaceUpload(stagingKey: string, ownerId: string, mimeType: string, expectedSize: number) {
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION } = process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new ApiError(503, "File storage is not configured");
  const client = new S3Client({
    endpoint: S3_ENDPOINT || undefined, region: S3_REGION || "auto", forcePathStyle: Boolean(S3_ENDPOINT),
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
  const key = `workspace-records-final/${ownerId}/${randomUUID()}`;
  try {
    await client.send(new CopyObjectCommand({
      Bucket: S3_BUCKET, Key: key, CopySource: `${S3_BUCKET}/${stagingKey.split("/").map(encodeURIComponent).join("/")}`,
      MetadataDirective: "REPLACE", ContentType: mimeType, CacheControl: "private, no-store",
    }));
    const checked = await verifyUpload(key, mimeType);
    if (checked.sizeBytes !== expectedSize) throw new ApiError(400, "Uploaded file size does not match");
    return key;
  } catch (error) {
    await deleteObject(key);
    throw error;
  } finally { client.destroy(); }
}
