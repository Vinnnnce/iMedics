"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

interface Notice { id: string; text: string; active: boolean; createdAt: string }
interface Ad { id: string; title: string; content: string; placement: "SIDEBAR" | "DASHBOARD" | "LOGIN"; active: boolean; createdAt: string }

const PLACEMENT = { SIDEBAR: "Sidebar", DASHBOARD: "Dashboard", LOGIN: "Login page" } as const;

export function ContentManager({ notices, ads }: { notices: Notice[]; ads: Ad[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [editingNotice, setEditingNotice] = useState<string | null>(null);
  const [ad, setAd] = useState({ title: "", content: "", placement: "SIDEBAR" as Ad["placement"] });
  const [editingAd, setEditingAd] = useState<string | null>(null);

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveNotice = () =>
    call(async () => {
      if (editingNotice) await apiClient.patch("/admin/notices", { id: editingNotice, text: noticeText });
      else await apiClient.post("/admin/notices", { text: noticeText });
      setNoticeText("");
      setEditingNotice(null);
    });

  const saveAd = () =>
    call(async () => {
      if (editingAd) await apiClient.patch("/admin/ads", { id: editingAd, ...ad });
      else await apiClient.post("/admin/ads", ad);
      setAd({ title: "", content: "", placement: "SIDEBAR" });
      setEditingAd(null);
    });

  const remove = (path: string, id: string, label: string) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    void call(() => fetch(`/api${path}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then((r) => { if (!r.ok) throw new Error("Could not delete"); }));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Notices</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Short announcements shown to signed-in users, such as planned maintenance.</p>
          <div className="space-y-2">
            <Textarea value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Write a notice (max 500 characters)" className="min-h-20 rounded-lg" maxLength={500} aria-label="Notice text" />
            <div className="flex gap-2">
              <Button className="rounded-lg bg-foreground text-background" disabled={busy || !noticeText.trim()} onClick={saveNotice}><Plus className="mr-1 h-4 w-4" />{editingNotice ? "Save notice" : "Publish notice"}</Button>
              {editingNotice && <Button variant="ghost" className="rounded-lg" onClick={() => { setEditingNotice(null); setNoticeText(""); }}>Cancel</Button>}
            </div>
          </div>
          <div className="space-y-2">
            {notices.length === 0 && <p className="text-sm text-muted-foreground">No notices yet.</p>}
            {notices.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Switch size="sm" checked={n.active} aria-label={`Show notice: ${n.text.slice(0, 30)}`} onCheckedChange={(v) => call(() => apiClient.patch("/admin/notices", { id: n.id, active: Boolean(v) }))} />
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{n.text}</p>
                <Button size="sm" variant="ghost" aria-label="Edit notice" onClick={() => { setEditingNotice(n.id); setNoticeText(n.text); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label="Delete notice" onClick={() => remove("/admin/notices", n.id, "this notice")}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Advertisements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Input value={ad.title} onChange={(e) => setAd({ ...ad, title: e.target.value })} placeholder="Title" className="rounded-lg" maxLength={120} aria-label="Ad title" />
            <select value={ad.placement} onChange={(e) => setAd({ ...ad, placement: e.target.value as Ad["placement"] })} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" aria-label="Placement">
              {Object.entries(PLACEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Textarea value={ad.content} onChange={(e) => setAd({ ...ad, content: e.target.value })} placeholder="Ad content" className="min-h-20 rounded-lg sm:col-span-2" maxLength={1000} aria-label="Ad content" />
          </div>
          <div className="flex gap-2">
            <Button className="rounded-lg bg-foreground text-background" disabled={busy || !ad.title.trim() || !ad.content.trim()} onClick={saveAd}><Plus className="mr-1 h-4 w-4" />{editingAd ? "Save advertisement" : "Publish advertisement"}</Button>
            {editingAd && <Button variant="ghost" className="rounded-lg" onClick={() => { setEditingAd(null); setAd({ title: "", content: "", placement: "SIDEBAR" }); }}>Cancel</Button>}
          </div>
          <div className="space-y-2">
            {ads.length === 0 && <p className="text-sm text-muted-foreground">No advertisements yet.</p>}
            {ads.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Switch size="sm" checked={a.active} aria-label={`Show ad: ${a.title}`} onCheckedChange={(v) => call(() => apiClient.patch("/admin/ads", { id: a.id, active: Boolean(v) }))} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{a.title}</p><Badge variant="outline" className="rounded-lg text-xs">{PLACEMENT[a.placement]}</Badge></div>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.content}</p>
                </div>
                <Button size="sm" variant="ghost" aria-label="Edit advertisement" onClick={() => { setEditingAd(a.id); setAd({ title: a.title, content: a.content, placement: a.placement }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label="Delete advertisement" onClick={() => remove("/admin/ads", a.id, `“${a.title}”`)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
