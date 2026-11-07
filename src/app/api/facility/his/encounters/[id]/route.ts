import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { TERMINAL_STATUSES, canTransition } from "@/lib/his/encounters";

const STATUSES = ["REGISTERED", "AWAITING_TRIAGE", "TRIAGED", "AWAITING_CLINICIAN", "UNDER_ASSESSMENT", "AWAITING_INVESTIGATIONS", "AWAITING_SPECIALIST", "AWAITING_TREATMENT", "AWAITING_ADMISSION", "ADMITTED", "IN_PROCEDURE", "RECOVERING", "AWAITING_DISCHARGE", "DISCHARGED", "TRANSFERRED", "CANCELLED", "DID_NOT_ATTEND"] as const;

const schema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(["EMERGENCY", "URGENT", "SEMI_URGENT", "ROUTINE", "ELECTIVE"]).optional(),
  triageCategory: z.string().trim().min(1).max(60).optional(),
  department: z.string().trim().max(120).optional(),
  clinicianName: z.string().trim().max(160).optional(),
  note: z.string().trim().max(1000).optional(),
});

// PATCH /api/facility/his/encounters/[id] — workflow status, priority, triage and assignment.
// Triage categories must come from the hospital's configured, approved local protocol.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, schema);
  const enc = await prisma.encounter.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!enc) throw notFound("Encounter not found");
  if (TERMINAL_STATUSES.includes(enc.status)) throw conflict("This encounter is closed");

  let status = body.status;
  let triage: { triageCategory: string; triageProtocol: string; triagedById: string; triagedAt: Date } | null = null;
  if (body.triageCategory) {
    const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { triageProtocol: true, triageCategories: true } });
    if (!settings?.triageProtocol || !settings.triageCategories.includes(body.triageCategory)) {
      throw badRequest("Configure your hospital's approved triage protocol and categories in Hospital settings first");
    }
    triage = { triageCategory: body.triageCategory, triageProtocol: settings.triageProtocol, triagedById: user.id, triagedAt: new Date() };
    status = status ?? "TRIAGED";
  }
  if (status && !canTransition(enc.status, status)) throw conflict(`Cannot move from ${enc.status} to ${status}`);
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.encounter.updateMany({
      where: { id, updatedAt: enc.updatedAt },
      data: {
        ...(status ? { status, statusChangedAt: now, ...(TERMINAL_STATUSES.includes(status) ? { closedAt: now } : {}) } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        ...(body.department !== undefined ? { department: body.department } : {}),
        ...(body.clinicianName !== undefined ? { clinicianName: body.clinicianName } : {}),
        ...(triage ?? {}),
      },
    });
    if (res.count === 0) throw conflict("The encounter changed in the meantime — reload and try again");
    if (status || body.priority || triage) {
      await tx.encounterStatusEvent.create({
        data: { encounterId: id, fromStatus: enc.status, toStatus: status ?? enc.status, priority: body.priority ?? null, actorId: user.id, note: [triage ? `Triage: ${triage.triageCategory} (${triage.triageProtocol})` : null, body.note].filter(Boolean).join(" · ") || null },
      });
    }
    return tx.encounter.findUnique({ where: { id }, select: { id: true, status: true, priority: true, triageCategory: true } });
  });
  await auditHis(access, "HIS_ENCOUNTER_UPDATED", "Encounter", id, req, { patientId: enc.patientId, details: { status: status ?? null, priority: body.priority ?? null } });
  return NextResponse.json({ encounter: updated });
});
