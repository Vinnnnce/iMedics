"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Trash2, Share2, Search, FileText, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, MAX_DOCUMENT_BYTES, ALLOWED_DOCUMENT_MIME_TYPES, type DocumentCategory } from "@/lib/documents/shared";

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  issuedOn: string | null;
  issuingFacility: string | null;
  notes: string | null;
  createdAt: string;
  shares: { id: string; sharedWithUser: { id: string; name: string; role: string }; role: string; revokedAt: string | null }[];
}

const CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_LABELS);
const CATEGORIES = DOCUMENT_CATEGORIES as readonly string[];

export function PatientRecords() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [shareTarget, setShareTarget] = useState<DocumentRow | null>(null);
  const [shareUserId, setShareUserId] = useState("");
  const [shareName, setShareName] = useState("");
  const [shareRole, setShareRole] = useState("DOCTOR");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("LAB_REPORT");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(query ? { q: query } : {}) });
      const data = await apiClient.get<{ documents: DocumentRow[] }>(`/patient/documents?${params}`);
      setDocuments(data.documents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = documents.filter((d) => category === "ALL" || d.category === category);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as never)) {
      toast.error("Only PDF, JPEG, PNG and WebP files are supported");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error("Files are limited to 20 MB");
      return;
    }
    setUploading(true);
    try {
      const body = {
        title: file.name.replace(/\.[^.]+$/, ""),
        category: CATEGORIES.includes(uploadCategory) ? uploadCategory : "OTHER",
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      const created = await apiClient.post<{ document: { id: string }; uploadUrl: string }>("/patient/documents", body);
      // PUT the file to the presigned URL (no content-type header: it is bound to the signature).
      const response = await fetch(created.uploadUrl, { method: "PUT", body: file });
      if (!response.ok) throw new Error("The upload failed. Please try again.");
      // Verify the stored object matches its declared type.
      await apiClient.post(`/patient/documents/${created.document.id}`, {});
      toast.success("Document uploaded");
      setShowUpload(false);
      if (fileRef.current) fileRef.current.value = "";
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async (id: string) => {
    try {
      const data = await apiClient.get<{ url: string }>(`/patient/documents/${id}?download=1`);
      window.open(data.url, "_blank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download");
    }
  };

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/patient/documents/${id}`);
      toast.success("Document removed");
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove");
    }
  };

  const grantShare = async () => {
    if (!shareTarget) return;
    try {
      await apiClient.post(`/patient/documents/${shareTarget.id}/shares`, {
        sharedWithUserId: shareUserId,
        role: shareRole,
      });
      toast.success(`Shared with ${shareName || "the selected user"}`);
      setShareTarget(null);
      setShareUserId("");
      setShareName("");
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share");
    }
  };

  const revokeShare = async (documentId: string, userId: string) => {
    try {
      await apiClient.delete(`/patient/documents/${documentId}/shares?userId=${encodeURIComponent(userId)}`);
      toast.success("Sharing revoked");
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Medical records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your reports live in secure private storage. Sharing is granted and revoked by you alone.
          </p>
        </div>
        <Button onClick={() => setShowUpload((s) => !s)} data-testid="button-upload-toggle">
          <Upload className="h-4 w-4" aria-hidden="true" /> {showUpload ? "Close" : "Upload a document"}
        </Button>
      </div>

      {showUpload && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="doc-file">File (PDF, JPEG, PNG or WebP, up to 20 MB)</Label>
              <Input id="doc-file" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-category">Category</Label>
              <select id="doc-category" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <Button onClick={upload} disabled={uploading}>{uploading ? "Uploading…" : "Upload securely"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title" className="pl-9" aria-label="Search documents" />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-border bg-background p-2 text-sm"
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading your documents…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents yet. Upload lab reports, prescriptions, discharge summaries and other medical documents.</p>
      )}

      <div className="space-y-3">
        {filtered.map((doc) => (
          <Card key={doc.id} className="beeline-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <FileText className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category}
                    {doc.issuingFacility ? ` · ${doc.issuingFacility}` : ""}
                    {doc.issuedOn ? ` · issued ${new Date(doc.issuedOn).toLocaleDateString()}` : ` · added ${new Date(doc.createdAt).toLocaleDateString()}`}
                    {" · "}{Math.round(doc.sizeBytes / 1024)} KB
                  </p>
                  {doc.notes && <p className="mt-1 text-sm text-muted-foreground">{doc.notes}</p>}
                  {doc.shares.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {doc.shares.map((share) => (
                        <span key={share.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                          Shared with {share.sharedWithUser.name}
                          <button aria-label={`Revoke sharing with ${share.sharedWithUser.name}`} onClick={() => revokeShare(doc.id, share.sharedWithUser.id)}>
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => download(doc.id)} aria-label={`Download ${doc.title}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShareTarget(doc)} aria-label={`Share ${doc.title}`}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(doc.id)} aria-label={`Remove ${doc.title}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {shareTarget && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">Share “{shareTarget.title}”</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="share-user-id">Platform user ID</Label>
                <Input id="share-user-id" value={shareUserId} onChange={(e) => setShareUserId(e.target.value)} placeholder="e.g. a doctor's account id" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="share-name">Their name (for your records)</Label>
                <Input id="share-name" value={shareName} onChange={(e) => setShareName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="share-role">Sharing as</Label>
                <select id="share-role" value={shareRole} onChange={(e) => setShareRole(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  <option value="DOCTOR">Doctor</option>
                  <option value="NURSE">Nurse</option>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CAREGIVER">Caregiver</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={grantShare} disabled={!shareUserId}>Grant access</Button>
              <Button variant="outline" onClick={() => setShareTarget(null)}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">They will be able to view and download this document until you revoke access. Every access is logged.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Documents are stored encrypted in transit and at rest, and are only ever downloaded through short-lived secure links. Only you and the people you authorise can access them.
      </p>
    </div>
  );
}
