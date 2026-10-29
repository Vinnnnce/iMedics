import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { CATALOGUE_GROUPS, catalogue, catalogueEntry, groupAllowedForKind } from "@/lib/his/catalogue";
import { carryLocks, lockedViolations, parseDefinition } from "@/lib/his/template-schema";

const GROUP_CODES = ["CUSTOM", ...CATALOGUE_GROUPS.map((g) => g.code)] as [string, ...string[]];

const createSchema = z.union([
  z.object({ mode: z.literal("adopt"), sourceCode: z.string().min(3).max(120) }),
  z.object({ mode: z.literal("custom"), name: z.string().trim().min(2).max(200), groupCode: z.enum(GROUP_CODES), definition: z.unknown() }),
  z.object({ mode: z.literal("clone"), templateId: z.string().uuid(), name: z.string().trim().min(2).max(200).optional() }),
  z.object({
    mode: z.literal("import"),
    data: z.object({ name: z.string().trim().min(2).max(200), groupCode: z.enum(GROUP_CODES), sourceCode: z.string().max(120).nullish(), description: z.string().max(2000).nullish(), definition: z.unknown() }),
  }),
]);

const suffix = () => randomBytes(3).toString("hex");
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// GET /api/facility/his/templates — the system catalogue (read-only) and this hospital's own templates.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const templates = await prisma.clinicalDocumentTemplate.findMany({
    where: { facilityId: access.facility.id },
    orderBy: [{ groupCode: "asc" }, { name: "asc" }],
    select: { id: true, code: true, groupCode: true, name: true, sourceCode: true, publishedVersion: true, retiredAt: true, updatedAt: true, versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, status: true } } },
  });
  const groups = CATALOGUE_GROUPS.filter((g) => groupAllowedForKind(g.code, access.kind)).map((g) => g.code);
  return NextResponse.json({
    catalogue: catalogue().filter((e) => groups.includes(e.groupCode)).map((e) => ({ code: e.code, groupCode: e.groupCode, name: e.name })),
    templates,
  });
});

// POST /api/facility/his/templates — adopt a catalogue template, create a custom one, clone or import.
// New templates always start as DRAFT version 1 and must go through review/approval before publication.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const body = await parseBody(req, createSchema);
  const facilityId = access.facility.id;

  let input: { code: string; groupCode: string; name: string; sourceCode: string | null; description: string | null; definition: unknown };
  if (body.mode === "adopt") {
    const entry = catalogueEntry(body.sourceCode);
    if (!entry) throw notFound("Catalogue template not found");
    input = { code: entry.code, groupCode: entry.groupCode, name: entry.name, sourceCode: entry.code, description: null, definition: entry.definition };
  } else if (body.mode === "custom") {
    input = { code: `CUSTOM-${slug(body.name)}-${suffix()}`, groupCode: body.groupCode, name: body.name, sourceCode: null, description: null, definition: body.definition };
  } else if (body.mode === "clone") {
    const original = await prisma.clinicalDocumentTemplate.findFirst({
      where: { id: body.templateId, facilityId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!original || !original.versions[0]) throw notFound("Template not found");
    const name = body.name ?? `${original.name} (copy)`;
    input = { code: `${original.code.slice(0, 100)}-${suffix()}`, groupCode: original.groupCode, name, sourceCode: original.sourceCode, description: original.description, definition: original.versions[0].definition };
  } else {
    const d = body.data;
    input = { code: `${d.sourceCode && catalogueEntry(d.sourceCode) ? d.sourceCode : `IMPORT-${slug(d.name)}`}-${suffix()}`, groupCode: d.groupCode, name: d.name, sourceCode: d.sourceCode && catalogueEntry(d.sourceCode) ? d.sourceCode : null, description: d.description ?? null, definition: d.definition };
  }

  if (!groupAllowedForKind(input.groupCode, access.kind)) throw forbidden("This document group is not available to your organization type");
  let definition = parseDefinition(input.definition);
  const source = input.sourceCode ? catalogueEntry(input.sourceCode)?.definition ?? null : null;
  if (source) {
    definition = carryLocks(source, definition);
    const problems = lockedViolations(source, definition);
    if (problems.length) throw badRequest(problems.join("; "));
  }

  const exists = await prisma.clinicalDocumentTemplate.findUnique({ where: { facilityId_code: { facilityId, code: input.code } }, select: { id: true } });
  if (exists) throw conflict("Your hospital already has this template — open it to create a new version");

  const template = await prisma.clinicalDocumentTemplate.create({
    data: {
      facilityId,
      code: input.code,
      groupCode: input.groupCode,
      name: input.name,
      description: input.description,
      sourceCode: input.sourceCode,
      createdById: user.id,
      versions: { create: { version: 1, status: "DRAFT", definition, editedById: user.id, changeNote: `Created (${body.mode})` } },
    },
    select: { id: true, code: true, name: true },
  });
  await auditHis(access, "HIS_TEMPLATE_CREATED", "ClinicalDocumentTemplate", template.id, req, { details: { mode: body.mode, code: template.code } });
  return NextResponse.json({ template }, { status: 201 });
});
