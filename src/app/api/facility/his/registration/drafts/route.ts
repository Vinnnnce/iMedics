/**
 * GET/POST /api/facility/his/registration/drafts
 *
 * Incomplete registration workspace drafts for this facility. A draft stores
 * the full stepper form state as JSON so registration can be paused and
 * resumed. Only the author may modify or discard a draft; every action is
 * audited and drafts are always scoped to the caller's facility.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  label: z.string().trim().min(1).max(160),
  payload: z.record(z.string(), z.unknown()),
});

export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const where = mine
    ? { facilityId: access.facility.id, createdById: user.id, status: "DRAFT" as const }
    : { facilityId: access.facility.id, status: "DRAFT" as const };
  const drafts = await prisma.registrationDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, label: true, payload: true, updatedAt: true, createdAt: true, status: true, createdById: true,
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json({
    drafts: drafts.map((d) => ({
      id: d.id, label: d.label, payload: d.payload, status: d.status,
      createdAt: d.createdAt, updatedAt: d.updatedAt, mine: d.createdById === user.id,
      createdBy: d.createdBy?.name ?? "Unknown",
    })),
  });
});

export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  const draft = await prisma.registrationDraft.create({
    data: {
      facilityId: access.facility.id,
      createdById: user.id,
      label: body.label,
      payload: body.payload as Prisma.InputJsonValue,
    },
    select: { id: true, label: true, createdAt: true },
  });
  await auditHis(access, "REGISTRATION_DRAFT_SAVED", "RegistrationDraft", draft.id, req, {
    details: { label: body.label },
  });
  return NextResponse.json({ draft }, { status: 201 });
});
