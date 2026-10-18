import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { presignUpload } from "@/lib/storage";
import {
  createDocumentSchema, documentStorageKey, auditDocumentAccess,
  DOCUMENT_CATEGORY_LABELS, MAX_DOCUMENT_BYTES,
} from "@/lib/documents";

/**
 * Patient medical documents.
 * - GET: list the caller's documents (patients) or a patient's documents
 *   (assigned doctors), with search and category filters.
 * - POST: create a document record and return a presigned upload URL. Patients
 *   upload for themselves; assigned clinicians can attach reports to a patient.
 */

const listQuery = z.object({
  patientId: z.string().uuid().optional(),
  category: z.string().max(30).optional(),
  q: z.string().trim().max(100).optional(),
});

export const GET = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req, { user }) => {
  const query = parseQuery(req, listQuery);
  let patientId: string;
  if (query.patientId) {
    patientId = (await findAccessiblePatient(user, query.patientId)).id;
  } else if (user.role === "PATIENT") {
    patientId = (await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } })).id;
  } else {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const documents = await prisma.patientDocument.findMany({
    where: {
      patientId,
      deletedAt: null,
      ...(query.category && query.category in DOCUMENT_CATEGORY_LABELS ? { category: query.category as never } : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { shares: { where: { revokedAt: null }, include: { sharedWithUser: { select: { id: true, name: true, role: true } } } } },
  });
  return NextResponse.json({ documents });
});

export const POST = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { user }) => {
  const body = await parseBody(req, createDocumentSchema);
  if (body.sizeBytes > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Files are limited to 20 MB" }, { status: 400 });
  }

  let patientId: string;
  if (body.patientId) {
    // Clinician attaching a report to an assigned patient's record.
    patientId = (await findAccessiblePatient(user, body.patientId, { write: true })).id;
  } else if (user.role === "PATIENT") {
    patientId = (await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } })).id;
  } else {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const storageKey = documentStorageKey(patientId, body.fileName);
  const document = await prisma.patientDocument.create({
    data: {
      patientId,
      category: body.category,
      title: body.title,
      fileName: body.fileName,
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      issuedOn: body.issuedOn,
      issuingFacility: body.issuingFacility,
      notes: body.notes,
      uploadedById: user.id,
    },
  });

  await auditDocumentAccess(user, document.id, patientId, "DOCUMENT_UPLOAD_CREATED", { category: body.category, sizeBytes: body.sizeBytes });

  const uploadUrl = await presignUpload(storageKey, body.mimeType, body.sizeBytes);
  return NextResponse.json({ document, uploadUrl }, { status: 201 });
});
