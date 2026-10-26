import { createHash, randomUUID } from "node:crypto";
import { badRequest } from "@/lib/errors";
import { copyObject, deleteObject, getObjectStream, inspectObject } from "@/lib/storage";
import type { MediaFormat } from "./media-formats";

/**
 * Optional malware scanning hook. When MALWARE_SCAN_URL is set, the server
 * POSTs { key } and expects { result: "CLEAN" | "INFECTED" }. Without it the
 * file is recorded as NOT_SCANNED (signature-checked only) — never as clean.
 */
export async function scanObject(key: string): Promise<"CLEAN" | "INFECTED" | "NOT_SCANNED"> {
  const url = process.env.MALWARE_SCAN_URL;
  if (!url) return "NOT_SCANNED";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.MALWARE_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.MALWARE_SCAN_TOKEN}` } : {}) },
    body: JSON.stringify({ bucket: process.env.S3_BUCKET, key }),
  });
  if (!res.ok) throw badRequest("The malware scanner is unavailable. Please retry the upload later.");
  const data = (await res.json()) as { result?: string };
  return data.result === "INFECTED" ? "INFECTED" : "CLEAN";
}

export async function sha256OfObject(key: string): Promise<string> {
  const { stream } = await getObjectStream(key);
  if (!stream) throw badRequest("Upload not found. Please upload the file again.");
  const hash = createHash("sha256");
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  return hash.digest("hex");
}

export function stagingPrefix(facilityId: string, patientId: string): string {
  return `medical-media/staging/${facilityId}/${patientId}/`;
}

/**
 * Verify a staged upload (size, real file signature, checksum, optional
 * malware scan), copy it to a server-only key and delete the staging object.
 */
export async function finalizeMedia(
  stagingKey: string,
  facilityId: string,
  patientId: string,
  format: MediaFormat,
  declaredSha256: string,
): Promise<{ finalKey: string; sizeBytes: number; sha256: string; scanStatus: "CLEAN" | "NOT_SCANNED" }> {
  if (!stagingKey.startsWith(stagingPrefix(facilityId, patientId)) || stagingKey.includes("..")) throw badRequest("This file was not uploaded for this patient");
  const inspected = await inspectObject(stagingKey);
  const reject = async (message: string) => {
    await deleteObject(stagingKey);
    throw badRequest(message);
  };
  if (inspected.sizeBytes < 1 || inspected.sizeBytes > format.maxBytes) await reject(`The file is empty or larger than the ${Math.round(format.maxBytes / 1048576)} MB limit for ${format.label}`);
  if (!format.check(inspected.head)) await reject(`The file's content does not match the declared format (${format.label})`);

  const finalKey = `medical-media/final/${facilityId}/${patientId}/${randomUUID()}`;
  await copyObject(stagingKey, finalKey, inspected.etag, format.mimeTypes[0]);
  await deleteObject(stagingKey);

  const sha256 = await sha256OfObject(finalKey);
  if (sha256 !== declaredSha256.toLowerCase()) {
    await deleteObject(finalKey);
    throw badRequest("Checksum mismatch — the file was corrupted or changed during upload. Please retry.");
  }
  const scan = await scanObject(finalKey);
  if (scan === "INFECTED") {
    await deleteObject(finalKey);
    throw badRequest("The file was rejected by the malware scanner");
  }
  return { finalKey, sizeBytes: inspected.sizeBytes, sha256, scanStatus: scan };
}
