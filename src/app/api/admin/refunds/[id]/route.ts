import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { decideRefund } from "@/lib/payments/service";
import { writeAudit } from "@/lib/audit";

const decisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(300).optional(),
});

// POST /api/admin/refunds/[id] — approve or reject a pending refund request.
export const POST = withAuth<{ id: string }>(["ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { approve, note } = await parseBody(req, decisionSchema);
  await decideRefund(id, user.id, approve, note);
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: approve ? "REFUND_APPROVED" : "REFUND_REJECTED",
    resourceType: "Refund",
    resourceId: id,
    details: { note },
    req,
  });
  return NextResponse.json({ decided: true });
});
