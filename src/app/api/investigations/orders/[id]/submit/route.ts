import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { submitOrder } from "@/lib/investigations/orders";

type Params = { id: string };

// POST /api/investigations/orders/[id]/submit — electronically authorise and send a draft.
export const POST = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { authorise } = await parseBody(req, z.object({ authorise: z.boolean() }));
  return NextResponse.json({ success: true, ...(await submitOrder(user, id, { authorise, req })) });
});
