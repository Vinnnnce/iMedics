import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { decideVerification } from "@/lib/admin/verification-review";

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED"), checklist: z.record(z.string(), z.boolean()), note: z.string().trim().max(1000).optional() }),
  z.object({ decision: z.literal("REJECTED"), reason: z.string().trim().min(1).max(1000), checklist: z.record(z.string(), z.boolean()).optional() }),
]);

// POST /api/admin/verifications/[userId]/decision — approve (all checks confirmed) or reject (with a reason) an application.
export const POST = withAuth<{ userId: string }>(["ADMIN"], async (req, { user, params }) => {
  const userId = parseId((await params).userId);
  const input = await parseBody(req, schema);
  const result = await decideVerification({ id: user.id, role: "ADMIN" }, userId, input, req);
  return NextResponse.json({ success: true, ...result });
});
