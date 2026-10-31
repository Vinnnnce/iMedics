"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * An image field for admin forms: upload a PNG/JPG/WEBP (up to 5 MB) or paste
 * an https:// URL. Uploads go to private storage through the presign + confirm
 * flow (the server checks the file's real type and size) and the field's value
 * becomes the resulting /api/site-media/… path.
 */
export function ImageUploadField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("The image is larger than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const presign = await apiClient.post<{ key: string; uploadUrl: string; headers: Record<string, string> }>(
        "/admin/media",
        { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      );
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: presign.headers, body: file });
      if (!put.ok) throw new Error("The upload was rejected. Please try again.");
      const confirmed = await apiClient.post<{ url: string }>("/admin/media/confirm", { key: presign.key });
      onChange(confirmed.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided image preview
          <img src={value} alt="" className="h-14 w-24 rounded-md bg-muted object-cover" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          id={inputId}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />}
          {value ? "Replace image" : "Upload image"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} aria-label={`Remove ${label.toLowerCase()}`}>
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL (https://…)"
        inputMode="url"
        maxLength={500}
        aria-label={`${label} URL`}
      />
    </div>
  );
}
