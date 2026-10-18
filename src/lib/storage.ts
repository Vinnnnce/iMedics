import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError, badRequest } from "./errors";

/**
 * Private object storage (any S3-compatible service). Files are never public:
 * clients upload and download only through short-lived presigned URLs that the
 * server issues after checking permissions.
 */

let cached: { client: S3Client; bucket: string } | null = null;

function storage() {
  if (cached) return cached;
  const {
    S3_BUCKET,
    S3_REGION,
    S3_ENDPOINT,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  } = process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new ApiError(503, "File storage is not configured");
  }
  cached = {
    bucket: S3_BUCKET,
    client: new S3Client({
      region: S3_REGION || "auto",
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(S3_ENDPOINT),
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    }),
  };
  return cached;
}

export const UPLOAD_URL_TTL_SECONDS = 300;
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/** A URL the browser can PUT the file to. The content type is bound to the signature. */
export function presignUpload(
  key: string,
  contentType: string,
  sizeBytes: number,
) {
  const { client, bucket } = storage();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

/** A short-lived URL for downloading a stored file under its original name. */
export function presignDownload(key: string, fileName: string) {
  const { client, bucket } = storage();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** A short-lived URL that displays a stored file in the browser (PDF or image) rather than downloading it. */
export function presignView(key: string, fileName: string) {
  const { client, bucket } = storage();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** Size and first bytes of an uploaded object, or a 400 if it was never uploaded. */
export async function inspectObject(
  key: string,
): Promise<{ sizeBytes: number; head: Uint8Array; etag: string | undefined }> {
  const { client, bucket } = storage();
  try {
    const meta = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    const part = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-255" }),
    );
    const head = (await part.Body?.transformToByteArray()) ?? new Uint8Array();
    return { sizeBytes: meta.ContentLength ?? 0, head, etag: meta.ETag };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw badRequest("Upload not found. Please upload the file again.");
  }
}

/**
 * Server-side copy of an object (browser-writable staging key -> server-only
 * final key). `ifMatchEtag`, when provided, makes the copy conditional on the
 * inspected version so content swapped between inspect and copy is rejected.
 */
export async function copyObject(
  sourceKey: string,
  destKey: string,
  ifMatchEtag?: string,
  contentType?: string,
): Promise<void> {
  const { client, bucket } = storage();
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destKey,
        ...(ifMatchEtag ? { CopySourceIfMatch: ifMatchEtag } : {}),
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw badRequest("Upload not found. Please upload the file again.");
  }
}

/** The web stream and content type of a stored object, for streaming it to a response. */
export async function getObjectStream(
  key: string,
): Promise<{ stream: ReadableStream | null; contentType: string | undefined }> {
  const { client, bucket } = storage();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return {
    stream: result.Body?.transformToWebStream() ?? null,
    contentType: result.ContentType,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = storage();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.error("Failed to delete object:", key, error);
  }
}
