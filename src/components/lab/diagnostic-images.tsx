"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DiagnosticImageItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
 
  createdAt: string;
}

/** Allowed study types (kept in sync with the server-side signature checks). */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.dcm,application/pdf,image/png,image/jpeg,image/webp,application/dicom";
const MAX_BYTES = 15 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

interface QueuedFile {
  id: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
}

/** Resolve a file's MIME type; browsers often report .dcm files as empty. */
function resolveMime(file: File): string {
  if (file.type) return file.type;
  if (/\.dcm$/i.test(file.name)) return "application/dicom";
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  return ""; // rejected by the server's allow-list
}

/**
 * Imaging studies for one examination: the owning diagnostic centre uploads
 * studies (X-ray, CT, MRI, ultrasound, DICOM...) and every authorized viewer
 * downloads them through audited, short-lived URLs.
 */
export function DiagnosticImagesPanel({
  bookingId,
  initialImages,
  canUpload,
  canDownload,
}: {
  bookingId: string;
  initialImages: DiagnosticImageItem[];
  canUpload: boolean;
  canDownload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<DiagnosticImageItem[]>(initialImages);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    // Stable per-file ids: removing a finished upload never shifts another
    // file's queue entry (indices would).
    setQueue(files.map((file) => ({ id: crypto.randomUUID(), file, status: "uploading" as const })));

    for (const file of files) {
      try {
        if (file.size > MAX_BYTES) throw new Error("Files can be at most 15 MB");
        const mimeType = resolveMime(file);
        if (!mimeType) throw new Error(`${file.name}: unsupported file type`);

        // Step 1: presigned upload URL for the staging key.
        const presign = await postJson("/api/facility/diagnostic-images", {
          bookingId,
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
        });

        // Step 2: PUT the file straight to storage.
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: file,
        });
        if (!put.ok) throw new Error("Storage upload failed — please try again");

        // Step 3: verify, finalize and record the image.
        const confirmed = await postJson("/api/facility/diagnostic-images/confirm", {
          bookingId,
          key: presign.key,
          fileName: file.name,
          mimeType,
        });
        if (confirmed?.image) {
          setImages((prev) => [...prev, confirmed.image as DiagnosticImageItem]);
        }
        setQueue((prev) => prev.filter((item) => item.file !== file));
      } catch (err) {
        setQueue((prev) =>
          prev.map((item) =>
            item.file === file
              ? { ...item, status: "error" as const, error: err instanceof Error ? err.message : "Upload failed" }
              : item,
          ),
        );
      }
    }
    setBusy(false);
    router.refresh();
  };

  const download = async (id: string, fileName: string) => {
    setError(null);
    setDownloading(id);
    try {
      const res = await fetch(`/api/facility/diagnostic-images/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card title="Imaging studies" description="Radiology and diagnostic images attached to this examination">
      {canUpload && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {busy ? "Uploading…" : "Upload images"}
          </Button>
          <p className="text-xs text-muted-foreground">PDF, PNG, JPEG, WebP or DICOM, up to 15 MB each (max 10 per examination).</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="space-y-2">
        {images.map((image) => (
          <li key={image.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{image.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(image.sizeBytes)} · {new Date(image.createdAt).toLocaleString()}
              </p>
            </div>
            {canDownload && (
              <Button size="sm" variant="outline" disabled={downloading === image.id} onClick={() => void download(image.id, image.fileName)}>
                {downloading === image.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            )}
          </li>
        ))}
        {images.length === 0 && queue.length === 0 && (
          <li className="text-sm text-muted-foreground">No imaging studies attached yet.</li>
        )}
        {queue.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2.5 text-sm">
            <span className="truncate">{item.file.name}</span>
            {item.status === "uploading" ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Uploading
              </span>
            ) : (
              <span className="text-xs text-destructive">{item.error}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
