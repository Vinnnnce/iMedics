import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { patientScope } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";

const caseInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, dateOfBirth: true, gender: true } },
  primaryDoctor: { select: { specialty: true, user: { select: { name: true } } } },
  events: { orderBy: { createdAt: "desc" as const } },
  consultations: {
    orderBy: { createdAt: "desc" as const },
    where: { status: "FINALIZED" },
    select: {
      id: true,
      createdAt: true,
      chiefComplaint: true,
      diagnosis: true,
      followUpDate: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  },
  labOrders: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      createdAt: true,
      panelType: true,
      status: true,
      priority: true,
      orderedBy: { select: { name: true } },
      items: { select: { labTest: { select: { name: true, code: true } } } },
      results: { select: { id: true, status: true } },
    },
  },
  prescriptions: {
    orderBy: { issuedAt: "desc" as const },
    select: {
      id: true,
      issuedAt: true,
      status: true,
      doctor: { select: { user: { select: { name: true } } } },
      items: { select: { drugName: true, dose: true, frequency: true, duration: true } },
    },
  },
  facilityBookings: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      serviceName: true,
      preferredAt: true,
      status: true,
      amount: true,
      currency: true,
    },
  },
} satisfies Prisma.CareCaseInclude;

// GET /api/cases/[id] — full case detail with linked records.
// Authorization is by relationship (patient ownership, doctor care scope, admin),
// never by case number alone. Draft consultations and unverified results are not
// exposed here — only records the patient is already entitled to see.
export const GET = withAuth<{ id: string }>(["PATIENT", "DOCTOR", "ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const careCase = await prisma.careCase.findUnique({ where: { id }, include: caseInclude });
  if (!careCase) throw notFound("Case not found");

  // Payments belong to this episode either directly (case_id) or through the
  // appointment that a consultation of this case was recorded against.
  const episodePayments = await prisma.payment.findMany({ take: 200,
    where: {
      OR: [
        { caseId: id },
        { appointment: { consultations: { some: { caseId: id } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, amount: true, currency: true, status: true, createdAt: true, description: true },
  });

  if (user.role === "PATIENT") {
    const patient = await prisma.patient.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!patient || careCase.patientId !== patient.id) throw notFound("Case not found");
  } else if (user.role === "DOCTOR") {
    const scope = await patientScope(user);
    const accessible = await prisma.patient.findFirst({
      where: { AND: [{ id: careCase.patientId }, scope.where] },
      select: { id: true },
    });
    if (!accessible) throw notFound("Case not found");
  }

  const events = careCase.events.map((e) => ({
    id: e.id,
    status: e.status,
    statusLabel: CARE_CASE_STATUS_LABELS[e.status],
    note: e.note,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({
    case: {
      id: careCase.id,
      caseNumber: careCase.caseNumber,
      type: careCase.type,
      typeLabel: CARE_CASE_TYPE_LABELS[careCase.type],
      status: careCase.status,
      statusLabel: CARE_CASE_STATUS_LABELS[careCase.status],
      specialty: careCase.specialty,
      presentingComplaint: careCase.presentingComplaint,
      diagnosisSummary: careCase.diagnosisSummary,
      followUpDate: careCase.followUpDate,
      closedAt: careCase.closedAt,
      createdAt: careCase.createdAt,
      updatedAt: careCase.updatedAt,
      patient: {
        id: careCase.patient.id,
        name: `${careCase.patient.firstName} ${careCase.patient.lastName}`,
        recordNumber: careCase.patient.caseNumber,
        dateOfBirth: careCase.patient.dateOfBirth,
        gender: careCase.patient.gender,
      },
      primaryDoctor: careCase.primaryDoctor
        ? { name: careCase.primaryDoctor.user.name, specialty: careCase.primaryDoctor.specialty }
        : null,
      consultations: careCase.consultations.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        chiefComplaint: c.chiefComplaint,
        diagnosis: c.diagnosis,
        followUpDate: c.followUpDate,
        doctorName: c.doctor.user.name,
      })),
      labOrders: careCase.labOrders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        panelType: o.panelType,
        status: o.status,
        priority: o.priority,
        orderedBy: o.orderedBy.name,
        tests: o.items.map((i) => i.labTest.name),
        resultCount: o.results.length,
        releasedResults: o.results.filter((r) => r.status === "VERIFIED").length,
      })),
      prescriptions: careCase.prescriptions.map((p) => ({
        id: p.id,
        issuedAt: p.issuedAt,
        status: p.status,
        doctorName: p.doctor.user.name,
        items: p.items.map((i) => ({
          drugName: i.drugName,
          dose: i.dose,
          frequency: i.frequency,
          duration: i.duration,
        })),
      })),
      payments: episodePayments.map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        description: p.description,
      })),
      facilityBookings: careCase.facilityBookings.map((b) => ({
        id: b.id,
        serviceName: b.serviceName,
        preferredAt: b.preferredAt,
        status: b.status,
        amount: Number(b.amount),
        currency: b.currency,
      })),
      events,
    },
  });
});

// This route intentionally has no POST/PATCH — case creation happens through
// clinical workflows and status changes go through /api/cases/[id]/status.
