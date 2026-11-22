import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireDoctorOrderAccess } from "@/lib/investigations/access";
import { orderInput, saveDraft } from "@/lib/investigations/orders";
import { conflict } from "@/lib/errors";
import { releasedResultFor } from "@/lib/investigations/results";

type Params = { id: string };

// GET /api/investigations/orders/[id] — order with items, status history and released results only.
export const GET = withAuth<Params>(["DOCTOR"], async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const base = await requireDoctorOrderAccess(user, id);
  const order = await prisma.investigation_orders.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } },
      requestedBy: { select: { name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          performingFacility: { select: { id: true, laboratoryName: true, city: true, state: true } },
          history: { orderBy: { createdAt: "asc" } },
          specimens: { select: { id: true, accessionNumber: true, barcode: true, status: true, rejectionReason: true, collectedAt: true, receivedAt: true } },
          results: { select: { id: true, version: true, status: true, releasedAt: true, alerts: { include: { events: { orderBy: { createdAt: "asc" } } } } }, orderBy: { version: "desc" } },
          referrals: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  const items = await Promise.all(order.items.map(async (it) => ({ ...it, released: await releasedResultFor(it.id) })));
  return NextResponse.json({ order: { ...order, items } });
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
  const order = await prisma.investigation_orders.findFirst({ where: { id, requestedById: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "DRAFT") throw conflict("Submitted orders cannot be deleted");
  await prisma.investigation_orders.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
