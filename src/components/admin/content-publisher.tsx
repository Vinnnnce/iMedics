"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { apiClient } from "@/lib/api-client";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Article {
  id: string; slug: string; title: string; summary: string | null; body: string;
  coverImageUrl: string | null; authorName: string | null; status: Status; publishedAt: string | null;
}
interface Episode {
  id: string; slug: string; title: string; description: string; audioUrl: string | null;
  coverImageUrl: string | null; durationSeconds: number | null; episodeNumber: number | null;
  status: Status; publishedAt: string | null;
}

interface Form {
  title: string; text: string; summary: string; coverImageUrl: string; authorName: string;
  audioUrl: string; durationMinutes: string; episodeNumber: string;
}
const EMPTY: Form = { title: "", text: "", summary: "", coverImageUrl: "", authorName: "", audioUrl: "", durationMinutes: "", episodeNumber: "" };

const STATUS_LABEL: Record<Status, string> = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" };

/** Admin manager for news articles and podcast episodes (one editor, two tabs). */
export function ContentPublisher({ articles, episodes }: { articles: Article[]; episodes: Episode[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"news" | "podcasts">("news");
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNews = tab === "news";
  const endpoint = isNews ? "/admin/news" : "/admin/podcasts";

  const reset = () => { setForm(EMPTY); setEditingId(null); };
  const switchTab = (next: "news" | "podcasts") => { setTab(next); reset(); };

  const payload = (status?: Status) => ({
    title: form.title,
    ...(isNews
      ? {
          body: form.text,
          summary: form.summary || null,
          authorName: form.authorName || null,
          coverImageUrl: form.coverImageUrl.trim() || null,
        }
      : {
          description: form.text,
          audioUrl: form.audioUrl.trim() || null,
          coverImageUrl: form.coverImageUrl.trim() || null,
          durationSeconds: form.durationMinutes ? Math.round(Number(form.durationMinutes) * 60) : null,
          episodeNumber: form.episodeNumber ? Number.parseInt(form.episodeNumber, 10) : null,
        }),
    ...(status ? { status } : {}),
  });

  const save = async (status?: Status) => {
    setSaving(true);
    try {
      if (editingId) await apiClient.patch(endpoint, { id: editingId, ...payload(status) });
      else await apiClient.post(endpoint, payload(status ?? "DRAFT"));
      toast.success(status === "PUBLISHED" ? "Published" : "Saved");
      reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: Status) => {
    try {
      await apiClient.patch(endpoint, { id, status });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this permanently?")) return;
    try {
      await apiClient.delete(endpoint, { id });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  };

  const items: { id: string; title: string; status: Status; meta: string; edit: () => void }[] = isNews
    ? articles.map((a) => ({
        id: a.id, title: a.title, status: a.status,
        meta: a.publishedAt ? `Published ${new Date(a.publishedAt).toLocaleDateString()}` : "Not published",
        edit: () => { setEditingId(a.id); setForm({ ...EMPTY, title: a.title, text: a.body, summary: a.summary ?? "", coverImageUrl: a.coverImageUrl ?? "", authorName: a.authorName ?? "" }); },
      }))
    : episodes.map((e) => ({
        id: e.id, title: e.title, status: e.status,
        meta: [e.episodeNumber ? `Episode ${e.episodeNumber}` : null, e.publishedAt ? `Published ${new Date(e.publishedAt).toLocaleDateString()}` : "Not published"].filter(Boolean).join(" · "),
        edit: () => { setEditingId(e.id); setForm({ ...EMPTY, title: e.title, text: e.description, coverImageUrl: e.coverImageUrl ?? "", audioUrl: e.audioUrl ?? "", durationMinutes: e.durationSeconds ? String(Math.round(e.durationSeconds / 60)) : "", episodeNumber: e.episodeNumber ? String(e.episodeNumber) : "" }); },
      }));

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Content type" className="flex gap-2">
        {(["news", "podcasts"] as const).map((t) => (
          <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => switchTab(t)}>
            {t === "news" ? `News (${articles.length})` : `Podcasts (${episodes.length})`}
          </Button>
        ))}
      </div>

      <Card className="beeline-card">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">{editingId ? "Edit" : "New"} {isNews ? "article" : "episode"}</p>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" maxLength={200} aria-label="Title" />
          {isNews && <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Short summary (optional)" maxLength={500} aria-label="Summary" />}
          <Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={isNews ? "Article text — separate paragraphs with a blank line" : "Episode description"} className="min-h-32" aria-label={isNews ? "Article text" : "Episode description"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageUploadField value={form.coverImageUrl} onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })} label="Cover image (optional)" />
            {isNews ? (
              <Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} placeholder="Author (optional)" maxLength={120} aria-label="Author" />
            ) : (
              <>
                <Input value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} placeholder="Audio file URL (https://…)" inputMode="url" aria-label="Audio URL" />
                <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="Length in minutes" aria-label="Length in minutes" />
                <Input type="number" min={0} value={form.episodeNumber} onChange={(e) => setForm({ ...form, episodeNumber: e.target.value })} placeholder="Episode number" aria-label="Episode number" />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save()} disabled={saving || !form.title.trim() || !form.text.trim()}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save {editingId ? "changes" : "draft"}
            </Button>
            <Button onClick={() => save("PUBLISHED")} disabled={saving || !form.title.trim() || !form.text.trim()}>Publish</Button>
            {editingId && <Button variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {items.map((item) => (
          <Card key={item.id} className="beeline-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-lg text-xs">{STATUS_LABEL[item.status]}</Badge>
                <Button size="sm" variant="outline" onClick={item.edit}>Edit</Button>
                {item.status !== "PUBLISHED" && <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "PUBLISHED")}>Publish</Button>}
                {item.status === "PUBLISHED" && <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "ARCHIVED")}>Archive</Button>}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(item.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
