import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { admissionIsEditable } from "@/lib/modules/workflows";
import { badRequest, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const vitalsSchema = z
  .object({
    temperature: z.number().min(30).max(45).optional(),
    pulse: z.number().int().min(20).max(300).optional(),
    systolic: z.number().int().min(50).max(300).optional(),
    diastolic: z.number().int().min(30).max(200).optional(),
    respiratoryRate: z.number().int().min(4).max(80).optional(),
    oxygenSaturation: z.number().int().min(50).max(100).optional(),
  })
  .optional();

const noteSchema = z.object({
  type: z.enum([
    "ADMISSION_EXAMINATION",
    "PHYSICIAN_PROGRESS",
    "NURSING_OBSERVATION",
    "SPECIALIST_CONSULTATION",
    "PROCEDURE_REPORT",
  ]),
  content: z.string().trim().min(1).max(10000),
  vitals: vitalsSchema,
});

// POST /api/facility/admissions/[id]/notes — daily progress / nursing notes (Module 01, Category 03).
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, noteSchema);

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true, patientId: true },
  });
  if (!admission) throw notFound("Admission not found");
  if (!admissionIsEditable(admission.status)) {
    throw badRequest("Notes can only be added to an active admission");
  }

  const note = await prisma.admissionNote.create({
    data: {
      admissionId: id,
      authorId: user.id,
      type: data.type,
      content: data.content,
      ...(data.vitals ? { vitals: data.vitals } : {}),
    },
    select: { id: true, createdAt: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMISSION_NOTE_ADDED",
    resourceType: "Admission",
    resourceId: id,
    details: { noteId: note.id, noteType: data.type },
    req,
  });

  return NextResponse.json({ success: true, note }, { status: 201 });
});
