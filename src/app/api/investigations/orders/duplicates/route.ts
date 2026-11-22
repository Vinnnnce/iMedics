import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { findDuplicates } from "@/lib/investigations/service";

const schema = z.object({ patientId: z.string().uuid(), domain: z.enum(["LABORATORY", "DIAGNOSTIC"]), catalogueItemIds: z.array(z.string().uuid()).max(60), excludeOrderId: z.string().uuid().optional() });

// POST /api/investigations/orders/duplicates — recent equivalent requests for this patient.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  await findAccessiblePatient(user, body.patientId);
  return NextResponse.json({ duplicates: await findDuplicates(body.patientId, body.catalogueItemIds, body.domain, { excludeOrderId: body.excludeOrderId }) });
});
