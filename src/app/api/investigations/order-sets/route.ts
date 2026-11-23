import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { ORDER_SET_TEMPLATES } from "@/lib/investigations/seed-data";
import { badRequest } from "@/lib/errors";
import { newRow } from "@/lib/investigations/db";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
  domain: z.enum(["LABORATORY", "DIAGNOSTIC"]),
  catalogueItemIds: z.array(z.string().uuid()).min(1).max(40),
  isShared: z.boolean().default(false),
  /** Copy a starter template by name instead of passing ids. */
  fromTemplate: z.string().optional(),
});

// GET — the doctor's own sets, sets other doctors shared, and the configurable starter templates
// (resolved to catalogue ids). Templates are examples, not clinical recommendations.
export const GET = withAuth(["DOCTOR"], async (req, { user }) => {
  const { domain } = parseQuery(req, z.object({ domain: z.enum(["LABORATORY", "DIAGNOSTIC"]) }));
  await ensureCatalogueSeeded();
  const sets = await prisma.investigation_order_sets.findMany({ where: { domain, OR: [{ owner_user_id: user.id }, { is_shared: true }] }, orderBy: { name: "asc" }, take: 100 });
  const allIds = [...new Set(sets.flatMap((s) => s.catalogue_item_ids))];
  const templates = ORDER_SET_TEMPLATES.filter((t) => t.domain === domain);
  const names = [...new Set(templates.flatMap((t) => t.members))];
  const items = await prisma.investigation_catalogue_items.findMany({ where: { OR: [{ id: { in: allIds } }, { name: { in: names }, domain, source: "SYSTEM" }] }, select: { id: true, name: true } });
  const byName = new Map(items.map((i) => [i.name, i.id]));
  const byId = new Map(items.map((i) => [i.id, i.name]));
  return NextResponse.json({
    sets: sets.map((s) => ({ id: s.id, name: s.name, description: s.description, mine: s.owner_user_id === user.id, isShared: s.is_shared, members: s.catalogue_item_ids.map((id) => ({ id, name: byId.get(id) ?? "Unavailable" })) })),
    templates: templates.map((t) => ({ name: t.name, members: t.members.map((n) => ({ id: byName.get(n) ?? null, name: n })).filter((m) => m.id) })),
  });
});

export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const body = await parseBody(req, createSchema);
  const valid = await prisma.investigation_catalogue_items.count({ where: { id: { in: body.catalogueItemIds }, domain: body.domain, is_active: true } });
  if (valid !== new Set(body.catalogueItemIds).size) throw badRequest("One or more investigations are not available");
  const set = await prisma.investigation_order_sets.create({ data: { ...newRow(), owner_user_id: user.id, name: body.name, description: body.description ?? null, domain: body.domain, catalogue_item_ids: [...new Set(body.catalogueItemIds)], is_shared: body.isShared } });
  return NextResponse.json({ success: true, id: set.id }, { status: 201 });
});
