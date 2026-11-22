import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { cancelOrderItem } from "@/lib/investigations/orders";

type Params = { id: string };

export const POST = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3).max(300) }));
  await cancelOrderItem(user, id, reason, req);
  return NextResponse.json({ success: true });
});
