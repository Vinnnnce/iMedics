import { randomUUID } from "node:crypto";
import { z } from "zod";
import { badRequest } from "./errors";
import { deleteObject, inspectObject } from "./storage";
import { DOCUMENT_KIND_KEYS, VERIFICATION_MIME_TYPES } from "./verification";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VERIFICATION_DOCUMENTS = 10;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);

/** Real file signatures ("magic bytes"). The declared MIME type is never trusted on its own. */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "application/pdf": (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "image/webp": (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  "application/dicom": (b) => startsWith(b, [0x44, 0x49, 0x43, 0x4d], 128),
};

export const ALLOWED_MIME_TYPES = Object.keys(SIGNATURES) as [string, ...string[]];

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_MIME_TYPES, { error: "Unsupported file type" }),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export const confirmUploadSchema = z.object({
  key: z.string().min(1).max(300),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_MIME_TYPES, { error: "Unsupported file type" }),
});

/** File names are display-only (object keys are random), but strip anything odd anyway. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f"<>|:*?]/g, "_").slice(0, 200);
}

/** A random, unguessable object key under the given prefix. */
export function newObjectKey(prefix: string): string {
  return `${prefix}/${randomUUID()}`;
}

/**
 * Verify a finished upload: the object exists, is within the size limit, and its
 * content matches the declared type. Invalid uploads are deleted.
 */
export async function verifyUpload(key: string, mimeType: string): Promise<{ sizeBytes: number }> {
  const { sizeBytes, head } = await inspectObject(key);

  if (sizeBytes < 1 || sizeBytes > MAX_UPLOAD_BYTES) {
    await deleteObject(key);
    throw badRequest("The uploaded file is empty or larger than 15 MB");
  }
  if (!SIGNATURES[mimeType]?.(head)) {
    await deleteObject(key);
    throw badRequest("The uploaded file's content does not match its declared type");
  }
  return { sizeBytes };
}

/** Verification documents: same checks, but restricted to scans (no DICOM) and tagged with what the file is. */
export const verificationUploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(VERIFICATION_MIME_TYPES, { error: "Only PDF, JPG, PNG or WebP files are allowed" }),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  kind: z.enum(DOCUMENT_KIND_KEYS).default("OTHER"),
});

export const verificationConfirmSchema = z.object({
  key: z.string().min(1).max(300),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(VERIFICATION_MIME_TYPES, { error: "Only PDF, JPG, PNG or WebP files are allowed" }),
  kind: z.enum(DOCUMENT_KIND_KEYS).default("OTHER"),
});
