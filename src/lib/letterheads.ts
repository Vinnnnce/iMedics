import type { LetterheadProfile } from "@prisma/client";
import { prisma } from "./prisma";
import { isSignatureKey } from "./letterhead-signature";

/** A validated hex colour for letterhead rendering. */
export const DEFAULT_BRAND_COLOR = "#0F766E";
const HEX = /^#[0-9a-fA-F]{6}$/;
/** A stored key that may safely be surfaced on a letterhead view. */
const isSignatureKeySafe = (key: string | null | undefined): key is string => Boolean(key && isSignatureKey(key));

export interface LetterheadSignatureBlock {
  name: string;
  title?: string;
  registrationId?: string;
  /** "left" or "right"; anything else is treated as "left". */
  side?: string;
}

export interface LetterheadView {
  /** Department this letterhead is scoped to (facility letterheads only). */
  department?: string | null;
  displayName: string;
  headerLines: string[];
  addressLine: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  registrationInfo: string | null;
  brandColor: string;
  footerText: string | null;
  logoUrl: string | null;
  /** Private storage key of the owner's handwritten signature image, if any. */
  signatureUrl: string | null;
  showQr: boolean;
  signatureBlocks: LetterheadSignatureBlock[];
}

export function brandColorOf(hex: string | null | undefined): string {
  return hex && HEX.test(hex) ? hex : DEFAULT_BRAND_COLOR;
}

/** Coerce stored JSON into validated signature blocks; never throws. */
export function signatureBlocksOf(value: unknown): LetterheadSignatureBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: LetterheadSignatureBlock[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const name = (raw as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    const title = (raw as { title?: unknown }).title;
    const registrationId = (raw as { registrationId?: unknown }).registrationId;
    const side = (raw as { side?: unknown }).side;
    blocks.push({
      name: name.trim().slice(0, 160),
      ...(typeof title === "string" && title.trim() ? { title: title.trim().slice(0, 160) } : {}),
      ...(typeof registrationId === "string" && registrationId.trim() ? { registrationId: registrationId.trim().slice(0, 80) } : {}),
      ...(typeof side === "string" ? { side: side === "right" ? "right" : "left" } : {}),
    });
  }
  return blocks.slice(0, 4);
}

export function letterheadView(profile: LetterheadProfile): LetterheadView {
  return {
    department: profile.department ?? null,
    displayName: profile.displayName,
    headerLines: profile.headerLines.slice(0, 6),
    addressLine: profile.addressLine,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    website: profile.website,
    registrationInfo: profile.registrationInfo,
    brandColor: brandColorOf(profile.brandColor),
    footerText: profile.footerText,
    logoUrl: profile.logoUrl,
    signatureUrl: isSignatureKeySafe(profile.signatureUrl) ? profile.signatureUrl : null,
    showQr: profile.showQr,
    signatureBlocks: signatureBlocksOf(profile.signatureBlocks),
  };
}

/**
 * The letterhead a facility document is issued under: a department-specific
 * letterhead wins over the facility default. Letterhead choice never changes
 * the issuing organisation recorded on the document itself.
 */
export async function resolveFacilityLetterhead(facilityId: string, department: string | null): Promise<LetterheadView | null> {
  const profiles = await prisma.letterheadProfile.findMany({
    where: { facilityId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (profiles.length === 0) return null;
  const wanted = department?.trim().toLowerCase() ?? null;
  const match = wanted
    ? profiles.find((p) => p.department?.trim().toLowerCase() === wanted) ?? profiles.find((p) => p.isDefault)
    : profiles.find((p) => p.isDefault) ?? profiles.find((p) => !p.department);
  return letterheadView(match ?? profiles[0]);
}

/** A doctor's personal professional letterhead for independent practice. */
export async function resolveDoctorLetterhead(userId: string): Promise<LetterheadView | null> {
  const profiles = await prisma.letterheadProfile.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (profiles.length === 0) return null;
  return letterheadView(profiles.find((p) => p.isDefault) ?? profiles[0]);
}

/** Validation shared by the facility and doctor letterhead APIs. */
export interface LetterheadInput {
  name: string;
  department?: string | null;
  isDefault?: boolean;
  displayName: string;
  headerLines?: string[];
  addressLine?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  registrationInfo?: string | null;
  brandColor?: string;
  footerText?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  showQr?: boolean;
  watermark?: string | null;
  signatureBlocks?: unknown;
}

export function validateLetterheadInput(body: LetterheadInput): { ok: true; value: LetterheadInput } | { ok: false; error: string } {
  const name = body.name?.trim();
  if (!name || name.length > 120) return { ok: false, error: "A letterhead name of up to 120 characters is required" };
  const displayName = body.displayName?.trim();
  if (!displayName || displayName.length > 200) return { ok: false, error: "An organisation display name of up to 200 characters is required" };
  if (body.brandColor && !HEX.test(body.brandColor)) return { ok: false, error: "Brand colour must be a 6-digit hex value like #0F766E" };
  if (body.signatureUrl !== undefined && body.signatureUrl !== null && !isSignatureKey(body.signatureUrl)) {
    return { ok: false, error: "Signature image reference is not valid" };
  }
  if (body.headerLines && (body.headerLines.length > 6 || body.headerLines.some((l) => typeof l !== "string" || l.length > 200))) {
    return { ok: false, error: "Header lines must be at most 6 lines of 200 characters" };
  }
  if (body.signatureBlocks !== undefined) {
    const blocks = signatureBlocksOf(body.signatureBlocks);
    if (Array.isArray(body.signatureBlocks) && body.signatureBlocks.length > blocks.length) {
      return { ok: false, error: "Signature blocks must each have a name (max 4 blocks)" };
    }
  }
  return {
    ok: true,
    value: {
      ...body,
      name,
      displayName,
      ...(body.department !== undefined && { department: body.department?.trim() ? body.department.trim().slice(0, 120) : null }),
      ...(body.headerLines && { headerLines: body.headerLines.slice(0, 6).map((l) => l.slice(0, 200)) }),
      ...(body.brandColor && { brandColor: body.brandColor }),
      ...(body.signatureBlocks !== undefined && { signatureBlocks: signatureBlocksOf(body.signatureBlocks) }),
      ...(body.signatureUrl !== undefined && { signatureUrl: body.signatureUrl }),
    },
  };
}
