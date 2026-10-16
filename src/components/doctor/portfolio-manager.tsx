"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { PORTFOLIO_TYPES, PORTFOLIO_TYPE_LABELS, type PortfolioType } from "@/lib/doctor-profile";

interface PortfolioItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  attachmentFileId: string | null;
  visibility: string;
  consentStatus: string;
  consentAt: string | null;
}

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const textarea = "min-h-16 w-full rounded-lg border border-input bg-background p-2 text-sm";

/** The doctor's portfolio: items are private until published; case studies need recorded consent. */
export function PortfolioManager() {
  const router = useRouter();
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<string>("PUBLICATION");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [attachmentFileId, setAttachmentFileId] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState("PRIVATE");
  const [consentStatus, setConsentStatus] = useState("PENDING");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ items: PortfolioItem[] }>("/doctors/me/portfolio")
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your portfolio");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadAttachment = async (file: File) => {
    setError("");
    try {
      const initiated = await apiClient.post<{ key: string; uploadUrl: string; method: string; headers: Record<string, string> }>("/doctors/me/files", {
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      const put = await fetch(initiated.uploadUrl, { method: initiated.method, headers: initiated.headers, body: file });
      if (!put.ok) throw new Error("The file storage rejected the upload");
      const confirmed = await apiClient.post<{ file: { id: string; fileName: string } }>("/doctors/me/files/confirm", {
        key: initiated.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      setAttachmentFileId(confirmed.file.id);
      setAttachmentName(confirmed.file.fileName);
      toast.success("Attachment uploaded. Remember to save the item.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The attachment could not be uploaded");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setType("PUBLICATION");
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setPublishedAt("");
    setAttachmentFileId(null);
    setAttachmentName(null);
    setVisibility("PRIVATE");
    setConsentStatus("PENDING");
  };

  const startEdit = (item: PortfolioItem) => {
    setEditingId(item.id);
    setType(item.type);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setExternalUrl(item.externalUrl ?? "");
    setPublishedAt(item.publishedAt ? item.publishedAt.slice(0, 10) : "");
    setAttachmentFileId(item.attachmentFileId);
    setVisibility(item.visibility);
    setConsentStatus(item.consentStatus);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const body = {
      type,
      title,
      description: description || null,
      externalUrl: externalUrl || null,
      publishedAt: publishedAt || null,
      attachmentFileId,
      visibility,
      consentStatus,
    };
    try {
      if (editingId) {
        await apiClient.put(`/doctors/me/portfolio/${editingId}`, body);
        toast.success("Item updated");
      } else {
        await apiClient.post("/doctors/me/portfolio", body);
        toast.success("Item added");
      }
      resetForm();
      const refreshed = await apiClient.get<{ items: PortfolioItem[] }>("/doctors/me/portfolio");
      setItems(refreshed.items);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the item");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: PortfolioItem) => {
    setBusy(true);
    try {
      await apiClient.delete(`/doctors/me/portfolio/${item.id}`);
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
      toast.success("Item removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the item");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = async (item: PortfolioItem) => {
    const nextVisibility = item.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    setBusy(true);
    try {
      const updated = await apiClient.put<{ item: PortfolioItem }>(`/doctors/me/portfolio/${item.id}`, {
        ...item,
        publishedAt: item.publishedAt,
        visibility: nextVisibility,
      });
      setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? updated.item : i)) : prev));
      toast.success(nextVisibility === "PUBLIC" ? "Item published" : "Item unpublished");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {items?.map((item) => (
        <Card key={item.id} className="beeline-card">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {PORTFOLIO_TYPE_LABELS[item.type as PortfolioType] ?? item.type}
                  {item.publishedAt ? ` · ${new Date(item.publishedAt).getFullYear()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.visibility === "PUBLIC" ? "default" : "outline"} className="rounded-lg">
                  {item.visibility === "PUBLIC" ? "Public" : "Private"}
                </Badge>
                {item.type === "CASE_STUDY" && (
                  <Badge variant={item.consentStatus === "GRANTED" ? "default" : "outline"} className="rounded-lg">
                    Consent {item.consentStatus.toLowerCase()}
                  </Badge>
                )}
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => startEdit(item)}>
                  Edit
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => toggleVisibility(item)}>
                  {item.visibility === "PUBLIC" ? "Unpublish" : "Publish"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {item.description && <p className="text-muted-foreground">{item.description}</p>}
            {item.externalUrl && <a className="text-xs underline underline-offset-2" href={item.externalUrl} target="_blank" rel="noopener noreferrer">{item.externalUrl}</a>}
          </CardContent>
        </Card>
      ))}

      <Card className="beeline-card">
        <CardContent className="space-y-4 p-4">
          <p className="font-medium">{editingId ? "Edit portfolio item" : "Add a portfolio item"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs text-muted-foreground">
              Type
              <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                {PORTFOLIO_TYPES.map((t) => (
                  <option key={t} value={t}>{PORTFOLIO_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Title
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Published / date (optional)
              <input className={field} type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              External link (optional)
              <input className={field} placeholder="https://…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Description
            <textarea className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Attachment (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAttachment(file);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> {attachmentName ? "Replace attachment" : "Upload attachment"}
              </Button>
              {attachmentName && <span className="text-sm text-muted-foreground">{attachmentName}</span>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs text-muted-foreground">
              Visibility
              <select className={field} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="PRIVATE">Private (draft)</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Patient consent (case studies)
              <select className={field} value={consentStatus} onChange={(e) => setConsentStatus(e.target.value)}>
                <option value="PENDING">Pending</option>
                <option value="GRANTED">Granted — I have the patient&rsquo;s documented consent</option>
                <option value="DENIED">Denied</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Case studies must be anonymized and consent-approved before they can be published; the platform keeps
            the switch off until consent is recorded.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" className="bg-foreground text-background rounded-lg" disabled={busy || title.length < 3} onClick={save}>
              <Plus className="mr-1 h-4 w-4" /> {editingId ? "Save changes" : "Add item"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" className="rounded-lg" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
