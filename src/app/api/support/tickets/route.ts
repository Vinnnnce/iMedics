import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { memberTicketSchema } from "@/lib/support";
import { createSupportTicket } from "@/lib/support-service";

// Open to every signed-in account, including pending and onboarding ones: a person who cannot
// finish registration must still be able to ask for help.
export const POST = withAuth(null, async (req, { user }) => {
  const body = await parseBody(req, memberTicketSchema);
  const ticket = await createSupportTicket(
    { type: body.type, subject: body.subject, message: body.message, contactName: user.name, contactEmail: user.email, pagePath: body.pagePath, reporterUserId: user.id },
    user, req,
  );
  return NextResponse.json({ success: true, reference: ticket.reference }, { status: 201 });
}, { allowOnboarding: true, rateLimit: RATE_LIMITS.supportTicket });

// A person only ever sees their own tickets.
export const GET = withAuth(null, async (_req, { user }) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { reporterUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { reference: true, type: true, subject: true, status: true, createdAt: true, resolvedAt: true },
  });
  return NextResponse.json({ tickets });
}, { allowOnboarding: true });
