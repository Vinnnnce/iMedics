/**
 * PATCH/DELETE /api/facility/his/registration/drafts/[id]
 *
 * Update or discard a registration draft. Only the author may modify or
 * discard a draft; the draft is always scoped to the caller's facility.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { forbidden, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const draft = await prisma.registrationDraft.findFirst({
    where: { id, facilityId: access.facility.id, status: "DRAFT" },
    select: { id: true, createdById: true },
  });
  if (!draft) throw notFound("Draft not found");
  if (draft.createdById !== user.id) throw forbidden("Only the author may modify this draft");
  const updated = await prisma.registrationDraft.update({
    where: { id },
    data: {
      ...(body.label ? { label: body.label } : {}),
      ...(body.payload ? { payload: body.payload as Prisma.InputJsonValue } : {}),
    },
    select: { id: true, label: true, updatedAt: true },
  });
  await auditHis(access, "REGISTRATION_DRAFT_UPDATED", "RegistrationDraft", id, req, {
    details: { label: updated.label },
  });
  return NextResponse.json({ draft: updated });
});

export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const draft = await prisma.registrationDraft.findFirst({
    where: { id, facilityId: access.facility.id, status: "DRAFT" },
    select: { id: true, createdById: true },
  });
  if (!draft) throw notFound("Draft not found");
  if (draft.createdById !== user.id) throw forbidden("Only the author may discard this draft");
  await prisma.registrationDraft.update({ where: { id }, data: { status: "DISCARDED" } });
  await auditHis(access, "REGISTRATION_DRAFT_DISCARDED", "RegistrationDraft", id, req, {});
  return NextResponse.json({ success: true });
});
