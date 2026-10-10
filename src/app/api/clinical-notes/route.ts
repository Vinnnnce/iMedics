import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { findAccessiblePatient, getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  type: z.enum(["PROGRESS", "ASSESSMENT", "PLAN"]),
  content: z.string().trim().min(1, "A note cannot be empty").max(5000),
  visibleToPatient: z.boolean().default(false),
});

// POST /api/clinical-notes — a doctor writes a progress / assessment / plan note.
// Only notes marked visibleToPatient ever appear on the patient's diagnostics page.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  const doctor = await getVerifiedDoctorProfile(user);
  await findAccessiblePatient(user, data.patientId, { write: true });

  if (data.consultationId) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: data.consultationId, patientId: data.patientId, doctorId: doctor.id },
      select: { id: true },
    });
    if (!consultation) throw badRequest("That consultation does not belong to this patient");
  }

  const note = await prisma.clinicalNote.create({
    data: {
      patientId: data.patientId,
      authorId: doctor.id,
      consultationId: data.consultationId,
      type: data.type,
      content: data.content,
      visibleToPatient: data.visibleToPatient,
    },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "CLINICAL_NOTE_CREATED",
    resourceType: "ClinicalNote",
    resourceId: note.id,
    req,
  });

  return NextResponse.json({ success: true, note }, { status: 201 });
});

const listSchema = z.object({ patientId: z.string().uuid() });

// GET /api/clinical-notes?patientId= — doctors see every note; patients only the ones shared with them.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId } = parseQuery(req, listSchema);
  await findAccessiblePatient(user, patientId);

  const notes = await prisma.clinicalNote.findMany({
    where: { patientId, ...(user.role === "PATIENT" ? { visibleToPatient: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { author: { select: { user: { select: { name: true } } } } },
  });

  return NextResponse.json({
    notes: notes.map(({ author, ...note }) => ({ ...note, author: author.user.name })),
  });
});
