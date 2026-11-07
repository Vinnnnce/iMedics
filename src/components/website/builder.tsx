"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Save, Rocket, Eye, EyeOff,
  Pencil, Copy, ShoppingBag, Layout, Shield, Image as ImageIcon, Menu, PanelLeft,
  PanelBottom, Sparkles, Lock,
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
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FacilityKind = "hospital" | "laboratory" | "diagnostic_centre" | "pharmacy" | "multi_facility";

type AccountTier = "free" | "standard" | "professional" | "enterprise";

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
  facilityKind?: FacilityKind;
  accountTier?: AccountTier;
  ownedFeatures?: string[];
}

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

interface FeatureProduct {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  requiredTier: AccountTier;
  facilityKinds: FacilityKind[];
  addonKeys: string[];
}

interface Branding {
  logoUrl: string;
  logoAlt: string;
  primaryColor: string;
  accentColor: string;
  navbarTitle: string;
  navbarLinks: NavbarLink[];
  showSidebar: boolean;
  sidebarTitle: string;
  sidebarLinks: NavbarLink[];
  footerTitle: string;
  footerText: string;
  footerLinks: NavbarLink[];
  socialLinks: SocialLink[];
}

interface NavbarLink { label: string; href: string }
interface SocialLink { platform: string; href: string }

interface PolicyContent {
  privacyPolicy: string;
  termsOfUse: string;
  cookiePolicy: string;
}

/* ------------------------------------------------------------------ */
/* Facility feature catalogue                                          */
/* ------------------------------------------------------------------ */

const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  hospital: "Hospital",
  laboratory: "Laboratory",
  diagnostic_centre: "Diagnostic centre",
  pharmacy: "Pharmacy",
  multi_facility: "Multi-facility group",
};

const TIER_RANK: Record<AccountTier, number> = {
  free: 0,
  standard: 1,
  professional: 2,
  enterprise: 3,
};

const FEATURE_CATALOG: FeatureProduct[] = [
  {
    key: "online_booking",
    name: "Online appointment booking",
    description: "Let patients request appointments directly from the website.",
    priceMonthly: 29,
    requiredTier: "standard",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "multi_facility"],
    addonKeys: ["booking"],
  },
  {
    key: "test_catalogue",
    name: "Test & diagnostic catalogue",
    description: "Publish searchable tests, panels, preparation instructions and prices.",
    priceMonthly: 39,
    requiredTier: "standard",
    facilityKinds: ["laboratory", "diagnostic_centre", "hospital", "multi_facility"],
    addonKeys: ["diagnostics"],
  },
  {
    key: "pharmacy_catalogue",
    name: "Pharmacy product catalogue",
    description: "Display medicines, wellness products, categories and availability.",
    priceMonthly: 35,
    requiredTier: "standard",
    facilityKinds: ["pharmacy", "multi_facility"],
    addonKeys: ["pharmacy"],
  },
  {
    key: "doctor_directory",
    name: "Doctor & specialist directory",
    description: "Show departments, consultants, specialties, profiles and availability.",
    priceMonthly: 45,
    requiredTier: "professional",
    facilityKinds: ["hospital", "multi_facility"],
    addonKeys: ["clinical"],
  },
  {
    key: "department_pages",
    name: "Department & service pages",
    description: "Create rich pages for cardiology, radiology, pathology and more.",
    priceMonthly: 49,
    requiredTier: "professional",
    facilityKinds: ["hospital", "diagnostic_centre", "multi_facility"],
    addonKeys: ["clinical"],
  },
  {
    key: "insurance_providers",
    name: "Insurance & payment partners",
    description: "Display accepted insurers, payment methods and coverage guidance.",
    priceMonthly: 25,
    requiredTier: "standard",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "pharmacy", "multi_facility"],
    addonKeys: ["payments"],
  },
  {
    key: "image_carousel",
    name: "Advanced image carousel",
    description: "Create autoplaying, swipeable galleries with captions and calls to action.",
    priceMonthly: 19,
    requiredTier: "standard",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "pharmacy", "multi_facility"],
    addonKeys: ["carousel"],
  },
  {
    key: "custom_branding",
    name: "Custom branding & layout",
    description: "Upload a logo, set brand colors and customize navigation, sidebar and footer.",
    priceMonthly: 39,
    requiredTier: "professional",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "pharmacy", "multi_facility"],
    addonKeys: [],
  },
  {
    key: "policy_editor",
    name: "Policy & compliance editor",
    description: "Publish privacy policy, terms of use and cookie policy pages.",
    priceMonthly: 15,
    requiredTier: "standard",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "pharmacy", "multi_facility"],
    addonKeys: [],
  },
  {
    key: "multi_location",
    name: "Multi-location directory",
    description: "Manage and display multiple branches, opening hours and contact details.",
    priceMonthly: 59,
    requiredTier: "enterprise",
    facilityKinds: ["hospital", "laboratory", "diagnostic_centre", "pharmacy", "multi_facility"],
    addonKeys: [],
  },
];

const ADDON_LABELS: Record<string, string> = {
  booking: "Appointment booking",
  diagnostics: "Diagnostics & tests",
  pharmacy: "Pharmacy catalogue",
  clinical: "Doctors & departments",
  payments: "Insurance & payments",
  carousel: "Image carousel",
};

/* ------------------------------------------------------------------ */
/* Extended block types                                                */
/* ------------------------------------------------------------------ */

const EXTENDED_BLOCK_LABELS: Record<string, string> = {
  ...({
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
  } as Record<WebsiteBlockType, string>),
  carousel: "Image carousel",
  "test-catalogue": "Test catalogue",
  "pharmacy-catalogue": "Pharmacy catalogue",
  insurance: "Insurance & payments",
  "department-pages": "Department pages",
  "multi-location": "Multi-location directory",
  testimonials: "Patient testimonials",
  team: "Care team",
  "service-areas": "Service areas",
  "downloadable-forms": "Downloadable forms",
  "health-tips": "Health tips",
  "emergency-banner": "Emergency banner",
  "video-embed": "Video",
  "custom-html": "Custom content",
};

const BLOCK_LABELS = EXTENDED_BLOCK_LABELS as Record<WebsiteBlockType, string>;

const FEATURE_BLOCK_MAP: Record<string, string[]> = {
  online_booking: ["appointment-booking"],
  test_catalogue: ["diagnostic-tests", "lab-services", "test-catalogue"],
  pharmacy_catalogue: ["pharmacy-catalogue"],
  doctor_directory: ["doctors", "team"],
  department_pages: ["departments", "department-pages"],
  insurance_providers: ["insurance"],
  image_carousel: ["carousel", "gallery"],
  multi_location: ["multi-location", "location"],
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function WebsiteBuilder({ facility }: { facility: FacilityProps }) {
  const facilityKind: FacilityKind = facility.facilityKind ?? "laboratory";
  const accountTier: AccountTier = facility.accountTier ?? "free";
  const ownedFeatures = useMemo(() => new Set(facility.ownedFeatures ?? []), [facility.ownedFeatures]);

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

  const [branding, setBranding] = useState<Branding>({
    logoUrl: "",
    logoAlt: "",
    primaryColor: "#0f766e",
    accentColor: "#0ea5e9",
    navbarTitle: facility.name,
    navbarLinks: [
      { label: "Home", href: "/" },
      { label: "Services", href: "#services" },
      { label: "Contact", href: "#contact" },
    ],
    showSidebar: false,
    sidebarTitle: "Quick links",
    sidebarLinks: [
      { label: "Book appointment", href: "#book" },
      { label: "Opening hours", href: "#hours" },
    ],
    footerTitle: facility.name,
    footerText: "Providing trusted healthcare services.",
    footerLinks: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Cookie policy", href: "/cookies" },
    ],
    socialLinks: [],
  });

  const [policies, setPolicies] = useState<PolicyContent>({
    privacyPolicy: "",
    termsOfUse: "",
    cookiePolicy: "",
  });

  const endpoint = `/facility/website?facilityId=${encodeURIComponent(facility.id)}`;
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const canUseFeature = useCallback(
    (featureKey: string) => {
      const product = FEATURE_CATALOG.find((item) => item.key === featureKey);
      if (!product) return false;
      return ownedFeatures.has(featureKey) || TIER_RANK[accountTier] >= TIER_RANK[product.requiredTier];
    },
    [accountTier, ownedFeatures],
  );

  const availableBlocks = useMemo(() => {
    const addonAllowed = (type: string) => {
      const required = ADDON_FOR_BLOCK[type as WebsiteBlockType];
      return !required || addOns.includes(required);
    };

    const featureAllowed = (type: string) =>
      Object.entries(FEATURE_BLOCK_MAP).every(([featureKey, blockTypes]) => {
        if (!blockTypes.includes(type)) return true;
        return canUseFeature(featureKey);
      });

    return WEBSITE_BLOCK_TYPES.filter((type) => addonAllowed(type) && featureAllowed(type));
  }, [addOns, canUseFeature]);

  const load = useCallback(() => {
    return apiClient
      .get<{ website: WebsiteState; templates: TemplateInfo[]; addOns: AddOnInfo[] }>(endpoint)
      .then((data) => {
        setWebsite(data.website);
        setTemplateKey(data.website.template);
        setTemplates(data.templates);
        setAddOnCatalog(data.addOns);

        const layout = data.website.draftLayout as (WebsiteLayout & {
          branding?: Branding;
          policies?: PolicyContent;
        }) | null;

        setBlocks(Array.isArray(layout?.blocks) ? layout.blocks : []);
        setAddOns(data.website.addOns ?? []);
        setSelectedId(layout?.blocks?.[0]?.id ?? null);

        if (layout?.branding) setBranding((current) => ({ ...current, ...layout.branding }));
        if (layout?.policies) setPolicies((current) => ({ ...current, ...layout.policies }));
      })
      .catch((error) =>
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your website. Check your connection and retry.",
        ),
      )
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const originalLayout = (website?.draftLayout as (WebsiteLayout & {
      branding?: Branding;
      policies?: PolicyContent;
    }) | null) ?? null;

    return (
      templateKey !== (website?.template ?? "medical-centre") ||
      JSON.stringify(blocks) !== JSON.stringify(originalLayout?.blocks ?? []) ||
      JSON.stringify(addOns) !== JSON.stringify(website?.addOns ?? []) ||
      JSON.stringify(branding) !== JSON.stringify(originalLayout?.branding ?? branding) ||
      JSON.stringify(policies) !== JSON.stringify(originalLayout?.policies ?? policies)
    );
  }, [blocks, addOns, website, templateKey, branding, policies]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setFeedback("");

    try {
      const body = {
        template: templateKey,
        layout: { version: 1, blocks, branding, policies },
        addOns,
      };

      const data = await apiClient.put<{ website: { draftSavedAt: string | null } }>(endpoint, body);

      setWebsite((current) =>
        current
          ? {
              ...current,
              template: templateKey,
              draftLayout: { version: 1, blocks, branding, policies },
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
      setFeedback(message);
    } finally {
      setSaving(false);
    }
  }, [blocks, addOns, endpoint, templateKey, branding, policies]);

  const publish = useCallback(async () => {
    if (dirty) {
      toast.error("Save the draft first, then publish.");
      return;
    }

    setPublishing(true);
    setFeedback("");

    try {
      const data = await apiClient.post<{ website: { publishedAt: string } }>(endpoint, {});
      setWebsite((current) => (current ? { ...current, publishedAt: data.website.publishedAt } : current));
      toast.success("Your website is live.");
      setFeedback("Website sections published. Open your public website to review them.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish";
      toast.error(message);
      setFeedback(message);
    } finally {
      setPublishing(false);
    }
  }, [dirty, endpoint]);

  const applyTemplate = (key: string) => {
    const template = templates.find((item) => item.key === key);
    if (!template) return;

    setTemplateKey(key);

    const nextAddOns = [
      ...new Set(
        template.blocks.flatMap((block) => {
          const addon = WEBSITE_ADDONS.find((item) => item.blocks.includes(block as never));
          return addon ? [addon.key] : [];
        }),
      ),
    ];

    setAddOns(nextAddOns);
    setBlocks(template.blocks.map((block) => newWebsiteBlock(block as WebsiteBlockType)));
    setSelectedId(null);
  };

  const addBlock = (type: WebsiteBlockType) => {
    if (blocks.length >= 60) {
      toast.error("You can add up to 60 sections.");
      return;
    }

    const block = newWebsiteBlock(type);
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    if (blocks.length >= 60) {
      toast.error("You can add up to 60 sections.");
      return;
    }

    const block = blocks.find((item) => item.id === id);
    if (!block) return;

    const copy = newWebsiteBlock(block.type, block.settings);
    setBlocks((current) => [...current, copy]);
  };

  const toggleHidden = (id: string) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, hidden: !block.hidden } : block)),
    );
  };

  /* Native HTML5 drag-and-drop, no external package required */
  const onDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const onDragOver = (event: React.DragEvent<HTMLLIElement>, index: number) => {
    event.preventDefault();
    setDragOverIndex(index);
  };

  const onDrop = (index: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);

    if (from == null || from === index) return;

    setBlocks((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  const onDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
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
            Build your public homepage. Drafts stay private until you publish.
            {website?.publishedAt
              ? ` Live since ${new Date(website.publishedAt).toLocaleString()}.`
              : " Not published yet."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {FACILITY_KIND_LABELS[facilityKind]} • {accountTier.charAt(0).toUpperCase() + accountTier.slice(1)} plan
          </p>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "editor" | "preview")}>
          <TabsList>
            <TabsTrigger value="editor">
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Editor
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Live preview
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

      {tab === "preview" ? (
        <Card className="beeline-card">
          <CardContent className="p-4">
            <p className="mb-4 text-xs text-muted-foreground">
              Preview of your homepage as it will appear once published.
            </p>

            <div className="rounded-xl border border-border p-4">
              <WebsitePreview
                blocks={blocks}
                branding={branding}
                policies={policies}
                facility={facility}
                facilityKind={facilityKind}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
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
                      onDragOver={(event) => onDragOver(event, index)}
                      onDrop={() => onDrop(index)}
                      onDragEnd={onDragEnd}
                      className={`rounded-lg border p-2 transition-colors ${
                        selectedId === block.id ? "border-ring" : "border-border"
                      } ${block.hidden ? "opacity-50" : ""} ${
                        dragOverIndex === index ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="cursor-grab text-muted-foreground" aria-hidden="true">
                          <GripVertical className="h-4 w-4" />
                        </span>

                        <button
                          className="min-w-24 flex-1 text-left text-sm font-medium"
                          onClick={() => setSelectedId(block.id)}
                          aria-label={`Edit ${BLOCK_LABELS[block.type]} section`}
                        >
                          {index + 1}. {BLOCK_LABELS[block.type] ?? block.type}
                        </button>

                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Move ${BLOCK_LABELS[block.type]} up`}
                            onClick={() => setBlocks((current) => moveBlock(current, index, -1))}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Move ${BLOCK_LABELS[block.type]} down`}
                            onClick={() => setBlocks((current) => moveBlock(current, index, 1))}
                            disabled={index === blocks.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={
                              block.hidden
                                ? `Show ${BLOCK_LABELS[block.type]}`
                                : `Hide ${BLOCK_LABELS[block.type]}`
                            }
                            onClick={() => toggleHidden(block.id)}
                          >
                            {block.hidden ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Duplicate ${BLOCK_LABELS[block.type]}`}
                            onClick={() => duplicateBlock(block.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${BLOCK_LABELS[block.type]}`}
                            onClick={() => removeBlock(block.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="text-xs text-muted-foreground">
                  Drag any section to rearrange it. Keyboard users can use the up and down buttons.
                </p>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Add a section</CardTitle>
              </CardHeader>

              <CardContent className="flex flex-wrap gap-2">
                {availableBlocks.map((type) => (
                  <Button key={type} variant="outline" size="sm" onClick={() => addBlock(type)}>
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    {BLOCK_LABELS[type] ?? type}
                  </Button>
                ))}
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
                    onChange={(settings) =>
                      setBlocks((current) =>
                        current.map((block) =>
                          block.id === selected.id ? { ...block, settings } : block,
                        ),
                      )
                    }
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layout aria-hidden="true" className="h-4 w-4" /> Branding & layout
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {!canUseFeature("custom_branding") ? (
                  <UpgradeNotice featureKey="custom_branding" />
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="logo-upload">Logo</Label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="w-full text-sm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const objectUrl = URL.createObjectURL(file);
                          setBranding((current) => ({
                            ...current,
                            logoUrl: objectUrl,
                            logoAlt: current.logoAlt || facility.name,
                          }));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        For production, upload the selected file to your storage provider and save the
                        returned public URL.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="logo-alt">Logo alt text</Label>
                      <Input
                        id="logo-alt"
                        value={branding.logoAlt}
                        onChange={(event) =>
                          setBranding((current) => ({ ...current, logoAlt: event.target.value }))
                        }
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="primary-color">Primary color</Label>
                        <Input
                          id="primary-color"
                          type="color"
                          value={branding.primaryColor}
                          onChange={(event) =>
                            setBranding((current) => ({
                              ...current,
                              primaryColor: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="accent-color">Accent color</Label>
                        <Input
                          id="accent-color"
                          type="color"
                          value={branding.accentColor}
                          onChange={(event) =>
                            setBranding((current) => ({
                              ...current,
                              accentColor: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="navbar-title">Navbar title</Label>
                      <Input
                        id="navbar-title"
                        value={branding.navbarTitle}
                        onChange={(event) =>
                          setBranding((current) => ({
                            ...current,
                            navbarTitle: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <LinkListEditor
                      title="Navbar links"
                      icon={<Menu aria-hidden="true" className="h-4 w-4" />}
                      links={branding.navbarLinks}
                      onChange={(navbarLinks) =>
                        setBranding((current) => ({ ...current, navbarLinks }))
                      }
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={branding.showSidebar}
                        onChange={(event) =>
                          setBranding((current) => ({
                            ...current,
                            showSidebar: event.target.checked,
                          }))
                        }
                      />
                      Show sidebar
                    </label>

                    {branding.showSidebar && (
                      <>
                        <div className="space-y-1">
                          <Label htmlFor="sidebar-title">Sidebar title</Label>
                          <Input
                            id="sidebar-title"
                            value={branding.sidebarTitle}
                            onChange={(event) =>
                              setBranding((current) => ({
                                ...current,
                                sidebarTitle: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <LinkListEditor
                          title="Sidebar links"
                          icon={<PanelLeft aria-hidden="true" className="h-4 w-4" />}
                          links={branding.sidebarLinks}
                          onChange={(sidebarLinks) =>
                            setBranding((current) => ({ ...current, sidebarLinks }))
                          }
                        />
                      </>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="footer-title">Footer title</Label>
                      <Input
                        id="footer-title"
                        value={branding.footerTitle}
                        onChange={(event) =>
                          setBranding((current) => ({
                            ...current,
                            footerTitle: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="footer-text">Footer text</Label>
                      <textarea
                        id="footer-text"
                        className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm"
                        value={branding.footerText}
                        onChange={(event) =>
                          setBranding((current) => ({
                            ...current,
                            footerText: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <LinkListEditor
                      title="Footer links"
                      icon={<PanelBottom aria-hidden="true" className="h-4 w-4" />}
                      links={branding.footerLinks}
                      onChange={(footerLinks) =>
                        setBranding((current) => ({ ...current, footerLinks }))
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield aria-hidden="true" className="h-4 w-4" /> Policies
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {!canUseFeature("policy_editor") ? (
                  <UpgradeNotice featureKey="policy_editor" />
                ) : (
                  <>
                    <PolicyField
                      id="privacy-policy"
                      label="Privacy policy"
                      value={policies.privacyPolicy}
                      onChange={(value) =>
                        setPolicies((current) => ({ ...current, privacyPolicy: value }))
                      }
                    />
                    <PolicyField
                      id="terms-of-use"
                      label="Terms of use"
                      value={policies.termsOfUse}
                      onChange={(value) =>
                        setPolicies((current) => ({ ...current, termsOfUse: value }))
                      }
                    />
                    <PolicyField
                      id="cookie-policy"
                      label="Cookie policy"
                      value={policies.cookiePolicy}
                      onChange={(value) =>
                        setPolicies((current) => ({ ...current, cookiePolicy: value }))
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag aria-hidden="true" className="h-4 w-4" /> Feature shop
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">
                {FEATURE_CATALOG.filter((product) =>
                  product.facilityKinds.includes(facilityKind),
                ).map((product) => {
                  const included = canUseFeature(product.key);
                  const owned = ownedFeatures.has(product.key);

                  return (
                    <div
                      key={product.key}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Requires {product.requiredTier} plan • ${product.priceMonthly}/month
                          </p>
                        </div>

                        {owned ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            Owned
                          </span>
                        ) : included ? (
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                            Included
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast.info(
                                `Checkout is not connected yet. Feature: ${product.name}.`,
                              )
                            }
                          >
                            <Lock aria-hidden="true" className="h-3.5 w-3.5" /> Upgrade
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-base">Add-ons</CardTitle>
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
                          setBlocks((current) =>
                            current.filter(
                              (block) => ADDON_FOR_BLOCK[block.type] !== addon.key,
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
/* Preview                                                             */
/* ------------------------------------------------------------------ */

function WebsitePreview({
  blocks,
  branding,
  policies,
  facility,
  facilityKind,
}: {
  blocks: WebsiteBlock[];
  branding: Branding;
  policies: PolicyContent;
  facility: FacilityProps;
  facilityKind: FacilityKind;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"
        style={{ backgroundColor: `${branding.primaryColor}10` }}
      >
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={branding.logoUrl}
              alt={branding.logoAlt || facility.name}
              className="h-10 w-auto rounded"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {facility.name.charAt(0)}
            </div>
          )}

          <span className="font-semibold">{branding.navbarTitle}</span>
        </div>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-3 text-sm">
            {branding.navbarLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                <a className="underline" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className={branding.showSidebar ? "grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]" : ""}>
        {branding.showSidebar && (
          <aside className="border-b border-border p-4 md:border-b-0 md:border-r">
            <p className="mb-2 text-sm font-semibold">{branding.sidebarTitle}</p>
            <ul className="space-y-1 text-sm">
              {branding.sidebarLinks.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <a className="underline" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <main className="min-w-0 p-4">
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
              logoUrl: branding.logoUrl || null,
            }}
            directory={facility.directory}
            slug={facility.slug ?? ""}
          />

          <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            Facility type: {FACILITY_KIND_LABELS[facilityKind]}
          </div>
        </main>
      </div>

      <footer className="border-t border-border p-4 text-sm">
        <p className="font-semibold">{branding.footerTitle}</p>
        <p className="text-muted-foreground">{branding.footerText}</p>

        <ul className="mt-2 flex flex-wrap gap-3 text-xs">
          {branding.footerLinks.map((link) => (
            <li key={`${link.label}-${link.href}`}>
              <a className="underline" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {(policies.privacyPolicy || policies.termsOfUse || policies.cookiePolicy) && (
          <details className="mt-3 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">Legal information</summary>
            <div className="mt-2 space-y-3 text-xs">
              {policies.privacyPolicy && (
                <div>
                  <p className="font-semibold">Privacy policy</p>
                  <p className="whitespace-pre-wrap">{policies.privacyPolicy}</p>
                </div>
              )}
              {policies.termsOfUse && (
                <div>
                  <p className="font-semibold">Terms of use</p>
                  <p className="whitespace-pre-wrap">{policies.termsOfUse}</p>
                </div>
              )}
              {policies.cookiePolicy && (
                <div>
                  <p className="font-semibold">Cookie policy</p>
                  <p className="whitespace-pre-wrap">{policies.cookiePolicy}</p>
                </div>
              )}
            </div>
          </details>
        )}
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editors                                                             */
/* ------------------------------------------------------------------ */

function LinkListEditor({
  title,
  icon,
  links,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  links: NavbarLink[];
  onChange: (links: NavbarLink[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon} {title}
      </p>

      {links.map((link, index) => (
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`${title} label ${index + 1}`}
            value={link.label}
            placeholder="Label"
            onChange={(event) =>
              onChange(
                links.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, label: event.target.value } : item,
                ),
              )
            }
          />

          <Input
            aria-label={`${title} URL ${index + 1}`}
            value={link.href}
            placeholder="/services"
            onChange={(event) =>
              onChange(
                links.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, href: event.target.value } : item,
                ),
              )
            }
          />

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${title} link ${index + 1}`}
            onClick={() => onChange(links.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...links, { label: "", href: "" }])}
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add link
      </Button>
    </div>
  );
}

function PolicyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className="min-h-28 w-full rounded-lg border border-border bg-background p-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function UpgradeNotice({ featureKey }: { featureKey: string }) {
  const product = FEATURE_CATALOG.find((item) => item.key === featureKey);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Lock aria-hidden="true" className="h-4 w-4" />
        {product?.name ?? "Premium feature"} is unavailable on your current plan.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upgrade to {product?.requiredTier ?? "a higher"} plan or purchase this feature to unlock it.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block settings                                                      */
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

  const s = block.settings as Record<string, string | undefined>;

  switch (block.type) {
    case "carousel": {
      const slides =
        (block.settings as { slides?: { imageUrl: string; caption: string; linkUrl: string }[] })
          .slides ?? [];

      return (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-2">
              <Input
                aria-label={`Slide ${index + 1} image URL`}
                placeholder="https://…"
                value={slide.imageUrl}
                onChange={(event) =>
                  set(
                    "slides",
                    slides.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, imageUrl: event.target.value } : item,
                    ),
                  )
                }
              />

              <Input
                aria-label={`Slide ${index + 1} caption`}
                placeholder="Caption"
                value={slide.caption}
                onChange={(event) =>
                  set(
                    "slides",
                    slides.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, caption: event.target.value } : item,
                    ),
                  )
                }
              />

              <Input
                aria-label={`Slide ${index + 1} link`}
                placeholder="https://…"
                value={slide.linkUrl}
                onChange={(event) =>
                  set(
                    "slides",
                    slides.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, linkUrl: event.target.value } : item,
                    ),
                  )
                }
              />

              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove slide ${index + 1}`}
                onClick={() =>
                  set("slides", slides.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set("slides", [...slides, { imageUrl: "", caption: "", linkUrl: "" }])
            }
          >
            <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" /> Add slide
          </Button>
        </div>
      );
    }

    case "test-catalogue":
    case "pharmacy-catalogue":
    case "insurance":
    case "department-pages":
    case "multi-location":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="extended-title">Title</Label>
            <Input
              id="extended-title"
              value={s.title ?? ""}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="extended-body">Description</Label>
            <textarea
              id="extended-body"
              className="min-h-24 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={s.body ?? ""}
              onChange={(event) => set("body", event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This section displays live facility data where available. Connect the matching feature in
            the Feature shop to enable its full catalogue.
          </p>
        </div>
      );

    case "banner":
    case "cta":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bs-heading">Heading</Label>
            <Input
              id="bs-heading"
              value={s.heading ?? ""}
              onChange={(event) => set("heading", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-sub">Text</Label>
            <Input
              id="bs-sub"
              value={s.subheading ?? s.body ?? ""}
              onChange={(event) =>
                set(block.type === "cta" ? "body" : "subheading", event.target.value)
              }
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-btn">Button label</Label>
            <Input
              id="bs-btn"
              value={s.buttonLabel ?? ""}
              onChange={(event) => set("buttonLabel", event.target.value)}
            />
          </div>

          {block.type === "banner" && (
            <div className="space-y-1">
              <Label htmlFor="bs-img">Banner image URL</Label>
              <Input
                id="bs-img"
                placeholder="https://…"
                value={s.imageUrl ?? ""}
                onChange={(event) => set("imageUrl", event.target.value)}
              />
            </div>
          )}
        </div>
      );

    case "about":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bs-title">Title</Label>
            <Input
              id="bs-title"
              value={s.title ?? ""}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-body">Description</Label>
            <textarea
              id="bs-body"
              className="min-h-24 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={s.body ?? ""}
              onChange={(event) => set("body", event.target.value)}
            />
          </div>
        </div>
      );

    case "contact":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bs-phone">Phone</Label>
            <Input
              id="bs-phone"
              value={s.phone ?? ""}
              onChange={(event) => set("phone", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-email">Email</Label>
            <Input
              id="bs-email"
              type="email"
              value={s.email ?? ""}
              onChange={(event) => set("email", event.target.value)}
            />
          </div>
        </div>
      );

    case "location":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bs-addr">Address</Label>
            <Input
              id="bs-addr"
              value={s.address ?? ""}
              onChange={(event) => set("address", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-map">Map link</Label>
            <Input
              id="bs-map"
              placeholder="https://maps…"
              value={s.mapUrl ?? ""}
              onChange={(event) => set("mapUrl", event.target.value)}
            />
          </div>
        </div>
      );

    case "hours": {
      const rows = (block.settings as { rows?: { day: string; hours: string }[] }).rows ?? [];

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
                    rows.map((item, rowIndex) =>
                      rowIndex === index ? { ...item, day: event.target.value } : item,
                    ),
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
                    rows.map((item, rowIndex) =>
                      rowIndex === index ? { ...item, hours: event.target.value } : item,
                    ),
                  )
                }
              />

              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove row ${index + 1}`}
                onClick={() => set("rows", rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
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
      const items =
        (block.settings as {
          items?: Record<string, string>[];
        }).items ?? [];

      const itemLabel =
        block.type === "faq" ? "question" : block.type === "stats" ? "label" : "name";

      const secondLabel =
        block.type === "faq" ? "answer" : block.type === "stats" ? "value" : "description";

      return (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-2">
              <Input
                aria-label={`${itemLabel} ${index + 1}`}
                value={item[itemLabel] ?? ""}
                onChange={(event) =>
                  set(
                    "items",
                    items.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, [itemLabel]: event.target.value }
                        : entry,
                    ),
                  )
                }
              />

              <div className="flex gap-2">
                <Input
                  aria-label={`${secondLabel} ${index + 1}`}
                  value={item[secondLabel] ?? ""}
                  onChange={(event) =>
                    set(
                      "items",
                      items.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, [secondLabel]: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => set("items", items.filter((_, entryIndex) => entryIndex !== index))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set(
                "items",
                [
                  ...items,
                  block.type === "faq"
                    ? { question: "", answer: "" }
                    : block.type === "stats"
                      ? { label: "", value: "" }
                      : { name: "", description: "" },
                ],
              )
            }
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add an item
          </Button>
        </div>
      );
    }

    default:
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bs-title2">Title</Label>
            <Input
              id="bs-title2"
              value={s.title ?? ""}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bs-body2">Text</Label>
            <textarea
              id="bs-body2"
              className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={s.body ?? ""}
              onChange={(event) => set("body", event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This section also shows live data from your facility profile below it.
          </p>
        </div>
      );
  }
}
