import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { nextActionLabel } from "@/lib/investigations/workflow";
import { toDto } from "@/lib/investigations/serialize";

const schema = z.object({
  domain: z.enum(["LABORATORY", "DIAGNOSTIC"]).optional(),
  department: z.string().trim().max(80).optional(),
  view: z.enum(["all", "new", "specimens", "processing", "results", "verification", "reporting", "overdue", "completed", "amendments"]).default("all"),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const VIEW_STATUS: Record<string, Prisma.investigation_order_itemsWhereInput> = {
  new: { status: "NEW_REQUEST" },
  specimens: { status: { in: ["AWAITING_SAMPLE", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "SAMPLE_REJECTED"] } },
  processing: { status: { in: ["ASSIGNED_TO_SECTION", "PROCESSING", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "PATIENT_PREPARATION", "CHECKED_IN", "EXAM_IN_PROGRESS"] } },
  results: { status: { in: ["ANALYSIS_COMPLETED", "RESULT_ENTERED", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"] } },
  verification: { status: { in: ["AWAITING_VERIFICATION", "VERIFIED", "SIGNED"] } },
  reporting: { status: { in: ["EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"] } },
  completed: { status: { in: ["RELEASED", "DELIVERED"] } },
  amendments: { status: { in: ["RELEASED", "DELIVERED"] }, investigation_results: { some: { is_current: true, status: { notIn: ["RELEASED", "SUPERSEDED"] } } } },
};

// GET /api/facility/investigations/worklist — the facility's department worklists. Items arrive already
// sorted into the department of their catalogue category; nobody sorts requests by hand.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const { domain, department, view, q, limit } = parseQuery(req, schema);
  const now = new Date();

  const where: Prisma.investigation_order_itemsWhereInput = {
    performing_facility_id: access.facility.id,
    investigation_orders: { status: { not: "DRAFT" } },
    ...(domain ? { domain } : {}),
    ...(department ? { department_key: department } : {}),
    ...(view === "overdue" ? { due_at: { lt: now }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } : VIEW_STATUS[view] ?? { status: { notIn: ["DELIVERED", "CANCELLED"] } }),
    ...(q ? { OR: [{ name_snapshot: { contains: q, mode: "insensitive" } }, { investigation_orders: { order_number: { contains: q, mode: "insensitive" } } }, { investigation_orders: { patients: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { caseNumber: { contains: q, mode: "insensitive" } }] } } }, { investigation_specimens: { some: { barcode: { contains: q, mode: "insensitive" } } } }] } : {}),
  };

  const [items, counts] = await Promise.all([
    prisma.investigation_order_items.findMany({
      where, take: limit,
      orderBy: [{ priority: "desc" }, { due_at: "asc" }, { created_at: "asc" }],
      select: {
        id: true, domain: true, department_key: true, name_snapshot: true, is_custom: true, status: true, priority: true, due_at: true, scheduled_at: true, created_at: true, specimen_type: true, body_site: true,
        investigation_orders: { select: { id: true, order_number: true, users: { select: { name: true } }, patients: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } } } },
        investigation_specimens: { select: { id: true, barcode: true, status: true }, orderBy: { created_at: "desc" }, take: 1 },
      },
    }),
    prisma.investigation_order_items.groupBy({ by: ["domain", "department_key"], where: { performing_facility_id: access.facility.id, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] }, investigation_orders: { status: { not: "DRAFT" } } }, _count: { _all: true } }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({ ...toDto("item", i), overdue: !!i.due_at && i.due_at < now && !["RELEASED", "DELIVERED", "CANCELLED"].includes(i.status), nextAction: nextActionLabel(i.domain, i.status) })),
    departmentCounts: counts.map((c) => ({ domain: c.domain, department: c.department_key, open: c._count._all })),
  });
});
