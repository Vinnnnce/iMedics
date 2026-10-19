import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/errors";
import { deleteObject, getStorage } from "@/lib/storage";
import { verifyUpload } from "@/lib/uploads";

/** Final keys have never been exposed through a writable presigned URL. */
export async function sealWorkspaceUpload(stagingKey: string, ownerId: string, mimeType: string, expectedSize: number) {
  const { client, bucket } = getStorage();
  const key = `workspace-records-final/${ownerId}/${randomUUID()}`;
  try {
    await client.send(new CopyObjectCommand({
      Bucket: bucket, Key: key, CopySource: `${bucket}/${stagingKey.split("/").map(encodeURIComponent).join("/")}`,
      MetadataDirective: "REPLACE", ContentType: mimeType, CacheControl: "private, no-store",
    }));
    const checked = await verifyUpload(key, mimeType);
    if (checked.sizeBytes !== expectedSize) throw new ApiError(400, "Uploaded file size does not match");
    return key;
  } catch (error) {
    await deleteObject(key);
    throw error;
  }
}
