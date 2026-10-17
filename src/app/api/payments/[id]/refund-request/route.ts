import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requestRefundApproval } from "@/lib/payments/service";

const schema = z.object({ reason: z.string().min(10, "Tell us briefly why you want a refund").max(500) });

// POST /api/payments/[id]/refund-request — a patient asks for their money back.
// The request is recorded and waits for an admin decision; the charge is only refunded on approval.
export const POST = withAuth<{ id: string }>(["PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { reason } = await parseBody(req, schema);
  await requestRefundApproval(id, user.id, reason);
  return NextResponse.json({ submitted: true });
});
