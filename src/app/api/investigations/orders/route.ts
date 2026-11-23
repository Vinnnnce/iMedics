import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { orderInput, saveDraft, submitOrder } from "@/lib/investigations/orders";
import { COMPLETED_STATUSES, PENDING_STATUSES } from "@/lib/investigations/constants";
import { toDto, toDtos } from "@/lib/investigations/serialize";

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

  const itemWhere: Prisma.investigation_order_itemsWhereInput = {};
  if (tab === "laboratory") itemWhere.domain = "LABORATORY";
  if (tab === "diagnostic") itemWhere.domain = "DIAGNOSTIC";
  if (tab === "pending") itemWhere.status = { in: PENDING_STATUSES };
  if (tab === "in_progress") itemWhere.status = { notIn: [...PENDING_STATUSES, ...COMPLETED_STATUSES, "CANCELLED"] };
  if (tab === "completed" || tab === "released") itemWhere.status = { in: COMPLETED_STATUSES };
  if (tab === "custom") itemWhere.is_custom = true;
  if (tab === "critical") itemWhere.investigation_results = { some: { investigation_critical_alerts: { isNot: null } } };
  if (q) itemWhere.OR = [{ name_snapshot: { contains: q, mode: "insensitive" } }, { investigation_orders: { order_number: { contains: q, mode: "insensitive" } } }, { investigation_orders: { patients: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { caseNumber: { contains: q, mode: "insensitive" } }] } } }];

  // Doctors see their own orders plus orders for patients in their care.
  const orderWhere: Prisma.investigation_ordersWhereInput = {
    OR: [{ requested_by_id: user.id }, { patients: { assignments: { some: { doctorId: doctor.id } } } }],
    status: tab === "drafts" ? "DRAFT" : { not: "DRAFT" },
    ...(patientId ? { patient_id: patientId } : {}),
  };

  if (tab === "drafts") {
    const drafts = await prisma.investigation_orders.findMany({
      where: { ...orderWhere, requested_by_id: user.id }, orderBy: { updated_at: "desc" }, take: limit,
      select: { id: true, order_number: true, domain: true, priority: true, updated_at: true, patients: { select: { id: true, firstName: true, lastName: true, caseNumber: true } }, investigation_order_items: { select: { name_snapshot: true } } },
    });
    return NextResponse.json({ drafts: toDtos("order", drafts) });
  }

  const items = await prisma.investigation_order_items.findMany({
    where: { ...itemWhere, investigation_orders: orderWhere },
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true, order_id: true, domain: true, name_snapshot: true, is_custom: true, department_key: true, status: true, status_changed_at: true, priority: true, created_at: true, due_at: true,
      lab_staff_profiles: { select: { id: true, laboratoryName: true } },
      investigation_orders: { select: { id: true, order_number: true, patients: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } } },
    },
  });

  // The three latest report versions per item (the item's own result relation is 1:1, so versions are read directly).
  const versions = items.length
    ? await prisma.investigation_results.findMany({
        where: { item_id: { in: items.map((i) => i.id) } },
        orderBy: { version: "desc" },
        select: { id: true, item_id: true, version: true, status: true, released_at: true, investigation_critical_alerts: { select: { id: true, status: true } } },
      })
    : [];
  const versionsByItem = Map.groupBy(versions, (v) => v.item_id);

  return NextResponse.json({
    items: items.map(({ lab_staff_profiles, ...i }) => {
      const results = (versionsByItem.get(i.id) ?? []).slice(0, 3);
      const released = results.find((r) => r.status === "RELEASED");
      const alert = results.find((r) => r.investigation_critical_alerts)?.investigation_critical_alerts ?? null;
      return {
        ...toDto("item", i),
        facility: lab_staff_profiles ? { id: lab_staff_profiles.id, name: lab_staff_profiles.laboratoryName } : null,
        resultAvailable: !!released,
        verificationStatus: released ? "RELEASED" : (results[0]?.status ?? null),
        criticalAlert: alert ? toDto("alert", alert) : null,
      };
    }),
  });
});
