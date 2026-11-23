import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireDoctorOrderAccess } from "@/lib/investigations/access";
import { orderInput, saveDraft } from "@/lib/investigations/orders";
import { conflict } from "@/lib/errors";
import { releasedResultFor } from "@/lib/investigations/results";
import { toDto } from "@/lib/investigations/serialize";

type Params = { id: string };

// GET /api/investigations/orders/[id] — order with items, status history and released results only.
export const GET = withAuth<Params>(["DOCTOR"], async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const base = await requireDoctorOrderAccess(user, id);
  const order = await prisma.investigation_orders.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      patients: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } },
      users: { select: { name: true } },
      investigation_order_items: {
        orderBy: { created_at: "asc" },
        include: {
          lab_staff_profiles: { select: { id: true, laboratoryName: true, city: true, state: true } },
          investigation_status_history: { orderBy: { created_at: "asc" } },
          investigation_specimens: { select: { id: true, accession_number: true, barcode: true, status: true, rejection_reason: true, collected_at: true, received_at: true } },
          investigation_referrals: { orderBy: { created_at: "desc" } },
        },
      },
    },
  });

  // Every report version per item, newest first (the item's own result relation is 1:1, so versions are read directly).
  const versions = await prisma.investigation_results.findMany({
    where: { item_id: { in: order.investigation_order_items.map((it) => it.id) } },
    orderBy: { version: "desc" },
    select: { id: true, item_id: true, version: true, status: true, released_at: true, investigation_critical_alerts: { include: { investigation_alert_events: { orderBy: { created_at: "asc" } } } } },
  });
  const versionsByItem = Map.groupBy(versions, (v) => v.item_id);

  const items = await Promise.all(
    order.investigation_order_items.map(async (it) => {
      const released = await releasedResultFor(it.id);
      return {
        ...toDto("item", { ...it, investigation_results: versionsByItem.get(it.id) ?? [] }),
        released: released ? toDto("result", released) : null,
      };
    }),
  );
  return NextResponse.json({ order: { ...toDto("order", { ...order, investigation_order_items: undefined }), items } });
});

// PATCH /api/investigations/orders/[id] — replace the contents of a draft.
export const PATCH = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const input = await parseBody(req, orderInput);
  await saveDraft(user, input, id);
  return NextResponse.json({ success: true, id });
});

// DELETE /api/investigations/orders/[id] — discard a draft. Submitted orders are cancelled item by item instead.
export const DELETE = withAuth<Params>(["DOCTOR"], async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const order = await prisma.investigation_orders.findFirst({ where: { id, requested_by_id: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "DRAFT") throw conflict("Submitted orders cannot be deleted");
  await prisma.investigation_orders.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
