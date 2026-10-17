import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { adminRefund } from "@/lib/admin/payments";

const schema = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(300) });

// POST /api/admin/payments/[id]/refund — refund a successful payment in full and cancel the booking it paid for.
export const POST = withAuth<{ id: string }>(["ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { reason } = await parseBody(req, schema);
  await adminRefund({ id: user.id, role: "ADMIN" }, id, reason, req);
  return NextResponse.json({ success: true });
});
