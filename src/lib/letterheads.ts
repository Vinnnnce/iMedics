import type { LetterheadProfile } from "@prisma/client";
import { prisma } from "./prisma";
import { isSignatureKey } from "./letterhead-signature";

/** A validated hex colour for letterhead rendering. */
export const DEFAULT_BRAND_COLOR = "#0F766E";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\-\s\d]{6,32}$/;
const URL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const TEMPLATE_VARIABLE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;

/** A stored key that may safely be surfaced on a letterhead view. */
const isSignatureKeySafe = (
  key: string | null | undefined,
): key is string => Boolean(key && isSignatureKey(key));

const text = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const optionalText = (
  value: unknown,
  maxLength: number,
): string | null | undefined => {
  if (value === undefined) return undefined;
  return text(value, maxLength);
};

export type LetterheadSide = "left" | "right";

export interface LetterheadSignatureBlock {
  name: string;
  title?: string;
  registrationId?: string;
  side: LetterheadSide;
}

export interface LetterheadWatermark {
  text: string;
  opacity: number;
  rotation: number;
}

export interface LetterheadTemplateVariables {
  [key: string]: string | number | null | undefined;
}

export interface LetterheadView {
  /** Department this letterhead is scoped to (facility letterheads only). */
  department: string | null;
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
  qrUrl: string | null;
  watermark: LetterheadWatermark | null;
  signatureBlocks: LetterheadSignatureBlock[];
  locale: string;
  dateFormat: string;
}

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
  qrUrl?: string | null;
  watermark?: string | null;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  signatureBlocks?: unknown;
  locale?: string | null;
  dateFormat?: string | null;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: keyof LetterheadInput };

export function brandColorOf(value: string | null | undefined): string {
  return value && HEX_COLOR.test(value) ? value : DEFAULT_BRAND_COLOR;
}

/** Coerce stored JSON into validated signature blocks; never throws. */
export function signatureBlocksOf(value: unknown): LetterheadSignatureBlock[] {
  if (!Array.isArray(value)) return [];

  const blocks: LetterheadSignatureBlock[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;

    const record = raw as Record<string, unknown>;
    const name = text(record.name, 160);
    if (!name) continue;

    const title = text(record.title, 160);
    const registrationId = text(record.registrationId, 80);
    const side: LetterheadSide = record.side === "right" ? "right" : "left";

    blocks.push({
      name,
      ...(title ? { title } : {}),
      ...(registrationId ? { registrationId } : {}),
      side,
    });
  }

  return blocks.slice(0, 4);
}

export function watermarkOf(value: unknown): LetterheadWatermark | null {
  const watermarkText = text(value, 120);
  if (!watermarkText) return null;

  return {
    text: watermarkText,
    opacity: 0.12,
    rotation: -30,
  };
}

/**
 * Replaces safe `{{variable}}` placeholders. Unknown variables are removed,
 * so user-controlled templates cannot leak unexpected internal values.
 */
export function renderTemplate(
  template: string,
  variables: LetterheadTemplateVariables = {},
): string {
  return template.replace(
    TEMPLATE_VARIABLE,
    (_match, key: string) => {
      const value = variables[key];
      if (value === null || value === undefined) return "";
      return String(value);
    },
  );
}

export function letterheadView(
  profile: LetterheadProfile,
  variables: LetterheadTemplateVariables = {},
): LetterheadView {
  const footer = profile.footerText
    ? renderTemplate(profile.footerText, variables)
    : null;

  return {
    department: profile.department ?? null,
    displayName: profile.displayName,
    headerLines: profile.headerLines.slice(0, 6),
    addressLine: profile.addressLine ?? null,
    contactPhone: profile.contactPhone ?? null,
    contactEmail: profile.contactEmail ?? null,
    website: profile.website ?? null,
    registrationInfo: profile.registrationInfo ?? null,
    brandColor: brandColorOf(profile.brandColor),
    footerText: footer,
    logoUrl: profile.logoUrl ?? null,
    signatureUrl: isSignatureKeySafe(profile.signatureUrl)
      ? profile.signatureUrl
      : null,
    showQr: profile.showQr,
    qrUrl: profile.qrUrl ?? null,
    watermark: watermarkOf(profile.watermark),
    signatureBlocks: signatureBlocksOf(profile.signatureBlocks),
    locale: profile.locale ?? "en-GB",
    dateFormat: profile.dateFormat ?? "dd MMMM yyyy",
  };
}

interface LetterheadProfileQuery {
  facilityId?: string;
  userId?: string;
  department?: string | null;
}

/**
 * The letterhead a facility document is issued under.
 *
 * Resolution order:
 * 1. Exact department match.
 * 2. Default letterhead.
 * 3. General letterhead with no department.
 * 4. Oldest active letterhead.
 *
 * Letterhead choice never changes the issuing organisation recorded on the
 * document itself.
 */
export async function resolveFacilityLetterhead(
  facilityId: string,
  department: string | null,
  variables: LetterheadTemplateVariables = {},
): Promise<LetterheadView | null> {
  const query: LetterheadProfileQuery = {
    facilityId,
    active: true,
  };

  const profiles = await prisma.letterheadProfile.findMany({
    where: query,
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (profiles.length === 0) return null;

  const wanted = department?.trim().toLowerCase() ?? null;

  const match = wanted
    ? profiles.find(
        (profile) =>
          profile.department?.trim().toLowerCase() === wanted,
      ) ?? profiles.find((profile) => profile.isDefault)
    : profiles.find((profile) => profile.isDefault) ??
      profiles.find((profile) => !profile.department);

  return letterheadView(match ?? profiles[0], variables);
}

/** A doctor's personal professional letterhead for independent practice. */
export async function resolveDoctorLetterhead(
  userId: string,
  variables: LetterheadTemplateVariables = {},
): Promise<LetterheadView | null> {
  const profiles = await prisma.letterheadProfile.findMany({
    where: {
      userId,
      active: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (profiles.length === 0) return null;

  return letterheadView(profiles[0], variables);
}

/** Validation shared by facility and doctor letterhead APIs. */
export function validateLetterheadInput(
  body: LetterheadInput,
): ValidationResult<LetterheadInput> {
  const name = text(body.name, 120);
  if (!name) {
    return {
      ok: false,
      field: "name",
      error: "A letterhead name of up to 120 characters is required",
    };
  }

  const displayName = text(body.displayName, 200);
  if (!displayName) {
    return {
      ok: false,
      field: "displayName",
      error:
        "An organisation display name of up to 200 characters is required",
    };
  }

  if (body.brandColor && !HEX_COLOR.test(body.brandColor)) {
    return {
      ok: false,
      field: "brandColor",
      error:
        "Brand colour must be a 6-digit hex value such as #0F766E",
    };
  }

  if (
    body.signatureUrl !== undefined &&
    body.signatureUrl !== null &&
    !isSignatureKey(body.signatureUrl)
  ) {
    return {
      ok: false,
      field: "signatureUrl",
      error: "Signature image reference is not valid",
    };
  }

  if (body.headerLines) {
    const invalid =
      !Array.isArray(body.headerLines) ||
      body.headerLines.length > 6 ||
      body.headerLines.some(
        (line) => typeof line !== "string" || line.length > 200,
      );

    if (invalid) {
      return {
        ok: false,
        field: "headerLines",
        error:
          "Header lines must contain at most 6 lines of 200 characters",
      };
    }
  }

  if (body.contactEmail) {
    const email = text(body.contactEmail, 254);
    if (!email || !EMAIL.test(email)) {
      return {
        ok: false,
        field: "contactEmail",
        error: "Contact email is not valid",
      };
    }
  }

  if (body.contactPhone) {
    const phone = text(body.contactPhone, 32);
    if (!phone || !PHONE.test(phone)) {
      return {
        ok: false,
        field: "contactPhone",
        error: "Contact phone number is not valid",
      };
    }
  }

  if (body.website) {
    const website = text(body.website, 2048);
    if (!website || !URL.test(website)) {
      return {
        ok: false,
        field: "website",
        error: "Website must be a valid http or https URL",
      };
    }
  }

  if (body.qrUrl) {
    const qrUrl = text(body.qrUrl, 2048);
    if (!qrUrl || !URL.test(qrUrl)) {
      return {
        ok: false,
        field: "qrUrl",
        error: "QR destination must be a valid http or https URL",
      };
    }
  }

  if (
    body.watermarkOpacity !== undefined &&
    (typeof body.watermarkOpacity !== "number" ||
      body.watermarkOpacity < 0 ||
      body.watermarkOpacity > 1)
  ) {
    return {
      ok: false,
      field: "watermarkOpacity",
      error: "Watermark opacity must be between 0 and 1",
    };
  }

  if (
    body.watermarkRotation !== undefined &&
    (typeof body.watermarkRotation !== "number" ||
      body.watermarkRotation < -180 ||
      body.watermarkRotation > 180)
  ) {
    return {
      ok: false,
      field: "watermarkRotation",
      error:
        "Watermark rotation must be between -180 and 180 degrees",
    };
  }

  if (body.signatureBlocks !== undefined) {
    const blocks = signatureBlocksOf(body.signatureBlocks);

    if (
      Array.isArray(body.signatureBlocks) &&
      body.signatureBlocks.length > blocks.length
    ) {
      return {
        ok: false,
        field: "signatureBlocks",
        error:
          "Signature blocks must each have a name; at most 4 blocks are allowed",
      };
    }
  }

  if (body.locale) {
    const locale = text(body.locale, 35);
    if (!locale || !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(locale)) {
      return {
        ok: false,
        field: "locale",
        error: "Locale must be a valid BCP 47 language tag",
      };
    }
  }

  return {
    ok: true,
    value: {
      ...body,
      name,
      displayName,
      ...(body.department !== undefined && {
        department: text(body.department, 120),
      }),
      ...(body.headerLines && {
        headerLines: body.headerLines
          .slice(0, 6)
          .map((line) => text(line, 200) ?? ""),
      }),
      ...(body.contactEmail !== undefined && {
        contactEmail: text(body.contactEmail, 254),
      }),
      ...(body.contactPhone !== undefined && {
        contactPhone: text(body.contactPhone, 32),
      }),
      ...(body.website !== undefined && {
        website: text(body.website, 2048),
      }),
      ...(body.qrUrl !== undefined && {
        qrUrl: text(body.qrUrl, 2048),
      }),
      ...(body.brandColor && { brandColor: body.brandColor }),
      ...(body.signatureBlocks !== undefined && {
        signatureBlocks: signatureBlocksOf(body.signatureBlocks),
      }),
      ...(body.signatureUrl !== undefined && {
        signatureUrl: body.signatureUrl,
      }),
      ...(body.watermark !== undefined && {
        watermark: text(body.watermark, 120),
      }),
      ...(body.watermarkOpacity !== undefined && {
        watermarkOpacity: body.watermarkOpacity,
      }),
      ...(body.watermarkRotation !== undefined && {
        watermarkRotation: body.watermarkRotation,
      }),
      ...(body.locale !== undefined && {
        locale: text(body.locale, 35),
      }),
      ...(body.dateFormat !== undefined && {
        dateFormat: text(body.dateFormat, 40),
      }),
    },
  };
}
