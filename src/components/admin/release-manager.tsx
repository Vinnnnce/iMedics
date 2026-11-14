"use client";

// Administrator release management: create/edit app releases, publish or
// unpublish them, mark the current release per platform, and monitor
// download statistics. Files live in object storage or GitHub Release
// assets — this console manages the metadata that the download centre reads.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

type Release = {
  id: string;
  platform: string;
  channel: string;
  version: string;
  buildNumber: number;
  fileUrl: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  minOsVersion: string | null;
  releaseNotes: string;
  storeUrl: string | null;
  testFlightUrl: string | null;
  published: boolean;
  isCurrent: boolean;
  downloadCount: number;
  failureCount: number;
  releaseDate: string;
};

const PLATFORMS = ["ANDROID", "IOS", "WINDOWS"] as const;

const EMPTY_FORM = {
  platform: "ANDROID" as string,
  channel: "stable",
  version: "",
  buildNumber: 1,
  fileUrl: "",
  fileName: "",
  fileSizeBytes: "",
  checksumSha256: "",
  minOsVersion: "",
  releaseNotes: "",
  storeUrl: "",
  testFlightUrl: "",
  published: false,
  isCurrent: true,
};

export function ReleaseManager({ initialReleases }: { initialReleases: Release[] }) {
  const [releases, setReleases] = useState<Release[]>(initialReleases);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/app-releases");
    if (res.ok) {
      const data = await res.json();
      setReleases(data.releases);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const payload: Record<string, unknown> = {
      platform: form.platform,
      channel: form.channel,
      version: form.version,
      buildNumber: Number(form.buildNumber) || 1,
      releaseNotes: form.releaseNotes,
      published: form.published,
      isCurrent: form.isCurrent,
      fileUrl: form.fileUrl || null,
      fileName: form.fileName || null,
      storeUrl: form.storeUrl || null,
      testFlightUrl: form.testFlightUrl || null,
      checksumSha256: form.checksumSha256 || null,
      minOsVersion: form.minOsVersion || null,
    };
    if (form.fileSizeBytes) payload.fileSizeBytes = Number(form.fileSizeBytes);
    const res = await fetch(editing ? `/api/admin/app-releases/${editing}` : "/api/admin/app-releases", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setMessage(editing ? "Release updated." : "Release created.");
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      await refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error || "Failed to save release.");
    }
  }

  async function toggle(release: Release, field: "published" | "isCurrent") {
    setBusy(true);
    const res = await fetch(`/api/admin/app-releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !release[field] }),
    });
    setBusy(false);
    if (res.ok) await refresh();
  }

  async function remove(release: Release) {
    if (!confirm(`Delete release ${release.platform} ${release.version}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/app-releases/${release.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) await refresh();
  }

  function edit(release: Release) {
    setEditing(release.id);
    setForm({
      platform: release.platform,
      channel: release.channel,
      version: release.version,
      buildNumber: release.buildNumber,
      fileUrl: release.fileUrl || "",
      fileName: release.fileName || "",
      fileSizeBytes: release.fileSizeBytes ? String(release.fileSizeBytes) : "",
      checksumSha256: release.checksumSha256 || "",
      minOsVersion: release.minOsVersion || "",
      releaseNotes: release.releaseNotes,
      storeUrl: release.storeUrl || "",
      testFlightUrl: release.testFlightUrl || "",
      published: release.published,
      isCurrent: release.isCurrent,
    });
  }

  const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "Edit release" : "New release"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Platform</span>
            <select className={field} value={form.platform} disabled={!!editing} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Version</span>
            <input className={field} value={form.version} placeholder="1.0.0" onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Channel</span>
            <select className={field} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Build number</span>
            <input className={field} type="number" min={1} value={form.buildNumber} onChange={(e) => setForm({ ...form, buildNumber: Number(e.target.value) })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Installer URL (object storage / GitHub Release asset)</span>
            <input className={field} value={form.fileUrl} placeholder="https://…" onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">File name</span>
            <input className={field} value={form.fileName} placeholder="medic1905-1.0.0.apk" onChange={(e) => setForm({ ...form, fileName: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">File size (bytes)</span>
            <input className={field} value={form.fileSizeBytes} placeholder="52428800" onChange={(e) => setForm({ ...form, fileSizeBytes: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">SHA-256 checksum</span>
            <input className={field} value={form.checksumSha256} onChange={(e) => setForm({ ...form, checksumSha256: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Minimum OS version</span>
            <input className={field} value={form.minOsVersion} placeholder="8.0 / 15.0 / 10" onChange={(e) => setForm({ ...form, minOsVersion: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">App Store URL (iOS)</span>
            <input className={field} value={form.storeUrl} onChange={(e) => setForm({ ...form, storeUrl: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">TestFlight URL (iOS)</span>
            <input className={field} value={form.testFlightUrl} onChange={(e) => setForm({ ...form, testFlightUrl: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Release notes</span>
            <textarea className={`${field} min-h-24`} value={form.releaseNotes} onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })} />
          </label>
          <div className="flex items-center gap-6 text-sm md:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Published
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} />
              Current release for platform
            </label>
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button onClick={save} disabled={busy || !form.version}>{editing ? "Save changes" : "Create release"}</Button>
            {editing && (
              <Button variant="outline" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); }}>
                Cancel
              </Button>
            )}
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All releases &amp; download statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No releases yet. CI publishes releases automatically when a tagged build succeeds — or create one manually above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Platform</th>
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Channel</th>
                    <th className="py-2 pr-4">Size</th>
                    <th className="py-2 pr-4">Downloads</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Released</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2 pr-4 font-medium">{r.platform}</td>
                      <td className="py-2 pr-4">{r.version} (build {r.buildNumber})</td>
                      <td className="py-2 pr-4">{r.channel}</td>
                      <td className="py-2 pr-4">{formatBytes(r.fileSizeBytes) ?? "—"}</td>
                      <td className="py-2 pr-4">{r.downloadCount}</td>
                      <td className="py-2 pr-4">
                        <span className={r.published ? "text-success" : "text-muted-foreground"}>
                          {r.published ? "Published" : "Unpublished"}
                        </span>
                        {r.isCurrent && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">current</span>}
                      </td>
                      <td className="py-2 pr-4">{new Date(r.releaseDate).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => edit(r)}>Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => toggle(r, "published")} disabled={busy}>
                            {r.published ? "Unpublish" : "Publish"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggle(r, "isCurrent")} disabled={busy}>
                            {r.isCurrent ? "Unset current" : "Make current"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => remove(r)} disabled={busy}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
