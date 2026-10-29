import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { writeAudit } from "@/lib/audit";

// Must stay in sync with the FacilityDocumentTemplateKind Prisma enum — the
// clinical document kinds extend the base set for the new modules.
const TEMPLATE_KINDS = [
  "LAB_REPORT",
  "REFERRAL_FORM",
  "CASE_NOTE",
  "IMAGING_REPORT",
  "DISCHARGE_SUMMARY",
  "EPICRISIS",
  "ADMISSION_NOTE",
  "PROGRESS_NOTE",
  "TRANSFER_SUMMARY",
  "DIAGNOSTIC_REPORT",
] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "A template needs a name").max(80),
  kind: z.enum(TEMPLATE_KINDS),
  /** JSON-encoded scaffold fields; keys are free-form, values are text. */
  content: z.string().min(1).max(20000),
});

const querySchema = z.object({
  facilityId: z.string().uuid().optional(),
  kind: z.enum(TEMPLATE_KINDS).optional(),
});

// GET /api/facility/document-templates — the facility's document templates.
export const GET = withAuth(["DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user }) => {
  const query = parseQuery(req, querySchema);
  const { facility } = await requireFacilityAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);

  const templates = await prisma.facilityDocumentTemplate.findMany({
    where: { facilityId: facility.id, ...(query.kind ? { kind: query.kind } : {}) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, kind: true, content: true,
      createdAt: true, updatedAt: true, createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ templates });
});

// POST /api/facility/document-templates — save a document scaffold for the
// facility. Structure only (field prompts); patient data is never stored.
export const POST = withAuth(["DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  const { facility } = await requireFacilityAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);

  let fields: unknown;
  try {
    fields = JSON.parse(data.content);
  } catch {
    return NextResponse.json(
      { error: "Template content must be a JSON object of scaffold fields" },
      { status: 400 },
    );
  }
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    return NextResponse.json(
      { error: "Template content must be a JSON object of scaffold fields" },
      { status: 400 },
    );
  }

  const template = await prisma.facilityDocumentTemplate.create({
    data: {
      facilityId: facility.id,
      createdById: user.id,
      name: data.name,
      kind: data.kind,
      content: data.content,
    },
    select: {
      id: true, name: true, kind: true, content: true,
      createdAt: true, updatedAt: true, createdBy: { select: { name: true } },
    },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_DOCUMENT_TEMPLATE_CREATED",
    resourceType: "FacilityDocumentTemplate",
    resourceId: template.id,
    req,
  });

  return NextResponse.json({ template }, { status: 201 });
});
