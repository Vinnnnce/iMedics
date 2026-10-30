import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { auditHis, documentEvent } from "@/lib/his/audit";
import { groupAllowedForKind } from "@/lib/his/catalogue";
import { formatNumber, nextSequence } from "@/lib/his/numbering";
import { parseDefinition, validateContent } from "@/lib/his/template-schema";
import { documentVisibility } from "@/lib/his/visibility";

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PENDING_SIGNATURE", "FINAL", "AMENDED", "ENTERED_IN_ERROR"] as const;

const listSchema = z.object({
  patientId: z.string().uuid().optional(),
  status: z.enum(STATUSES).optional(),
  groupCode: z.string().max(10).optional(),
  q: z.string().trim().max(100).optional(),
  mine: z.enum(["1"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createSchema = z.object({
  templateId: z.string().uuid(),
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  department: z.string().trim().max(120).optional(),
});

// GET /api/facility/his/documents — this hospital's clinical documents (worklist / search).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const q = parseQuery(req, listSchema);
  if (q.patientId) await assertPatientLinked(access.facility.id, q.patientId);
  const documents = await prisma.clinicalDocument.findMany({
    where: {
      facilityId: access.facility.id,
      AND: [documentVisibility(user.id, access.permissions.includes("REVIEW_DOCUMENTS"))],
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.groupCode ? { groupCode: q.groupCode } : {}),
      ...(q.mine ? { authorId: user.id } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" as const } }, { documentNumber: { contains: q.q.toUpperCase() } }, { patient: { caseNumber: q.q.toUpperCase() } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: q.limit,
    select: {
      id: true, documentNumber: true, title: true, groupCode: true, status: true, sensitivity: true, revision: true, updatedAt: true, releasedToPatientAt: true,
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
      author: { select: { name: true } },
    },
  });
  return NextResponse.json({ documents });
});

// POST /api/facility/his/documents — start a DRAFT from a published template version.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "AUTHOR_DOCUMENTS", req);
  const body = await parseBody(req, createSchema);
  const facilityId = access.facility.id;
  await assertPatientLinked(facilityId, body.patientId);

  const template = await prisma.clinicalDocumentTemplate.findFirst({
    where: { id: body.templateId, facilityId, retiredAt: null, publishedVersion: { not: null } },
    include: { versions: { where: { status: "PUBLISHED" }, take: 1 } },
  });
  const version = template?.versions[0];
  if (!template || !version) throw notFound("No published version of this template");
  if (!groupAllowedForKind(template.groupCode, access.kind)) throw forbidden("This document group is not available to your organization type");
  const definition = parseDefinition(version.definition);
  if (definition.authorRoles.length && !definition.authorRoles.includes(access.facilityRole)) {
    throw forbidden("Your role is not authorized to create this document type");
  }
  if (body.encounterId) {
    const enc = await prisma.encounter.findFirst({ where: { id: body.encounterId, facilityId, patientId: body.patientId }, select: { id: true } });
    if (!enc) throw notFound("Encounter not found");
  }
  if (body.admissionId) {
    const adm = await prisma.admission.findFirst({ where: { id: body.admissionId, facilityId, patientId: body.patientId }, select: { id: true } });
    if (!adm) throw notFound("Admission not found");
  }

  const defaults: Record<string, unknown> = {};
  for (const s of definition.sections) for (const f of s.fields) if (f.defaultValue !== undefined) defaults[f.id] = f.defaultValue;
  const { content } = validateContent(definition, defaults, { complete: false });

  const doc = await prisma.$transaction(async (tx) => {
    const settings = await tx.hospitalSettings.findUnique({ where: { facilityId }, select: { documentNumberPrefix: true } });
    const year = new Date().getUTCFullYear();
    const seq = await nextSequence(tx, facilityId, "document", year);
    const created = await tx.clinicalDocument.create({
      data: {
        facilityId,
        patientId: body.patientId,
        encounterId: body.encounterId ?? null,
        admissionId: body.admissionId ?? null,
        templateVersionId: version.id,
        documentNumber: formatNumber(settings?.documentNumberPrefix ?? "DOC", year, seq),
        title: template.name,
        groupCode: template.groupCode,
        department: body.department ?? null,
        sensitivity: definition.sensitivity,
        content,
        authorId: user.id,
      },
      select: { id: true, documentNumber: true },
    });
    await documentEvent(tx, created.id, "CREATED", user.id, `From ${template.name} v${version.version}`);
    return created;
  }).catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw conflict("Please try again");
    throw e;
  });

  await auditHis(access, "HIS_DOCUMENT_CREATED", "ClinicalDocument", doc.id, req, { patientId: body.patientId });
  return NextResponse.json({ document: doc }, { status: 201 });
});
