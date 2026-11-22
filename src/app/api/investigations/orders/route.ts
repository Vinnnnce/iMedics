import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { orderInput, saveDraft, submitOrder } from "@/lib/investigations/orders";
import { COMPLETED_STATUSES, PENDING_STATUSES } from "@/lib/investigations/constants";

const createSchema = orderInput.extend({ submit: z.boolean().default(false), authorise: z.boolean().default(false) });

// POST /api/investigations/orders — save a draft, or submit straight away with electronic authorisation.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  await getVerifiedDoctorProfile(user);
  const { submit, authorise, ...input } = await parseBody(req, createSchema);
  const id = await saveDraft(user, input);
  if (!submit) return NextResponse.json({ success: true, id, status: "DRAFT" }, { status: 201 });
  try {
    const result = await submitOrder(user, id, { authorise, req });
    return NextResponse.json({ success: true, ...result, status: "SUBMITTED" }, { status: 201 });
  } catch (error) {
    // Keep the draft so nothing the doctor typed is lost; tell them where it is.
    const message = error instanceof Error ? error.message : "Could not submit the order";
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ error: message, draftId: id }, { status });
  }
});

const listSchema = z.object({
  tab: z.enum(["all", "laboratory", "diagnostic", "pending", "in_progress", "completed", "released", "critical", "custom", "drafts"]).default("all"),
  patientId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/investigations/orders — the doctor's orders, one row per investigation, filtered by tab.
export const GET = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const { tab, patientId, q, limit } = parseQuery(req, listSchema);

  const itemWhere: Prisma.InvestigationOrderItemWhereInput = {};
  if (tab === "laboratory") itemWhere.domain = "LABORATORY";
  if (tab === "diagnostic") itemWhere.domain = "DIAGNOSTIC";
  if (tab === "pending") itemWhere.status = { in: PENDING_STATUSES };
  if (tab === "in_progress") itemWhere.status = { notIn: [...PENDING_STATUSES, ...COMPLETED_STATUSES, "CANCELLED"] };
  if (tab === "completed" || tab === "released") itemWhere.status = { in: COMPLETED_STATUSES };
  if (tab === "custom") itemWhere.isCustom = true;
  if (tab === "critical") itemWhere.results = { some: { alerts: { some: {} } } };
  if (q) itemWhere.OR = [{ nameSnapshot: { contains: q, mode: "insensitive" } }, { order: { orderNumber: { contains: q, mode: "insensitive" } } }, { order: { patient: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { caseNumber: { contains: q, mode: "insensitive" } }] } } }];

  // Doctors see their own orders plus orders for patients in their care.
  const orderWhere: Prisma.InvestigationOrderWhereInput = {
    OR: [{ requestedById: user.id }, { patient: { assignments: { some: { doctorId: doctor.id } } } }],
    status: tab === "drafts" ? "DRAFT" : { not: "DRAFT" },
    ...(patientId ? { patientId } : {}),
  };

  if (tab === "drafts") {
    const drafts = await prisma.investigation_orders.findMany({
      where: { ...orderWhere, requestedById: user.id }, orderBy: { updatedAt: "desc" }, take: limit,
      select: { id: true, orderNumber: true, domain: true, priority: true, updatedAt: true, patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } }, items: { select: { nameSnapshot: true } } },
    });
    return NextResponse.json({ drafts });
  }

  const items = await prisma.investigation_order_items.findMany({
    where: { ...itemWhere, order: orderWhere },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, orderId: true, domain: true, nameSnapshot: true, isCustom: true, departmentKey: true, status: true, statusChangedAt: true, priority: true, createdAt: true, dueAt: true,
      performingFacility: { select: { id: true, laboratoryName: true } },
      order: { select: { id: true, orderNumber: true, patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } } },
      results: { orderBy: { version: "desc" }, take: 3, select: { id: true, version: true, status: true, releasedAt: true, alerts: { select: { id: true, status: true } } } },
    },
  });

  return NextResponse.json({
    items: items.map(({ results, performingFacility, ...i }) => {
      const released = results.find((r) => r.status === "RELEASED");
      const alert = results.flatMap((r) => r.alerts)[0] ?? null;
      return {
        ...i,
        facility: performingFacility ? { id: performingFacility.id, name: performingFacility.laboratoryName } : null,
        resultAvailable: !!released,
        verificationStatus: released ? "RELEASED" : (results[0]?.status ?? null),
        criticalAlert: alert,
      };
    }),
  });
});
