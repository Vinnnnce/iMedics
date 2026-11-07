import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requireWebsiteAccess } from "@/lib/website/access";
import { badRequest } from "@/lib/errors";
import {
  parseWebsiteLayout,
  encodeWebsiteLayout,
  validateAddOns,
  websiteLayoutSchema,
  WEBSITE_TEMPLATES,
  WEBSITE_ADDONS,
} from "@/lib/website/blocks";

/**
 * Facility mini-website API. Only the facility owner account or staff with the
 * MANAGE_PROFILE permission may edit or publish; every write is audited and
 * each account can only touch its own facility's website (enforced by resolving
 * the facility from the caller's own profile/memberships).
 */

const draftSchema = z.object({
  template: z.string().max(60).optional(),
  layout: websiteLayoutSchema,
  addOns: z.array(z.enum(WEBSITE_ADDONS.map((a) => a.key) as [string, ...string[]])).max(20).default([]),
});

function validatedLayout(input: unknown, addOns: string[]) {
  try {
    const layout = parseWebsiteLayout(input);
    validateAddOns(layout.blocks, addOns);
    return layout;
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid website layout");
  }
}

// GET /api/facility/website — the draft, published layout and status for the caller's facility.
export const GET = withAuth(null, async (req, { user }) => {
  const resolved = await requireWebsiteAccess(user, req);
  if (!resolved) return NextResponse.json({ error: "No facility found for this account" }, { status: 404 });
  let website = await prisma.facilityWebsite.findUnique({ where: { facilityId: resolved.facility.id } });
  if (!website) {
    website = await prisma.facilityWebsite.upsert({
      where: { facilityId: resolved.facility.id },
      update: {},
      create: {
        facilityId: resolved.facility.id,
        template: "medical-centre",
        draftLayout: encodeWebsiteLayout({ version: 1, blocks: [] }),
        addOns: [],
        createdById: user.id,
      },
    });
  }
  return NextResponse.json({
    website: {
      id: website.id,
      template: website.template,
      draftLayout: website.draftLayout,
      publishedLayout: website.publishedLayout,
      addOns: website.addOns,
      publishedAt: website.publishedAt,
      draftSavedAt: website.draftSavedAt,
    },
    templates: WEBSITE_TEMPLATES,
    addOns: WEBSITE_ADDONS,
  });
});

// PUT /api/facility/website — save a draft. Never makes anything public.
export const PUT = withAuth(null, async (req, { user }) => {
  const resolved = await requireWebsiteAccess(user, req);
  if (!resolved) return NextResponse.json({ error: "No facility found for this account" }, { status: 404 });
  const body = await parseBody(req, draftSchema);

  const layout = validatedLayout(body.layout, body.addOns);
  if (body.template && !WEBSITE_TEMPLATES.some((t) => t.key === body.template)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const website = await prisma.facilityWebsite.upsert({
    where: { facilityId: resolved.facility.id },
    create: {
      facilityId: resolved.facility.id,
      template: body.template ?? "medical-centre",
      draftLayout: encodeWebsiteLayout(layout),
      addOns: body.addOns,
      createdById: user.id,
      draftSavedAt: new Date(),
    },
    update: {
      ...(body.template ? { template: body.template } : {}),
      draftLayout: encodeWebsiteLayout(layout),
      addOns: body.addOns,
      draftSavedAt: new Date(),
    },
  });

  await writeAudit({
    userId: user.id,
    facilityId: resolved.facility.id,
    actorRole: user.role,
    action: "WEBSITE_DRAFT_SAVED",
    resourceType: "FacilityWebsite",
    resourceId: website.id,
    details: { blocks: layout.blocks.length },
  });

  return NextResponse.json({ website: { id: website.id, draftSavedAt: website.draftSavedAt } });
});

// POST /api/facility/website — publish the current draft (copies draft → published).
export const POST = withAuth(null, async (req, { user }) => {
  const resolved = await requireWebsiteAccess(user, req);
  if (!resolved) return NextResponse.json({ error: "No facility found for this account" }, { status: 404 });
  const website = await prisma.facilityWebsite.findUnique({ where: { facilityId: resolved.facility.id } });
  if (!website) return NextResponse.json({ error: "Save a draft before publishing" }, { status: 400 });
  if (!resolved.facility.slug || !resolved.facility.isPublished || resolved.facility.verificationStatus !== "VERIFIED") {
    throw badRequest("Your facility profile must be verified and publicly listed before publishing website sections. Update your facility profile first.");
  }

  const layout = validatedLayout(website.draftLayout, website.addOns);

  const [published] = await prisma.$transaction([prisma.facilityWebsite.update({
    where: { id: website.id },
    data: { publishedLayout: encodeWebsiteLayout(layout), publishedAt: new Date() },
  }), prisma.facilityWebsiteRevision.create({
    data: { websiteId: website.id, layout: encodeWebsiteLayout(layout), addOns: website.addOns, publishedById: user.id },
  })]);

  await writeAudit({
    userId: user.id,
    facilityId: resolved.facility.id,
    actorRole: user.role,
    action: "WEBSITE_PUBLISHED",
    resourceType: "FacilityWebsite",
    resourceId: website.id,
    details: { blocks: layout.blocks.length },
  });

  return NextResponse.json({ website: { id: published.id, publishedAt: published.publishedAt } });
});

// DELETE /api/facility/website — unpublish (take the mini-website offline).
export const DELETE = withAuth(null, async (req: NextRequest, { user }) => {
  const resolved = await requireWebsiteAccess(user, req);
  if (!resolved) return NextResponse.json({ error: "No facility found for this account" }, { status: 404 });
  const website = await prisma.facilityWebsite.findUnique({ where: { facilityId: resolved.facility.id } });
  if (!website) return NextResponse.json({ error: "No website found" }, { status: 404 });
  await prisma.facilityWebsite.update({
    where: { id: website.id },
    data: { publishedLayout: Prisma.JsonNull, publishedAt: null },
  });
  await writeAudit({
    userId: user.id,
    facilityId: resolved.facility.id,
    actorRole: user.role,
    action: "WEBSITE_UNPUBLISHED",
    resourceType: "FacilityWebsite",
    resourceId: website.id,
  });
  return NextResponse.json({ ok: true });
});
