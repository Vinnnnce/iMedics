/**
 * Browser helper: send a profile photo / organisation logo to private storage
 * (signed upload link, PUT, then server-side verification and finalization).
 * Returns the storage key to include in the registration payload.
 * Throws on any failure.
 */
export async function uploadProfileImage(file: File): Promise<string> {
  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const presign = await fetch("/api/me/profile-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
    }),
  });
  if (!presign.ok)
    throw new Error(
      (await presign.json().catch(() => null))?.error ??
        "Could not start the upload",
    );

  const { key, uploadUrl, headers } = (await presign.json()) as {
    key: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };
  const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
  if (!put.ok) throw new Error("The upload did not complete");

  const confirm = await fetch("/api/me/profile-image/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!confirm.ok)
    throw new Error(
      (await confirm.json().catch(() => null))?.error ??
        "Could not attach the image",
    );

  return ((await confirm.json()) as { key: string }).key;
}
