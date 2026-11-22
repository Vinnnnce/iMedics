import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { releaseResult, resultInput, saveResult, signResult, startAmendment, submitForVerification, verifyResult } from "@/lib/investigations/results";

type Params = { id: string };

// PUT — save the working (unsigned) result. Needs ENTER_RESULTS.
export const PUT = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  const input = await parseBody(req, resultInput);
  const resultId = await saveResult(user, access.facility, id, input);
  return NextResponse.json({ success: true, resultId });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("verify"), approve: z.boolean(), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("sign"), statement: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("amend"), reason: z.string().trim().min(5).max(500) }),
]);

// POST — workflow actions, each with its own permission: submit/amend = ENTER_RESULTS,
// verify/sign = VERIFY_RESULTS (a different person from the one who entered the result), release = RELEASE_RESULTS.
export const POST = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const body = await parseBody(req, actionSchema);
  const permission = body.action === "submit" || body.action === "amend" ? "ENTER_RESULTS" : body.action === "release" ? "RELEASE_RESULTS" : "VERIFY_RESULTS";
  const access = await requireFacilityAccess(user, permission, req);
  const f = access.facility;
  switch (body.action) {
    case "submit": await submitForVerification(user, f, id); return NextResponse.json({ success: true });
    case "verify": return NextResponse.json({ success: true, ...(await verifyResult(user, f, id, body)) });
    case "sign": await signResult(user, f, id, body.statement); return NextResponse.json({ success: true });
    case "release": await releaseResult(user, f, id); return NextResponse.json({ success: true });
    case "amend": return NextResponse.json({ success: true, resultId: await startAmendment(user, f, id, body.reason) });
  }
});
