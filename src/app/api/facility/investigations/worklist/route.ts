import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { nextActionLabel } from "@/lib/investigations/workflow";

const schema = z.object({
  domain: z.enum(["LABORATORY", "DIAGNOSTIC"]).optional(),
  department: z.string().trim().max(80).optional(),
  view: z.enum(["all", "new", "specimens", "processing", "results", "verification", "reporting", "overdue", "completed", "amendments"]).default("all"),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const VIEW_STATUS: Record<string, Prisma.InvestigationOrderItemWhereInput> = {
  new: { status: "NEW_REQUEST" },
  specimens: { status: { in: ["AWAITING_SAMPLE", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "SAMPLE_REJECTED"] } },
  processing: { status: { in: ["ASSIGNED_TO_SECTION", "PROCESSING", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "PATIENT_PREPARATION", "CHECKED_IN", "EXAM_IN_PROGRESS"] } },
  results: { status: { in: ["ANALYSIS_COMPLETED", "RESULT_ENTERED", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"] } },
  verification: { status: { in: ["AWAITING_VERIFICATION", "VERIFIED", "SIGNED"] } },
  reporting: { status: { in: ["EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"] } },
  completed: { status: { in: ["RELEASED", "DELIVERED"] } },
  amendments: { status: { in: ["RELEASED", "DELIVERED"] }, results: { some: { isCurrent: true, status: { notIn: ["RELEASED", "SUPERSEDED"] } } } },
};

// GET /api/facility/investigations/worklist — the facility's department worklists. Items arrive already
// sorted into the department of their catalogue category; nobody sorts requests by hand.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const { domain, department, view, q, limit } = parseQuery(req, schema);
  const now = new Date();

  const where: Prisma.InvestigationOrderItemWhereInput = {
    performingFacilityId: access.facility.id,
    order: { status: { not: "DRAFT" } },
    ...(domain ? { domain } : {}),
    ...(department ? { departmentKey: department } : {}),
    ...(view === "overdue" ? { dueAt: { lt: now }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } : VIEW_STATUS[view] ?? { status: { notIn: ["DELIVERED", "CANCELLED"] } }),
    ...(q ? { OR: [{ nameSnapshot: { contains: q, mode: "insensitive" } }, { order: { orderNumber: { contains: q, mode: "insensitive" } } }, { order: { patient: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { caseNumber: { contains: q, mode: "insensitive" } }] } } }, { specimens: { some: { barcode: { contains: q, mode: "insensitive" } } } }] } : {}),
  };

  const [items, counts] = await Promise.all([
    prisma.investigation_order_items.findMany({
      where, take: limit,
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, domain: true, departmentKey: true, nameSnapshot: true, isCustom: true, status: true, priority: true, dueAt: true, scheduledAt: true, createdAt: true, specimenType: true, bodySite: true,
        order: { select: { id: true, orderNumber: true, requestedBy: { select: { name: true } }, patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } } } },
        specimens: { select: { id: true, barcode: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.investigation_order_items.groupBy({ by: ["domain", "departmentKey"], where: { performingFacilityId: access.facility.id, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] }, order: { status: { not: "DRAFT" } } }, _count: { _all: true } }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({ ...i, overdue: !!i.dueAt && i.dueAt < now && !["RELEASED", "DELIVERED", "CANCELLED"].includes(i.status), nextAction: nextActionLabel(i.domain, i.status) })),
    departmentCounts: counts.map((c) => ({ domain: c.domain, department: c.departmentKey, open: c._count._all })),
  });
});
