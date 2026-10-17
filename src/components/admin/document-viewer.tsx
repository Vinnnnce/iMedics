"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

interface Doc {
  id: string;
  kindLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Lists an applicant's documents and previews one in place. Links are signed, last about a minute, and every open
 * is recorded in the audit log, so we only request one when the reviewer asks to see that document.
 */
export function DocumentViewer({ userId, documents }: { userId: string; documents: Doc[] }) {
  const [open, setOpen] = useState<{ doc: Doc; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const link = async (doc: Doc, download = false) => {
    setBusy(doc.id);
    setError("");
    try {
      const data = await apiClient.get<{ url: string }>(`/admin/users/${userId}/documents/${doc.id}${download ? "?download=1" : ""}`);
      return data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the document");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const view = async (doc: Doc) => {
    if (open?.doc.id === doc.id) return setOpen(null);
    const url = await link(doc);
    if (url) setOpen({ doc, url });
  };

  const external = async (doc: Doc, download: boolean) => {
    const url = await link(doc, download);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (documents.length === 0) return <p className="text-sm text-muted-foreground">The applicant has not uploaded any documents.</p>;

  return (
    <div className="space-y-3">
      {documents.map((d) => (
        <div key={d.id} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{d.kindLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{d.fileName} · {kb(d.sizeBytes)} · uploaded {new Date(d.createdAt).toLocaleDateString("en-GB")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy === d.id} onClick={() => view(d)}>
                {busy === d.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {open?.doc.id === d.id ? "Hide" : "Preview"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy === d.id} onClick={() => external(d, false)} aria-label={`Open ${d.fileName} in a new tab`}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy === d.id} onClick={() => external(d, true)} aria-label={`Download ${d.fileName}`}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {open?.doc.id === d.id && (
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {d.mimeType === "application/pdf" ? (
                <iframe src={open.url} title={d.fileName} className="h-[34rem] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.url} alt={`${d.kindLabel}: ${d.fileName}`} className="mx-auto max-h-[34rem] w-auto object-contain" />
              )}
            </div>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
