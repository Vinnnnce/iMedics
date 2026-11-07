"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Save, Rocket, Eye, EyeOff,
  Pencil, Copy, Undo2, Redo2, ShoppingBag, Monitor, Smartphone, Lock, Sparkles,
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

/* ------------------------------------------------------------------ */
/* Facility account types                                              */
/* ------------------------------------------------------------------ */

export type FacilityAccountType =
  | "hospital"
  | "laboratory"
  | "diagnostic_centre"
  | "pharmacy"
  | "multi_facility";

export type AdvancedWebsiteBlockType =
  | "hero-carousel"
  | "image-carousel"
  | "testimonials"
  | "team"
  | "announcements"
  | "video"
  | "products"
  | "product-categories"
  | "featured-products"
  | "promotions"
  | "insurance"
  | "downloads"
  | "trust-badges"
  | "custom-section";

export type AllWebsiteBlockType = WebsiteBlockType | AdvancedWebsiteBlockType;

export const ADVANCED_WEBSITE_BLOCK_TYPES: AdvancedWebsiteBlockType[] = [
  "hero-carousel",
  "image-carousel",
  "testimonials",
  "team",
  "announcements",
  "video",
  "products",
  "product-categories",
  "featured-products",
  "promotions",
  "insurance",
  "downloads",
  "trust-badges",
  "custom-section",
];

export const ALL_WEBSITE_BLOCK_TYPES: AllWebsiteBlockType[] = [
  ...WEBSITE_BLOCK_TYPES,
  ...ADVANCED_WEBSITE_BLOCK_TYPES,
] as AllWebsiteBlockType[];

const BLOCK_LABELS: Record<AllWebsiteBlockType, string> = {
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

  "hero-carousel": "Hero carousel",
  "image-carousel": "Image carousel",
  testimonials: "Patient testimonials",
  team: "Care team",
  announcements: "Announcements",
  video: "Video",
  products: "Product catalogue",
  "product-categories": "Product categories",
  "featured-products": "Featured products",
  promotions: "Promotions",
  insurance: "Insurance & payment",
  downloads: "Downloads & forms",
  "trust-badges": "Trust badges",
  "custom-section": "Custom section",
};

/* ------------------------------------------------------------------ */
/* Feature shop                                                        */
/* ------------------------------------------------------------------ */

interface WebsiteFeature {
  key: string;
  label: string;
  description: string;
  price: string;
  blocks: AllWebsiteBlockType[];
  requiredAccountTypes?: FacilityAccountType[];
  badge?: "Popular" | "New" | "Premium";
}

const WEBSITE_FEATURE_SHOP: WebsiteFeature[] = [
  {
    key: "carousel_pro",
    label: "Advanced carousels",
    description: "Hero and image carousels with autoplay, navigation controls, captions and calls to action.",
    price: "Included with Growth",
    blocks: ["hero-carousel", "image-carousel"],
    badge: "Popular",
  },
  {
    key: "patient_engagement",
    label: "Patient engagement",
    description: "Testimonials, care-team profiles, announcements, videos and trust badges.",
    price: "Included with Growth",
    blocks: ["testimonials", "team", "announcements", "video", "trust-badges"],
  },
  {
    key: "pharmacy_commerce",
    label: "Pharmacy commerce",
    description: "Product catalogue, categories, featured products and promotional sections.",
    price: "From $19/month",
    blocks: ["products", "product-categories", "featured-products", "promotions"],
    requiredAccountTypes: ["pharmacy", "multi_facility"],
    badge: "Premium",
  },
  {
    key: "diagnostic_catalogue",
    label: "Diagnostic catalogue",
    description: "Present tests, packages, preparation instructions and booking journeys.",
    price: "Included with Growth",
    blocks: ["diagnostic-tests", "services", "appointment-booking"],
    requiredAccountTypes: ["laboratory", "diagnostic_centre", "multi_facility"],
  },
  {
    key: "hospital_departments",
    label: "Hospital departments",
    description: "Department directories, specialist profiles and clinical service navigation.",
    price: "Included with Growth",
    blocks: ["departments", "doctors", "services"],
    requiredAccountTypes: ["hospital", "multi_facility"],
  },
  {
    key: "insurance_payments",
    label: "Insurance & payments",
    description: "Insurance partners, payment options, downloadable forms and patient resources.",
    price: "Included with Growth",
    blocks: ["insurance", "downloads"],
  },
  {
    key: "custom_branding",
    label: "Custom sections",
    description: "Create flexible content sections for campaigns, partnerships, research or local services.",
    price: "From $9/month",
    blocks: ["custom-section"],
    badge: "New",
  },
];

const FEATURE_FOR_BLOCK: Partial<Record<AllWebsiteBlockType, string>> = {
  "hero-carousel": "carousel_pro",
  "image-carousel": "carousel_pro",
  testimonials: "patient_engagement",
  team: "patient_engagement",
  announcements: "patient_engagement",
  video: "patient_engagement",
  "trust-badges": "patient_engagement",
  products: "pharmacy_commerce",
  "product-categories": "pharmacy_commerce",
  "featured-products": "pharmacy_commerce",
  promotions: "pharmacy_commerce",
  "diagnostic-tests": "diagnostic_catalogue",
  "lab-services": "diagnostic_catalogue",
  departments: "hospital_departments",
  doctors: "hospital_departments",
  services: "hospital_departments",
  insurance: "insurance_payments",
  downloads: "insurance_payments",
  "custom-section": "custom_branding",
};

const ACCOUNT_TYPE_DEFAULT_FEATURES: Record<FacilityAccountType, string[]> = {
  hospital: ["hospital_departments", "patient_engagement"],
  laboratory: ["diagnostic_catalogue", "patient_engagement"],
  diagnostic_centre: ["diagnostic_catalogue", "patient_engagement"],
  pharmacy: ["pharmacy_commerce", "patient_engagement"],
  multi_facility: [
    "hospital_departments",
    "diagnostic_catalogue",
    "pharmacy_commerce",
    "patient_engagement",
    "carousel_pro",
  ],
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

interface FacilityProps {
  id: string;
  slug: string | null;
  directory: string;
  isPublic: boolean;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  operatingHours: string | null;
  accountType?: FacilityAccountType | string | null;
}

type PreviewDevice = "desktop" | "mobile";

const MAX_BLOCKS = 60;

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function WebsiteBuilder({ facility }: { facility: FacilityProps }) {
  const [website, setWebsite] = useState<WebsiteState | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [addOnCatalog, setAddOnCatalog] = useState<AddOnInfo[]>([]);
  const [blocks, setBlocks] = useState<WebsiteBlock[]>([]);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [templateKey, setTemplateKey] = useState("medical-centre");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"editor" | "preview" | "features">("editor");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [purchasingFeature, setPurchasingFeature] = useState<string | null>(null);

  const endpoint = `/facility/website?facilityId=${encodeURIComponent(facility.id)}`;
  const dragIndex = useRef<number | null>(null);

  const [history, setHistory] = useState<WebsiteBlock[][]>([]);
  const [future, setFuture] = useState<WebsiteBlock[][]>([]);

  const accountType = normalizeAccountType(facility.accountType);

  const load = useCallback(() => {
    return apiClient.get<{
      website: WebsiteState;
      templates: TemplateInfo[];
      addOns: AddOnInfo[];
    }>(endpoint)
      .then((data) => {
        setWebsite(data.website);
        setTemplateKey(data.website.template);
        setTemplates(data.templates);
        setAddOnCatalog(data.addOns);

        const layout = data.website.draftLayout as WebsiteLayout | null;
        const loadedBlocks = Array.isArray(layout?.blocks) ? layout.blocks : [];

        setBlocks(loadedBlocks);
        setAddOns(data.website.addOns?.length ? data.website.addOns : ACCOUNT_TYPE_DEFAULT_FEATURES[accountType]);
        setSelectedId(loadedBlocks[0]?.id ?? null);
        setHistory([]);
        setFuture([]);
      })
      .catch((error) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your website. Check your connection and retry.",
        );
      })
      .finally(() => setLoading(false));
  }, [endpoint, accountType]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownedFeatures = useMemo(
    () => new Set([...(website?.addOns ?? []), ...addOns]),
    [website?.addOns, addOns],
  );

  const dirty = useMemo(() => {
    const originalBlocks = (website?.draftLayout as WebsiteLayout | null)?.blocks ?? [];
    return (
      templateKey !== (website?.template ?? "medical-centre") ||
      JSON.stringify(blocks) !== JSON.stringify(originalBlocks) ||
      JSON.stringify(addOns) !== JSON.stringify(website?.addOns ?? [])
    );
  }, [blocks, addOns, website, templateKey]);

  const availableBlocks = useMemo(
    () => ALL_WEBSITE_BLOCK_TYPES.filter((type) => {
      const requiredFeature = FEATURE_FOR_BLOCK[type];
      const allowedForAccount =
        !requiredFeature ||
        !WEBSITE_FEATURE_SHOP.find((f) => f.key === requiredFeature)?.requiredAccountTypes?.length ||
        WEBSITE_FEATURE_SHOP
          .find((f) => f.key === requiredFeature)
          ?.requiredAccountTypes?.includes(accountType);

      return allowedForAccount && (!requiredFeature || ownedFeatures.has(requiredFeature));
    }),
    [accountType, ownedFeatures],
  );

  const lockedBlocks = useMemo(
    () => ALL_WEBSITE_BLOCK_TYPES.filter((type) => !availableBlocks.includes(type)),
    [availableBlocks],
  );

  const updateBlocks = useCallback((next: WebsiteBlock[]) => {
    setHistory((past) => [...past.slice(-24), blocks]);
    setFuture([]);
    setBlocks(next);
  }, [blocks]);

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((past) => past.slice(0, -1));
    setFuture((next) => [blocks, ...next]);
    setBlocks(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const nextBlocks = future[0];
    setFuture((next) => next.slice(1));
    setHistory((past) => [...past, blocks]);
    setBlocks(nextBlocks);
  };

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setFeedback("");

    try {
      const body = {
        template: templateKey,
        layout: { version: 1, blocks },
        addOns,
      };

      const data = await apiClient.put<{ website: { draftSavedAt: string | null } }>(endpoint, body);

      setWebsite((current) =>
        current
          ? {
              ...current,
              template: templateKey,
              draftLayout: { version: 1, blocks },
              addOns,
              draftSavedAt: data.website.draftSavedAt,
            }
          : current,
      );

      toast.success("Draft saved. Changes are not public until you publish.");
      setFeedback("Draft saved. Changes are not public until you publish.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the draft";
      toast.error(message);
      setFeedback(`${message}. Retry without leaving this page.`);
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
      setWebsite((current) =>
        current ? { ...current, publishedAt: data.website.publishedAt } : current,
      );
      toast.success("Your website is live.");
      setFeedback("Website sections published. Open your public website to review them.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish";
      toast.error(message);
      setFeedback(`${message}. Please retry.`);
    } finally {
      setPublishing(false);
    }
  }, [dirty, endpoint]);

  const purchaseFeature = useCallback(async (featureKey: string) => {
    const feature = WEBSITE_FEATURE_SHOP.find((item) => item.key === featureKey);
    if (!feature) return;

    setPurchasingFeature(featureKey);
    setFeedback("");

    try {
      await apiClient.post(`${endpoint}/features/purchase`, { featureKey });

      setAddOns((current) => [...new Set([...current, featureKey])]);
      setWebsite((current) =>
        current ? { ...current, addOns: [...new Set([...(current.addOns ?? []), featureKey])] } : current,
      );

      toast.success(`${feature.label} unlocked.`);
      setFeedback(`${feature.label} is now available in your website builder.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not activate this feature";
      toast.error(message);
      setFeedback(message);
    } finally {
      setPurchasingFeature(null);
    }
  }, [endpoint]);

  const applyTemplate = (key: string) => {
    const template = templates.find((item) => item.key === key);
    if (!template) return;

    const templateFeatures = [...new Set(
      template.blocks.flatMap((block) => {
        const feature = FEATURE_FOR_BLOCK[block as AllWebsiteBlockType];
        return feature ? [feature] : [];
      }),
    )].filter((feature) => ownedFeatures.has(feature));

    setTemplateKey(key);
    setAddOns((current) => [...new Set([...current, ...templateFeatures])]);
    updateBlocks(template.blocks.map((block) => newWebsiteBlock(block as WebsiteBlockType)));
    setSelectedId(null);
  };

  const addBlock = (type: AllWebsiteBlockType) => {
    if (blocks.length >= MAX_BLOCKS) {
      toast.error(`You can add up to ${MAX_BLOCKS} sections.`);
      return;
    }

    const block = newWebsiteBlock(type as WebsiteBlockType);
    updateBlocks([...blocks, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    updateBlocks(blocks.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    if (blocks.length >= MAX_BLOCKS) {
      toast.error(`You can add up to ${MAX_BLOCKS} sections.`);
      return;
    }

    const block = blocks.find((item) => item.id === id);
    if (!block) return;

    const copy = newWebsiteBlock(block.type, block.settings);
    updateBlocks([...blocks, copy]);
  };

  const toggleHidden = (id: string) => {
    updateBlocks(blocks.map((block) =>
      block.id === id ? { ...block, hidden: !block.hidden } : block,
    ));
  };

  const onDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const onDrop = (index: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;

    if (from == null || from === index) return;

    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);

    updateBlocks(next);
  };

  const selected = blocks.find((block) => block.id === selectedId) ?? null;

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading your website builder…
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Facility website unavailable</h1>
        <p role="alert">{loadError}</p>
        <Button
          onClick={() => {
            setLoading(true);
            setLoadError("");
            void load();
          }}
        >
          Retry loading website
        </Button>
        <Link href="/lab/dashboard" className="block underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 break-words">
      <Link href="/lab/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="text-2xl font-bold">Facility website</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a public website for your {formatAccountType(accountType)}.
            Drafts stay private until you publish.
            {website?.publishedAt
              ? ` Live since ${new Date(website.publishedAt).toLocaleString()}.`
              : " Not published yet."}
          </p>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="editor">
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Editor
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Live preview
            </TabsTrigger>
            <TabsTrigger value="features">
              <ShoppingBag aria-hidden="true" className="h-3.5 w-3.5" /> Features
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="outline"
          onClick={undo}
          disabled={!history.length || saving || publishing}
          aria-label="Undo last change"
        >
          <Undo2 aria-hidden="true" className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          onClick={redo}
          disabled={!future.length || saving || publishing}
          aria-label="Redo change"
        >
          <Redo2 aria-hidden="true" className="h-4 w-4" />
        </Button>

        <Button
          onClick={saveDraft}
          disabled={saving || publishing || !dirty}
          data-testid="button-save-draft"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
        </Button>

        <Button
          variant="default"
          onClick={publish}
          disabled={publishing || saving || dirty || !website}
          data-testid="button-publish"
        >
          <Rocket aria-hidden="true" className="h-4 w-4" />
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>

      {feedback && (
        <p role="status" className="rounded-lg border border-border p-3 text-sm">
          {feedback}
        </p>
      )}

      {dirty && (
        <p className="text-sm text-muted-foreground">
          Unsaved changes. Save your draft before publishing.
        </p>
      )}

      {facility.isPublic && facility.slug ? (
        <Link
          href={`/${facility.directory}/${facility.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm underline"
        >
          Open public website (new tab)
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your facility profile must be verified and publicly listed before these sections can go live.
        </p>
      )}

      {tab === "features" ? (
        <FeatureShop
          accountType={accountType}
          ownedFeatures={ownedFeatures}
          purchasingFeature={purchasingFeature}
          onPurchase={purchaseFeature}
        />
      ) : tab === "preview" ? (
        <Card className="beeline-card">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Preview of your homepage as it will appear once published.
              </p>

              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDevice("desktop")}
                  aria-pressed={device === "desktop"}
                >
                  <Monitor aria-hidden="true" className="h-4 w-4" /> Desktop
                </Button>
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDevice("mobile")}
                  aria-pressed={device === "mobile"}
                >
                  <Smartphone aria-hidden="true" className="h-4 w-4" /> Mobile
                </Button>
              </div>
            </div>

            <div
              className={`mx-auto rounded-xl border border-border p-4 transition-all ${
                device === "mobile" ? "max-w-sm" : "w-full"
              }`}
            >
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
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="space-y-4">
            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Homepage sections</CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">
                {blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sections yet. Add one below or start from a template.
                  </p>
                )}

                <ol className="space-y-2">
                  {blocks.map((block, index) => (
                    <li
                      key={block.id}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onDrop(index)}
                      className={`rounded-lg border p-2 ${
                        selectedId === block.id ? "border-ring" : "border-border"
                      } ${block.hidden ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="cursor-grab text-muted-foreground"
                          aria-hidden="true"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>

                        <button
                          className="min-w-24 flex-1 text-left text-sm font-medium"
                          onClick={() => setSelectedId(block.id)}
                          aria-label={`Edit ${BLOCK_LABELS[block.type as AllWebsiteBlockType]} section`}
                        >
                          {index + 1}. {BLOCK_LABELS[block.type as AllWebsiteBlockType]}
                        </button>

                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Move ${BLOCK_LABELS[block.type as AllWebsiteBlockType]} up`}
                            onClick={() => updateBlocks(moveBlock(blocks, index, -1))}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Move ${BLOCK_LABELS[block.type as AllWebsiteBlockType]} down`}
                            onClick={() => updateBlocks(moveBlock(blocks, index, 1))}
                            disabled={index === blocks.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={
                              block.hidden
                                ? `Show ${BLOCK_LABELS[block.type as AllWebsiteBlockType]}`
                                : `Hide ${BLOCK_LABELS[block.type as AllWebsiteBlockType]}`
                            }
                            onClick={() => toggleHidden(block.id)}
                          >
                            {block.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Duplicate ${BLOCK_LABELS[block.type as AllWebsiteBlockType]}`}
                            onClick={() => duplicateBlock(block.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${BLOCK_LABELS[block.type as AllWebsiteBlockType]}`}
                            onClick={() => removeBlock(block.id)}
                          >
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
              <CardHeader>
                <CardTitle className="text-base">Add a section</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {availableBlocks.map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock(type)}
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                      {BLOCK_LABELS[type]}
                    </Button>
                  ))}
                </div>

                {lockedBlocks.length > 0 && (
                  <div className="rounded-lg border border-dashed border-border p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Lock aria-hidden="true" className="h-4 w-4" />
                      Features available in the shop
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {lockedBlocks.slice(0, 8).map((type) => (
                        <Button
                          key={type}
                          variant="ghost"
                          size="sm"
                          onClick={() => setTab("features")}
                        >
                          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                          {BLOCK_LABELS[type]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Templates</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    onClick={() => applyTemplate(template.key)}
                    className="rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Section settings</CardTitle>
              </CardHeader>

              <CardContent>
                {selected ? (
                  <BlockSettingsEditor
                    block={selected}
                    onChange={(settings) => {
                      updateBlocks(blocks.map((block) =>
                        block.id === selected.id ? { ...block, settings } : block,
                      ));
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a section to configure it.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Included add-ons</CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">
                {addOnCatalog.map((addon) => (
                  <label
                    key={addon.key}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={addOns.includes(addon.key)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...new Set([...addOns, addon.key])]
                          : addOns.filter((item) => item !== addon.key);

                        setAddOns(next);

                        if (!event.target.checked) {
                          updateBlocks(
                            blocks.filter(
                              (block) => ADDON_FOR_BLOCK[block.type as WebsiteBlockType] !== addon.key,
                            ),
                          );
                        }
                      }}
                    />

                    <span>
                      <span className="font-medium">{addon.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {addon.description}
                      </span>
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

/* ------------------------------------------------------------------ */
/* Feature shop                                                        */
/* ------------------------------------------------------------------ */

function FeatureShop({
  accountType,
  ownedFeatures,
  purchasingFeature,
  onPurchase,
}: {
  accountType: FacilityAccountType;
  ownedFeatures: Set<string>;
  purchasingFeature: string | null;
  onPurchase: (featureKey: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-base">Website features</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your {formatAccountType(accountType)} account includes a tailored set of website
            capabilities. Activate additional features when you need richer marketing, commerce
            or patient-engagement tools.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {WEBSITE_FEATURE_SHOP.map((feature) => {
          const owned = ownedFeatures.has(feature.key);
          const restricted =
            feature.requiredAccountTypes?.length &&
            !feature.requiredAccountTypes.includes(accountType);

          return (
            <Card key={feature.key} className="beeline-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{feature.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>

                  {feature.badge && (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {feature.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Includes: {feature.blocks.map((block) => BLOCK_LABELS[block]).join(", ")}
                </p>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{feature.price}</span>

                  {owned ? (
                    <span className="text-sm text-muted-foreground">Active</span>
                  ) : restricted ? (
                    <span className="text-xs text-muted-foreground">
                      Not available for this account type
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onPurchase(feature.key)}
                      disabled={purchasingFeature === feature.key}
                    >
                      {purchasingFeature === feature.key ? "Activating…" : "Activate"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings editor                                                     */
/* ------------------------------------------------------------------ */

function BlockSettingsEditor({
  block,
  onChange,
}: {
  block: WebsiteBlock;
  onChange: (settings: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) =>
    onChange({ ...block.settings, [key]: value });

  const s = block.settings as Record<string, unknown>;
  const text = (key: string) => (typeof s[key] === "string" ? (s[key] as string) : "");

  switch (block.type as AllWebsiteBlockType) {
    case "banner":
    case "cta":
      return (
        <div className="space-y-3">
          <Field
            id="bs-heading"
            label="Heading"
            value={text("heading")}
            onChange={(value) => set("heading", value)}
          />

          <Field
            id="bs-sub"
            label="Text"
            value={text(block.type === "cta" ? "body" : "subheading")}
            onChange={(value) =>
              set(block.type === "cta" ? "body" : "subheading", value)
            }
          />

          <Field
            id="bs-btn"
            label="Button label"
            value={text("buttonLabel")}
            onChange={(value) => set("buttonLabel", value)}
          />

          {block.type === "banner" && (
            <Field
              id="bs-img"
              label="Banner image URL"
              placeholder="https://…"
              value={text("imageUrl")}
              onChange={(value) => set("imageUrl", value)}
            />
          )}
        </div>
      );

    case "hero-carousel":
    case "image-carousel": {
      const slides = getArray<Record<string, string>>(s.slides);

      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">Carousel slides</p>

          {slides.map((slide, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <Field
                id={`slide-image-${index}`}
                label={`Slide ${index + 1} image URL`}
                value={slide.imageUrl ?? ""}
                onChange={(value) =>
                  set("slides", updateItem(slides, index, { imageUrl: value }))
                }
              />

              <Field
                id={`slide-title-${index}`}
                label="Title"
                value={slide.title ?? ""}
                onChange={(value) =>
                  set("slides", updateItem(slides, index, { title: value }))
                }
              />

              <Field
                id={`slide-sub-${index}`}
                label="Subtitle"
                value={slide.subtitle ?? ""}
                onChange={(value) =>
                  set("slides", updateItem(slides, index, { subtitle: value }))
                }
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  id={`slide-cta-${index}`}
                  label="Button label"
                  value={slide.ctaLabel ?? ""}
                  onChange={(value) =>
                    set("slides", updateItem(slides, index, { ctaLabel: value }))
                  }
                />

                <Field
                  id={`slide-url-${index}`}
                  label="Button link"
                  value={slide.ctaUrl ?? ""}
                  onChange={(value) =>
                    set("slides", updateItem(slides, index, { ctaUrl: value }))
                  }
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => set("slides", slides.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
                Remove slide
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set("slides", [...slides, { imageUrl: "", title: "", subtitle: "", ctaLabel: "", ctaUrl: "" }])
            }
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add slide
          </Button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(s.autoplay)}
              onChange={(event) => set("autoplay", event.target.checked)}
            />
            Autoplay carousel
          </label>

          <Field
            id="carousel-interval"
            label="Autoplay interval (seconds)"
            type="number"
            value={String(s.intervalSeconds ?? 6)}
            onChange={(value) => set("intervalSeconds", Number(value) || 6)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.showArrows !== false}
              onChange={(event) => set("showArrows", event.target.checked)}
            />
            Show navigation arrows
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.showDots !== false}
              onChange={(event) => set("showDots", event.target.checked)}
            />
            Show slide indicators
          </label>
        </div>
      );
    }

    case "testimonials": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "name", label: "Patient name" },
            { key: "quote", label: "Testimonial" },
            { key: "role", label: "Treatment or service" },
          ]}
          onAdd={() => ({ name: "", quote: "", role: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "team": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role or specialty" },
            { key: "imageUrl", label: "Photo URL" },
          ]}
          onAdd={() => ({ name: "", role: "", imageUrl: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "announcements": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "title", label: "Announcement" },
            { key: "body", label: "Details" },
            { key: "ctaUrl", label: "Link" },
          ]}
          onAdd={() => ({ title: "", body: "", ctaUrl: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "products":
    case "featured-products": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "name", label: "Product name" },
            { key: "price", label: "Price" },
            { key: "description", label: "Description" },
            { key: "imageUrl", label: "Image URL" },
            { key: "ctaUrl", label: "Product link" },
          ]}
          onAdd={() => ({ name: "", price: "", description: "", imageUrl: "", ctaUrl: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "product-categories": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "name", label: "Category" },
            { key: "description", label: "Description" },
            { key: "imageUrl", label: "Image URL" },
            { key: "ctaUrl", label: "Category link" },
          ]}
          onAdd={() => ({ name: "", description: "", imageUrl: "", ctaUrl: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "promotions": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "title", label: "Promotion" },
            { key: "description", label: "Details" },
            { key: "ctaLabel", label: "Button label" },
            { key: "ctaUrl", label: "Button link" },
          ]}
          onAdd={() => ({ title: "", description: "", ctaLabel: "", ctaUrl: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "insurance": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "name", label: "Insurer or payment method" },
            { key: "description", label: "Coverage details" },
          ]}
          onAdd={() => ({ name: "", description: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "downloads": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "label", label: "Document name" },
            { key: "url", label: "File or form URL" },
          ]}
          onAdd={() => ({ label: "", url: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "video":
      return (
        <div className="space-y-3">
          <Field
            id="video-title"
            label="Title"
            value={text("title")}
            onChange={(value) => set("title", value)}
          />

          <Field
            id="video-url"
            label="Video embed URL"
            placeholder="https://…"
            value={text("videoUrl")}
            onChange={(value) => set("videoUrl", value)}
          />

          <Field
            id="video-description"
            label="Description"
            value={text("body")}
            onChange={(value) => set("body", value)}
          />
        </div>
      );

    case "trust-badges": {
      const items = getArray<Record<string, string>>(s.items);

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: "label", label: "Badge label" },
            { key: "description", label: "Description" },
          ]}
          onAdd={() => ({ label: "", description: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "about":
      return (
        <div className="space-y-3">
          <Field
            id="bs-title"
            label="Title"
            value={text("title")}
            onChange={(value) => set("title", value)}
          />

          <Field
            id="bs-body"
            label="Description"
            multiline
            value={text("body")}
            onChange={(value) => set("body", value)}
          />
        </div>
      );

    case "contact":
      return (
        <div className="space-y-3">
          <Field
            id="bs-phone"
            label="Phone"
            value={text("phone")}
            onChange={(value) => set("phone", value)}
          />

          <Field
            id="bs-email"
            label="Email"
            type="email"
            value={text("email")}
            onChange={(value) => set("email", value)}
          />
        </div>
      );

    case "location":
      return (
        <div className="space-y-3">
          <Field
            id="bs-addr"
            label="Address"
            value={text("address")}
            onChange={(value) => set("address", value)}
          />

          <Field
            id="bs-map"
            label="Map link"
            placeholder="https://maps…"
            value={text("mapUrl")}
            onChange={(value) => set("mapUrl", value)}
          />
        </div>
      );

    case "hours": {
      const rows = getArray<{ day: string; hours: string }>(s.rows);

      return (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Day ${index + 1}`}
                value={row.day}
                placeholder="Monday"
                onChange={(event) =>
                  set(
                    "rows",
                    updateItem(rows, index, { ...row, day: event.target.value }),
                  )
                }
              />

              <Input
                aria-label={`Hours ${index + 1}`}
                value={row.hours}
                placeholder="8:00 – 17:00"
                onChange={(event) =>
                  set(
                    "rows",
                    updateItem(rows, index, { ...row, hours: event.target.value }),
                  )
                }
              />

              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove row ${index + 1}`}
                onClick={() => set("rows", rows.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => set("rows", [...rows, { day: "", hours: "" }])}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add a row
          </Button>
        </div>
      );
    }

    case "stats":
    case "departments":
    case "faq": {
      const items = getArray<Record<string, string>>(s.items);
      const itemLabel = block.type === "faq" ? "question" : block.type === "stats" ? "label" : "name";
      const secondLabel = block.type === "faq" ? "answer" : block.type === "stats" ? "value" : "description";

      return (
        <RepeatableTextEditor
          items={items}
          fields={[
            { key: itemLabel, label: itemLabel === "question" ? "Question" : itemLabel === "label" ? "Label" : "Name" },
            { key: secondLabel, label: secondLabel === "answer" ? "Answer" : secondLabel === "value" ? "Value" : "Description" },
          ]}
          onAdd={() => ({ [itemLabel]: "", [secondLabel]: "" })}
          onChange={(items) => set("items", items)}
          onRemove={(items) => set("items", items)}
        />
      );
    }

    case "custom-section":
      return (
        <div className="space-y-3">
          <Field
            id="custom-title"
            label="Title"
            value={text("title")}
            onChange={(value) => set("title", value)}
          />

          <Field
            id="custom-body"
            label="Content"
            multiline
            value={text("body")}
            onChange={(value) => set("body", value)}
          />

          <Field
            id="custom-cta"
            label="Button label"
            value={text("ctaLabel")}
            onChange={(value) => set("ctaLabel", value)}
          />

          <Field
            id="custom-url"
            label="Button link"
            value={text("ctaUrl")}
            onChange={(value) => set("ctaUrl", value)}
          />
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          <Field
            id="bs-title2"
            label="Title"
            value={text("title")}
            onChange={(value) => set("title", value)}
          />

          <Field
            id="bs-body2"
            label="Text"
            multiline
            value={text("body")}
            onChange={(value) => set("body", value)}
          />

          <p className="text-xs text-muted-foreground">
            This section also shows live data from your facility profile below it.
          </p>
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Small reusable editors                                              */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>

      {multiline ? (
        <textarea
          id={id}
          className="min-h-24 w-full rounded-lg border border-border bg-background p-2 text-sm"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function RepeatableTextEditor({
  items,
  fields,
  onAdd,
  onChange,
  onRemove,
}: {
  items: Record<string, string>[];
  fields: { key: string; label: string }[];
  onAdd: () => Record<string, string>;
  onChange: (items: Record<string, string>[]) => void;
  onRemove: (items: Record<string, string>[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
          {fields.map((field) => (
            <Field
              key={field.key}
              id={`${field.key}-${index}`}
              label={field.label}
              value={item[field.key] ?? ""}
              onChange={(value) =>
                onChange(updateItem(items, index, { ...item, [field.key]: value }))
              }
            />
          ))}

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove item ${index + 1}`}
            onClick={() => onRemove(items.filter((_, i) => i !== index))}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
            Remove
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={() => onChange([...items, onAdd()])}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add an item
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function normalizeAccountType(value: FacilityProps["accountType"]): FacilityAccountType {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");

  if (
    normalized === "hospital" ||
    normalized === "laboratory" ||
    normalized === "diagnostic_centre" ||
    normalized === "pharmacy" ||
    normalized === "multi_facility"
  ) {
    return normalized;
  }

  return "multi_facility";
}

function formatAccountType(accountType: FacilityAccountType) {
  return accountType.replace(/_/g, " ");
}

function getArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function updateItem<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, i) => (i === index ? next : item));
}
