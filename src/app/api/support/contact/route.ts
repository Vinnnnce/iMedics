import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, parseBody } from "@/lib/api";
import { assertSameOriginWrite } from "@/lib/request-security";
import { RATE_LIMITS, enforceAnonymousRateLimit } from "@/lib/rate-limit";
import { publicContactSchema } from "@/lib/support";
import { createSupportTicket } from "@/lib/support-service";

/** Public contact form. Anonymous, so it is origin-checked, honeypotted and strictly rate limited. */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOriginWrite(req);
  await enforceAnonymousRateLimit(RATE_LIMITS.publicForm, req, { failOpen: false });
  const body = await parseBody(req, publicContactSchema);
  // Bots fill the hidden field. Pretend to succeed so they learn nothing.
  if (body.website) return NextResponse.json({ success: true, reference: "SUP-RECEIVED" }, { status: 201 });
  const ticket = await createSupportTicket(
    { type: body.type, subject: body.subject, message: body.message, contactName: body.name, contactEmail: body.email, pagePath: body.pagePath },
    null, req,
  );
  return NextResponse.json({ success: true, reference: ticket.reference }, { status: 201 });
});
