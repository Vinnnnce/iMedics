import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { TERMINAL_STATUSES, canTransition } from "@/lib/his/encounters";

/**
 * PATCH /api/facility/his/emergency/[id] — emergency encounter actions:
 * triage assessment (validated against the hospital's approved protocol),
 * vitals + pain score, reassessment scheduling, clinician assignment and
 * workflow transitions. All updates are audited.
 */

const STATUSES = ["REGISTERED", "AWAITING_TRIAGE", "TRIAGED", "AWAITING_CLINICIAN", "UNDER_ASSESSMENT", "AWAITING_INVESTIGATIONS", "AWAITING_SPECIALIST", "AWAITING_TREATMENT", "AWAITING_ADMISSION", "ADMITTED", "IN_PROCEDURE", "RECOVERING", "AWAITING_DISCHARGE", "DISCHARGED", "TRANSFERRED", "CANCELLED", "DID_NOT_ATTEND"] as const;

const schema = z.object({
  status: z.enum(STATUSES).optional(),
  triageCategory: z.string().trim().min(1).max(60).optional(),
  vitals: z.record(z.string(), z.unknown()).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  reassessmentInMinutes: z.number().int().min(5).max(720).optional(),
  clinicianName: z.string().trim().max(160).optional(),
  chiefComplaint: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, schema);

  const enc = await prisma.encounter.findFirst({ where: { id, facilityId: access.facility.id, isEmergency: true } });
  if (!enc) throw notFound("Emergency encounter not found");
  if (TERMINAL_STATUSES.includes(enc.status)) throw conflict("This encounter is closed");

  let status = body.status;
  let triage: { triageCategory: string; triageProtocol: string; triagedById: string; triagedAt: Date } | null = null;
  if (body.triageCategory) {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { facilityId: access.facility.id },
      select: { triageProtocol: true, triageCategories: true },
    });
    if (!settings?.triageProtocol || !settings.triageCategories.includes(body.triageCategory)) {
      throw badRequest("Triage category must come from the hospital's configured triage protocol (see Hospital settings)");
    }
    triage = { triageCategory: body.triageCategory, triageProtocol: settings.triageProtocol, triagedById: user.id, triagedAt: new Date() };
    status = status ?? (enc.status === "AWAITING_TRIAGE" || enc.status === "REGISTERED" ? "TRIAGED" : enc.status);
  }
  if (status && !canTransition(enc.status, status)) throw conflict(`Cannot move from ${enc.status} to ${status}`);

  const reassessmentDueAt = body.reassessmentInMinutes
    ? new Date(Date.now() + body.reassessmentInMinutes * 60_000)
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.encounter.updateMany({
      where: { id, updatedAt: enc.updatedAt },
      data: {
        ...(status ? { status, statusChangedAt: new Date(), ...(TERMINAL_STATUSES.includes(status) ? { closedAt: new Date() } : {}) } : {}),
        ...(triage ?? {}),
        ...(body.clinicianName !== undefined ? { clinicianName: body.clinicianName } : {}),
        ...(body.chiefComplaint !== undefined ? { chiefComplaint: body.chiefComplaint } : {}),
        ...(reassessmentDueAt ? { reassessmentDueAt } : {}),
      },
    });
    if (res.count === 0) throw conflict("The encounter changed in the meantime — reload and try again");

    if (body.vitals) {
      // Vitals are recorded as nursing observations linked to the encounter.
      const UNITS: Record<string, string> = {
        temperature: "°C", pulse: "bpm", heartRate: "bpm", bloodPressure: "mmHg",
        respiratoryRate: "/min", spo2: "%", oxygenSaturation: "%", glucose: "mmol/L",
      };
      for (const [key, raw] of Object.entries(body.vitals)) {
        const value = typeof raw === "string" ? raw : String(raw);
        if (!value) continue;
        await tx.nursingObservation.create({
          data: {
            facilityId: access.facility.id,
            patientId: enc.patientId,
            encounterId: id,
            recordedById: user.id,
            observationType: key.replace(/([A-Z])/g, "_$1").toUpperCase().slice(0, 40),
            value: value.slice(0, 60),
            unit: UNITS[key]?.slice(0, 20) ?? "",
            recordedAt: new Date(),
          },
        });
      }
    }
    if (body.painScore !== undefined) {
      await tx.nursingObservation.create({
        data: {
          facilityId: access.facility.id,
          patientId: enc.patientId,
          encounterId: id,
          recordedById: user.id,
          observationType: "PAIN_SCORE",
          value: `${body.painScore}`,
          unit: "/10",
          recordedAt: new Date(),
        },
      });
    }

    if (status || body.triageCategory || body.vitals) {
      await tx.encounterStatusEvent.create({
        data: {
          encounterId: id,
          fromStatus: enc.status,
          toStatus: status ?? enc.status,
          actorId: user.id,
          note: [
            triage ? `Triage: ${triage.triageCategory} (${triage.triageProtocol})` : null,
            body.painScore !== undefined ? `Pain score: ${body.painScore}/10` : null,
            body.note,
          ].filter(Boolean).join(" · ") || null,
        },
      });
    }
    return tx.encounter.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, triageCategory: true, reassessmentDueAt: true, priority: true },
    });
  });

  await auditHis(access, "ED_ENCOUNTER_UPDATED", "Encounter", id, req, {
    patientId: enc.patientId,
    details: { status: status ?? null, triageCategory: body.triageCategory ?? null, reassessmentInMinutes: body.reassessmentInMinutes ?? null },
  });
  return NextResponse.json({ encounter: updated });
});
