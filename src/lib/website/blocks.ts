import { z } from "zod";
import { randomUUID } from "node:crypto";

/**
 * Facility mini-website builder: shared schema for layouts.
 *
 * A layout is an ordered list of blocks. Each block has a stable id, a type,
 * an optional `hidden` flag and type-specific settings. Layouts are stored as
 * JSON (`FacilityWebsite.draftLayout` / `publishedLayout`); publishing copies
 * the draft to the published column, so drafts are never public.
 */

export const WEBSITE_BLOCK_TYPES = [
  "banner",
  "about",
  "stats",
  "departments",
  "doctors",
  "services",
  "diagnostic-tests",
  "lab-services",
  "hours",
  "contact",
  "location",
  "appointment-booking",
  "cta",
  "gallery",
  "faq",
] as const;

export type WebsiteBlockType = (typeof WEBSITE_BLOCK_TYPES)[number];

/** Add-ons unlock optional blocks/features; keys are persisted per website. */
export const WEBSITE_ADDONS = [
  { key: "appointment-booking", label: "Appointment booking", blocks: ["appointment-booking"], description: "Let visitors request a booking from your website." },
  { key: "cta-banner", label: "Call-to-action banner", blocks: ["cta"], description: "Prominent call-to-action strip with a configurable button." },
  { key: "location-map", label: "Location & map", blocks: ["location"], description: "Address block with map link and directions." },
  { key: "gallery", label: "Photo gallery", blocks: ["gallery"], description: "Image gallery from your uploaded facility photos." },
  { key: "faq", label: "FAQ section", blocks: ["faq"], description: "Frequently asked questions section." },
] as const;

export type WebsiteAddOnKey = (typeof WEBSITE_ADDONS)[number]["key"];

export const ADDON_FOR_BLOCK: Partial<Record<WebsiteBlockType, WebsiteAddOnKey>> = Object.fromEntries(
  WEBSITE_ADDONS.flatMap((a) => a.blocks.map((b) => [b, a.key])),
);

const text = (max: number) => z.string().trim().max(max).optional();

export const blockSettingsSchemas: Record<WebsiteBlockType, z.ZodTypeAny> = {
  banner: z.object({
    heading: text(120),
    subheading: text(300),
    imageUrl: z.string().url().max(500).optional(),
    buttonLabel: text(40),
    buttonHref: z.string().max(300).optional(),
  }),
  about: z.object({
    title: text(120),
    body: text(2000),
  }),
  stats: z.object({
    title: text(120),
    items: z.array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(30) })).max(8).optional(),
  }),
  departments: z.object({ title: text(120), items: z.array(z.object({ name: z.string().trim().max(100), description: text(300) })).max(24).optional() }),
  doctors: z.object({ title: text(120), body: text(500) }),
  services: z.object({ title: text(120), body: text(500) }),
  "diagnostic-tests": z.object({ title: text(120), body: text(500) }),
  "lab-services": z.object({ title: text(120), body: text(500) }),
  hours: z.object({
    title: text(120),
    rows: z.array(z.object({ day: z.string().trim().max(40), hours: z.string().trim().max(60) })).max(14).optional(),
  }),
  contact: z.object({
    title: text(120),
    phone: text(40),
    email: text(120),
    whatsapp: text(40),
  }),
  location: z.object({
    title: text(120),
    address: text(300),
    mapUrl: z.string().url().max(500).optional(),
  }),
  "appointment-booking": z.object({ title: text(120), body: text(300), buttonLabel: text(40) }),
  cta: z.object({
    heading: text(120),
    body: text(300),
    buttonLabel: text(40),
    buttonHref: z.string().max(300).optional(),
  }),
  gallery: z.object({ title: text(120) }),
  faq: z.object({
    title: text(120),
    items: z.array(z.object({ question: z.string().trim().max(200), answer: z.string().trim().max(1000) })).max(20).optional(),
  }),
};

export const websiteBlockSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(WEBSITE_BLOCK_TYPES),
  hidden: z.boolean().default(false),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const websiteLayoutSchema = z.object({
  version: z.literal(1),
  blocks: z.array(websiteBlockSchema).max(40),
});

export type WebsiteBlock = z.infer<typeof websiteBlockSchema>;
export type WebsiteLayout = z.infer<typeof websiteLayoutSchema>;

/** Validate and normalize a layout: throws on invalid block shapes. */
export function parseWebsiteLayout(input: unknown): WebsiteLayout {
  const layout = websiteLayoutSchema.parse(input ?? { version: 1, blocks: [] });
  const seen = new Set<string>();
  for (const block of layout.blocks) {
    if (seen.has(block.id)) throw new Error(`Duplicate block id ${block.id}`);
    seen.add(block.id);
    const parsed = blockSettingsSchemas[block.type].safeParse(block.settings);
    if (!parsed.success) {
      throw new Error(`Invalid settings for block ${block.type}: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }
    block.settings = parsed.data as Record<string, unknown>;
  }
  return layout;
}

/** Serialize a layout for storage. */
export function encodeWebsiteLayout(layout: WebsiteLayout) {
  return JSON.parse(JSON.stringify(layout)) as unknown as object;
}

/** Create a new block with default settings. */
export function newWebsiteBlock(type: WebsiteBlockType, settings: Record<string, unknown> = {}): WebsiteBlock {
  const defaults: Record<WebsiteBlockType, Record<string, unknown>> = {
    banner: { heading: "Welcome to our facility", subheading: "" },
    about: { title: "About us", body: "" },
    stats: { title: "Our facility in numbers", items: [] },
    departments: { title: "Departments", items: [] },
    doctors: { title: "Our doctors", body: "" },
    services: { title: "Our services", body: "" },
    "diagnostic-tests": { title: "Diagnostic tests", body: "" },
    "lab-services": { title: "Laboratory services", body: "" },
    hours: { title: "Opening hours", rows: [] },
    contact: { title: "Contact us", phone: "", email: "" },
    location: { title: "Find us", address: "" },
    "appointment-booking": { title: "Book an appointment", body: "", buttonLabel: "Request a booking" },
    cta: { heading: "Book your visit today", body: "", buttonLabel: "Contact us" },
    gallery: { title: "Gallery" },
    faq: { title: "Frequently asked questions", items: [] },
  };
  return { id: randomUUID(), type, hidden: false, settings: { ...defaults[type], ...settings } };
}

/** Reorder blocks: move the block at index by the given delta, clamped. */
export function moveBlock(blocks: WebsiteBlock[], index: number, delta: -1 | 1): WebsiteBlock[] {
  const target = index + delta;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [b] = next.splice(index, 1);
  next.splice(target, 0, b);
  return next;
}

export interface WebsiteTemplate {
  key: string;
  name: string;
  description: string;
  addOns: WebsiteAddOnKey[];
  blocks: WebsiteBlockType[];
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    key: "medical-centre",
    name: "Medical centre",
    description: "Balanced homepage for hospitals and clinics: banner, about, departments, doctors, hours and contact.",
    addOns: ["appointment-booking", "location-map", "cta-banner"],
    blocks: ["banner", "about", "stats", "departments", "doctors", "hours", "contact", "location", "appointment-booking", "cta"],
  },
  {
    key: "clinic-lite",
    name: "Clinic lite",
    description: "A compact homepage for small clinics: banner, services, hours and contact.",
    addOns: ["location-map"],
    blocks: ["banner", "services", "hours", "contact", "location"],
  },
  {
    key: "diagnostic-focus",
    name: "Diagnostic focus",
    description: "For diagnostic centres: banner, tests, appointment booking and contact.",
    addOns: ["appointment-booking", "faq"],
    blocks: ["banner", "about", "diagnostic-tests", "hours", "appointment-booking", "contact", "faq"],
  },
  {
    key: "laboratory-focus",
    name: "Laboratory focus",
    description: "For laboratories: banner, lab services, turnaround stats and contact.",
    addOns: ["faq"],
    blocks: ["banner", "about", "lab-services", "stats", "hours", "contact", "faq"],
  },
];

/** Build a starter layout for a template key. */
export function layoutFromTemplate(templateKey: string): WebsiteLayout {
  const template = WEBSITE_TEMPLATES.find((t) => t.key === templateKey) ?? WEBSITE_TEMPLATES[0];
  return { version: 1, blocks: template.blocks.map((t) => newWebsiteBlock(t)) };
}

/** Blocks a layout may contain given its enabled add-ons. */
export function validateAddOns(blocks: WebsiteBlock[], addOns: string[]): void {
  const enabled = new Set(addOns);
  for (const block of blocks) {
    const required = ADDON_FOR_BLOCK[block.type];
    if (required && !enabled.has(required)) {
      throw new Error(`Block "${block.type}" requires the "${required}" add-on`);
    }
  }
}
