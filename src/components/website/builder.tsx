"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Save, Rocket, Eye, EyeOff,
  Pencil, Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { FacilityWebsiteRenderer } from "@/components/public/facility-website-renderer";
import {
  WEBSITE_BLOCK_TYPES, WEBSITE_ADDONS, ADDON_FOR_BLOCK,
  newWebsiteBlock, moveBlock, type WebsiteBlock, type WebsiteBlockType, type WebsiteLayout,
} from "@/lib/website/blocks";

interface WebsiteState {
  id: string;
  template: string;
  draftLayout: unknown;
  publishedLayout: unknown;
  addOns: string[];
  publishedAt: string | null;
  draftSavedAt: string | null;
}

interface TemplateInfo { key: string; name: string; description: string; blocks: string[] }
interface AddOnInfo { key: string; label: string; blocks: string[]; description: string }

const BLOCK_LABELS: Record<WebsiteBlockType, string> = {
  banner: "Banner",
  about: "Facility description",
  stats: "Statistics",
  departments: "Departments",
  doctors: "Doctors",
  services: "Services",
  "diagnostic-tests": "Diagnostic tests",
  "lab-services": "Laboratory services",
  hours: "Opening hours",
  contact: "Contact information",
  location: "Location",
  "appointment-booking": "Appointment booking",
  cta: "Call-to-action",
  gallery: "Gallery",
  faq: "FAQ",
};

export function WebsiteBuilder({ facility }: { facility: { id: string; slug: string | null; directory: string; isPublic: boolean; name: string; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; operatingHours: string | null } }) {
  const [website, setWebsite] = useState<WebsiteState | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [addOnCatalog, setAddOnCatalog] = useState<AddOnInfo[]>([]);
  const [blocks, setBlocks] = useState<WebsiteBlock[]>([]);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [templateKey, setTemplateKey] = useState("medical-centre");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const endpoint = `/facility/website?facilityId=${encodeURIComponent(facility.id)}`;
  const dragIndex = useRef<number | null>(null);

  const load = useCallback(() => {
    return apiClient.get<{ website: WebsiteState; templates: TemplateInfo[]; addOns: AddOnInfo[] }>(endpoint)
      .then((data) => {
        setWebsite(data.website);
        setTemplateKey(data.website.template);
        setTemplates(data.templates);
        setAddOnCatalog(data.addOns);
        const layout = data.website.draftLayout as WebsiteLayout | null;
        setBlocks(Array.isArray(layout?.blocks) ? layout.blocks : []);
        setAddOns(data.website.addOns ?? []);
        setSelectedId(layout?.blocks?.[0]?.id ?? null);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load your website. Check your connection and retry."))
      .finally(() => setLoading(false));
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => templateKey !== (website?.template ?? "medical-centre") || JSON.stringify(blocks) !== JSON.stringify((website?.draftLayout as WebsiteLayout | null)?.blocks ?? []) || JSON.stringify(addOns) !== JSON.stringify(website?.addOns ?? []), [blocks, addOns, website, templateKey]);

  const availableBlocks = useMemo(
    () => WEBSITE_BLOCK_TYPES.filter((t) => {
      const required = ADDON_FOR_BLOCK[t];
      return !required || addOns.includes(required);
    }),
    [addOns],
  );

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setFeedback("");
    try {
      const body = { template: templateKey, layout: { version: 1, blocks }, addOns };
      const data = await apiClient.put<{ website: { draftSavedAt: string | null } }>(endpoint, body);
      setWebsite((w) => (w ? { ...w, template: templateKey, draftLayout: { version: 1, blocks }, addOns, draftSavedAt: data.website.draftSavedAt } : w));
      toast.success("Draft saved. Changes are not public until you publish.");
      setFeedback("Draft saved. Changes are not public until you publish.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the draft");
      setFeedback(error instanceof Error ? error.message : "Could not save the draft. Retry without leaving this page.");
    } finally {
      setSaving(false);
    }
  }, [blocks, addOns, endpoint, templateKey]);

  const publish = useCallback(async () => {
    if (dirty) {
      toast.error("Save the draft first, then publish.");
      return;
    }
    setPublishing(true);
    setFeedback("");
    try {
      const data = await apiClient.post<{ website: { publishedAt: string } }>(endpoint, {});
      setWebsite((w) => (w ? { ...w, publishedAt: data.website.publishedAt } : w));
      toast.success("Your website is live.");
      setFeedback("Website sections published. Open your public website to review them.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
      setFeedback(error instanceof Error ? error.message : "Could not publish. Please retry.");
    } finally {
      setPublishing(false);
    }
  }, [dirty, endpoint]);

  const applyTemplate = (key: string) => {
    const template = templates.find((t) => t.key === key);
    if (!template) return;
    setTemplateKey(key);
    setAddOns([...new Set(template.blocks.flatMap((b) => {
      const addon = WEBSITE_ADDONS.find((a) => a.blocks.includes(b as never));
      return addon ? [addon.key] : [];
    }))]);
    setBlocks(template.blocks.map((b) => newWebsiteBlock(b as WebsiteBlockType)));
    setSelectedId(null);
  };

  const addBlock = (type: WebsiteBlockType) => {
    if (blocks.length >= 40) { toast.error("You can add up to 40 sections."); return; }
    const block = newWebsiteBlock(type);
    setBlocks((b) => [...b, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((b) => b.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    if (blocks.length >= 40) { toast.error("You can add up to 40 sections."); return; }
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const copy = newWebsiteBlock(block.type, block.settings);
    setBlocks((b) => [...b, copy]);
  };

  const toggleHidden = (id: string) => {
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, hidden: !x.hidden } : x)));
  };

  // Drag-and-drop (with move-up/move-down buttons as the accessible alternative)
  const onDragStart = (index: number) => { dragIndex.current = index; };
  const onDrop = (index: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === index) return;
    setBlocks((b) => {
      const next = [...b];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading your website builder…</p>;
  if (loadError) return <div className="space-y-3"><h1 className="text-xl font-bold">Facility website unavailable</h1><p role="alert">{loadError}</p><Button onClick={() => { setLoading(true); setLoadError(""); void load(); }}>Retry loading website</Button><Link href="/lab/dashboard" className="block underline">Back to dashboard</Link></div>;

  return (
    <div className="min-w-0 space-y-5 break-words">
      <Link href="/lab/dashboard" className="text-sm underline">Back to dashboard</Link>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="text-2xl font-bold">Facility website</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your public homepage. Drafts stay private until you publish.
            {website?.publishedAt
              ? ` Live since ${new Date(website.publishedAt).toLocaleString()}.`
              : " Not published yet."}
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "editor" | "preview")}>
          <TabsList>
            <TabsTrigger value="editor"><Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Editor</TabsTrigger>
            <TabsTrigger value="preview"><Eye aria-hidden="true" className="h-3.5 w-3.5" /> Live preview</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={saveDraft} disabled={saving || publishing || !dirty} data-testid="button-save-draft">
          <Save aria-hidden="true" className="h-4 w-4" /> {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
        </Button>
        <Button variant="default" onClick={publish} disabled={publishing || saving || dirty || !website} data-testid="button-publish">
          <Rocket aria-hidden="true" className="h-4 w-4" /> {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
      {feedback && <p role="status" className="rounded-lg border border-border p-3 text-sm">{feedback}</p>}
      {dirty && <p className="text-sm text-muted-foreground">Unsaved changes. Save your draft before publishing.</p>}
      {facility.isPublic && facility.slug ? <Link href={`/${facility.directory}/${facility.slug}`} target="_blank" rel="noopener noreferrer" className="inline-block text-sm underline">Open public website (new tab)</Link> : <p className="text-sm text-muted-foreground">Your facility profile must be verified and publicly listed before these sections can go live.</p>}

      {tab === "preview" ? (
        <Card className="beeline-card">
          <CardContent className="p-4">
            <p className="mb-4 text-xs text-muted-foreground">Preview of your homepage as it will appear once published.</p>
            <div className="rounded-xl border border-border p-4">
              <FacilityWebsiteRenderer
                layout={{ version: 1, blocks }}
                facility={{
                  id: facility.id,
                  laboratoryName: facility.name,
                  addressLine: facility.address,
                  city: facility.city,
                  state: facility.state,
                  phone: facility.phone,
                  email: facility.email,
                  operatingHours: facility.operatingHours,
                  logoUrl: null,
                }}
                directory={facility.directory}
                slug={facility.slug ?? ""}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          {/* Block list */}
          <div className="space-y-4">
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Homepage sections</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sections yet. Add one below or start from a template.</p>
                )}
                <ol className="space-y-2">
                  {blocks.map((block, index) => (
                    <li
                      key={block.id}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(index)}
                      className={`rounded-lg border p-2 ${selectedId === block.id ? "border-ring" : "border-border"} ${block.hidden ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="cursor-grab text-muted-foreground" aria-hidden="true"><GripVertical className="h-4 w-4" /></span>
                        <button
                          className="min-w-24 flex-1 text-left text-sm font-medium"
                          onClick={() => setSelectedId(block.id)}
                          aria-label={`Edit ${BLOCK_LABELS[block.type]} section`}
                        >
                          {index + 1}. {BLOCK_LABELS[block.type]}
                        </button>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button variant="ghost" size="sm" aria-label={`Move ${BLOCK_LABELS[block.type]} up`}
                            onClick={() => setBlocks((b) => moveBlock(b, index, -1))} disabled={index === 0}>
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`Move ${BLOCK_LABELS[block.type]} down`}
                            onClick={() => setBlocks((b) => moveBlock(b, index, 1))} disabled={index === blocks.length - 1}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={block.hidden ? `Show ${BLOCK_LABELS[block.type]}` : `Hide ${BLOCK_LABELS[block.type]}`} onClick={() => toggleHidden(block.id)}>
                            {block.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`Duplicate ${BLOCK_LABELS[block.type]}`} onClick={() => duplicateBlock(block.id)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`Remove ${BLOCK_LABELS[block.type]}`} onClick={() => removeBlock(block.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Add a section</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {availableBlocks.map((type) => (
                  <Button key={type} variant="outline" size="sm" onClick={() => addBlock(type)}>
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" /> {BLOCK_LABELS[type]}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => applyTemplate(t.key)}
                    className="rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right column: settings + add-ons */}
          <div className="space-y-4">
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Section settings</CardTitle></CardHeader>
              <CardContent>
                {selected ? (
                  <BlockSettingsEditor
                    block={selected}
                    onChange={(settings) => setBlocks((b) => b.map((x) => (x.id === selected.id ? { ...x, settings } : x)))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Select a section to configure it.</p>
                )}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Add-ons</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {addOnCatalog.map((addon) => (
                  <label key={addon.key} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={addOns.includes(addon.key)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...new Set([...addOns, addon.key])] : addOns.filter((a) => a !== addon.key);
                        setAddOns(next);
                        if (!e.target.checked) {
                          // Remove blocks that need this add-on
                          setBlocks((b) => b.filter((block) => ADDON_FOR_BLOCK[block.type] !== addon.key));
                        }
                      }}
                    />
                    <span>
                      <span className="font-medium">{addon.label}</span>
                      <span className="block text-xs text-muted-foreground">{addon.description}</span>
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockSettingsEditor({ block, onChange }: { block: WebsiteBlock; onChange: (settings: Record<string, unknown>) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...block.settings, [key]: value });
  const s = block.settings as Record<string, string | undefined>;

  switch (block.type) {
    case "banner":
    case "cta":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="bs-heading">Heading</Label><Input id="bs-heading" value={s.heading ?? ""} onChange={(e) => set("heading", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-sub">Text</Label><Input id="bs-sub" value={s.subheading ?? s.body ?? ""} onChange={(e) => set(block.type === "cta" ? "body" : "subheading", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-btn">Button label</Label><Input id="bs-btn" value={s.buttonLabel ?? ""} onChange={(e) => set("buttonLabel", e.target.value)} /></div>
          {block.type === "banner" && (
            <div className="space-y-1"><Label htmlFor="bs-img">Banner image URL</Label><Input id="bs-img" placeholder="https://…" value={s.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value)} /></div>
          )}
        </div>
      );
    case "about":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="bs-title">Title</Label><Input id="bs-title" value={s.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-body">Description</Label>
            <textarea id="bs-body" className="min-h-24 w-full rounded-lg border border-border bg-background p-2 text-sm" value={s.body ?? ""} onChange={(e) => set("body", e.target.value)} /></div>
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="bs-phone">Phone</Label><Input id="bs-phone" value={s.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-email">Email</Label><Input id="bs-email" type="email" value={s.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
      );
    case "location":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="bs-addr">Address</Label><Input id="bs-addr" value={s.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-map">Map link</Label><Input id="bs-map" placeholder="https://maps…" value={s.mapUrl ?? ""} onChange={(e) => set("mapUrl", e.target.value)} /></div>
        </div>
      );
    case "hours": {
      const rows = (block.settings as { rows?: { day: string; hours: string }[] }).rows ?? [];
      return (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Day ${i + 1}`} value={row.day} placeholder="Monday"
                onChange={(e) => set("rows", rows.map((r, j) => (i === j ? { ...r, day: e.target.value } : r)))} />
              <Input aria-label={`Hours ${i + 1}`} value={row.hours} placeholder="8:00 – 17:00"
                onChange={(e) => set("rows", rows.map((r, j) => (i === j ? { ...r, hours: e.target.value } : r)))} />
              <Button variant="ghost" size="sm" aria-label={`Remove row ${i + 1}`} onClick={() => set("rows", rows.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("rows", [...rows, { day: "", hours: "" }])}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add a row
          </Button>
        </div>
      );
    }
    case "stats":
    case "departments":
    case "faq": {
      const key = block.type === "faq" ? "items" : block.type === "stats" ? "items" : "items";
      const items = (block.settings as { items?: { label?: string; value?: string; name?: string; question?: string; description?: string; answer?: string }[] })[key] ?? [];
      const itemLabel = block.type === "faq" ? "question" : block.type === "stats" ? "label" : "name";
      const secondLabel = block.type === "faq" ? "answer" : block.type === "stats" ? "value" : "description";
      return (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-2">
              <Input aria-label={`${itemLabel} ${i + 1}`} value={(item as Record<string, string>)[itemLabel] ?? ""}
                onChange={(e) => set(key, items.map((it, j) => (i === j ? { ...it, [itemLabel]: e.target.value } : it)))} />
              <div className="flex gap-2">
                <Input aria-label={`${secondLabel} ${i + 1}`} value={(item as Record<string, string>)[secondLabel] ?? ""}
                  onChange={(e) => set(key, items.map((it, j) => (i === j ? { ...it, [secondLabel]: e.target.value } : it)))} />
                <Button variant="ghost" size="sm" aria-label={`Remove item ${i + 1}`} onClick={() => set(key, items.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set(key, [...items, block.type === "faq" ? { question: "", answer: "" } : block.type === "stats" ? { label: "", value: "" } : { name: "", description: "" }])}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add an item
          </Button>
        </div>
      );
    }
    default:
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="bs-title2">Title</Label><Input id="bs-title2" value={s.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-body2">Text</Label>
            <textarea id="bs-body2" className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm" value={s.body ?? ""} onChange={(e) => set("body", e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">This section also shows live data from your facility profile below it.</p>
        </div>
      );
  }
}
