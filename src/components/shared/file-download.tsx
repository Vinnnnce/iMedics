"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/** Fetches a short-lived signed link for a stored file, then opens it. */
export function FileDownloadButton({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await apiClient.get<{ url: string }>(`/files/${fileId}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={download}>
        <Download className="mr-1 h-4 w-4" /> {fileName}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
