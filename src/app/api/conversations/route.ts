import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { findAccessiblePatient, getVerifiedDoctorProfile } from "@/lib/access";
import { conversationAccess } from "@/lib/chat";
import { badRequest, forbidden, notFound } from "@/lib/errors";

// GET /api/conversations — the caller's conversations, most recently active first
export const GET = withAuth(["DOCTOR", "PATIENT"], async (_req, { user }) => {
  const conversations = await prisma.conversation.findMany({
    where: conversationAccess(user),
    take: 100,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
      _count: { select: { messages: { where: { readAt: null, senderId: { not: user.id } } } } },
    },
  });

  const rows = conversations
    .map(({ patient, doctor, messages, _count, ...c }) => ({
      id: c.id,
      with: user.role === "DOCTOR" ? `${patient.firstName} ${patient.lastName}` : doctor.user.name,
      patientId: patient.id,
      doctorId: doctor.id,
      lastMessage: messages[0] ?? null,
      unread: _count.messages,
      createdAt: c.createdAt,
    }))
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.createdAt).getTime() - (a.lastMessage?.createdAt ?? a.createdAt).getTime());

  return NextResponse.json({ conversations: rows });
});

const startSchema = z.object({ patientId: z.string().uuid().optional(), doctorId: z.string().uuid().optional() });

// POST /api/conversations — start (or reopen) a conversation within an existing care relationship.
//  - doctors pass { patientId } for a patient in their care
//  - patients pass { doctorId } for a doctor who has accepted their booking
export const POST = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId, doctorId } = await parseBody(req, startSchema);

  let pair: { patientId: string; doctorId: string };
  if (user.role === "DOCTOR") {
    if (!patientId) throw badRequest("patientId is required");
    const doctor = await getVerifiedDoctorProfile(user);
    await findAccessiblePatient(user, patientId, { write: true });
    pair = { patientId, doctorId: doctor.id };
  } else {
    if (!doctorId) throw badRequest("doctorId is required");
    const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
    if (!patient) throw notFound("Patient record not found");
    const assignment = await prisma.patientAssignment.findFirst({
      where: { patientId: patient.id, doctorId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!assignment) throw forbidden("You can message a doctor once they have accepted your booking");
    pair = { patientId: patient.id, doctorId };
  }

  const conversation = await prisma.conversation.upsert({
    where: { patientId_doctorId: pair },
    create: pair,
    update: {},
    select: { id: true },
  });
  return NextResponse.json({ id: conversation.id });
});
