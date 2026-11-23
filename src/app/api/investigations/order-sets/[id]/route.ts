import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";

type Params = { id: string };

export const DELETE = withAuth<Params>(["DOCTOR"], async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const { count } = await prisma.investigation_order_sets.deleteMany({ where: { id, owner_user_id: user.id } });
  if (!count) throw notFound("Order set not found");
  return NextResponse.json({ success: true });
});
