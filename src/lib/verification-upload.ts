/** Browser helper: send one file to private storage (signed upload link, PUT, then confirm). Throws on any failure. */
export async function uploadVerificationDocument(file: File, kind: string): Promise<void> {
  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const presign = await fetch("/api/me/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType, sizeBytes: file.size, kind }),
  });
  if (!presign.ok) throw new Error((await presign.json().catch(() => null))?.error ?? "Could not start the upload");

  const { key, uploadUrl, headers } = (await presign.json()) as { key: string; uploadUrl: string; headers: Record<string, string> };
  const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
  if (!put.ok) throw new Error("The upload did not complete");

  const confirm = await fetch("/api/me/documents/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fileName: file.name, mimeType, kind }),
  });
  if (!confirm.ok) throw new Error((await confirm.json().catch(() => null))?.error ?? "Could not attach the document");
}
