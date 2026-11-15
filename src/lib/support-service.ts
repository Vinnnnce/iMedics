import type { SupportTicketType, User } from "@prisma/client";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { safeErrorMetadata } from "./safe-error";
import { appUrl, sendEmail } from "./notifications/email";
import {
  defaultPriority, generateTicketReference, renderAcknowledgement, sanitizePagePath, slaDueAt,
} from "./support";

interface NewTicket {
  type: SupportTicketType;
  subject: string;
  message: string;
  contactName: string | null;
  contactEmail: string;
  pagePath?: string | null;
  reporterUserId?: string | null;
}

/** Create the ticket, its first event, and a security incident for signed-in security reports. */
export async function createSupportTicket(input: NewTicket, actor?: Pick<User, "id" | "role"> | null, req?: Request) {
  const priority = defaultPriority(input.type);
  let reference = generateTicketReference();
  let incidentId: string | null = null;

  if (input.type === "SECURITY" && actor) {
    const incident = await prisma.securityIncident.create({
      data: {
        kind: "OTHER", severity: "HIGH", reportedById: actor.id,
        title: `User-reported: ${input.subject}`.slice(0, 200), description: input.message,
      },
      select: { id: true },
    });
    incidentId = incident.id;
  }

  // A reference collision is astronomically unlikely, but a retry is cheap.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          reference, type: input.type, priority, subject: input.subject, message: input.message,
          reporterUserId: input.reporterUserId ?? null, contactName: input.contactName, contactEmail: input.contactEmail,
          pagePath: sanitizePagePath(input.pagePath), securityIncidentId: incidentId, slaDueAt: slaDueAt(priority),
          events: { create: { kind: "CREATED", actorUserId: input.reporterUserId ?? null, toValue: "OPEN" } },
        },
        select: { id: true, reference: true, priority: true, slaDueAt: true },
      });
      await writeAudit({
        userId: actor?.id ?? null, actorRole: actor?.role ?? null, action: "SUPPORT_TICKET_CREATED",
        resourceType: "SupportTicket", resourceId: ticket.id, details: { type: input.type, priority, reference: ticket.reference }, req,
      });
      void sendAcknowledgement(input.contactEmail, ticket.reference);
      return ticket;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2002" && attempt < 3) { reference = generateTicketReference(); continue; }
      throw error;
    }
  }
}

async function sendAcknowledgement(to: string, reference: string): Promise<void> {
  try {
    const mail = renderAcknowledgement(reference, appUrl());
    await sendEmail({ to, ...mail, idempotencyKey: `support-ack-${reference}` });
  } catch (error) {
    // Email is best effort: the ticket exists and the reference is shown on screen.
    console.warn("Support acknowledgement not sent:", safeErrorMetadata(error));
  }
}
