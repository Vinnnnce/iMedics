import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { runInactivityChecks, acknowledgeWelfareAlert } from "@/lib/welfare";

/**
 * Inactivity monitoring configuration and welfare alerts.
 *
 * The patient configures: threshold, trusted contacts (with explicit consent),
 * escalation and quiet hours. Contacts acknowledge alerts via their account.
 * Backend-enforced: only the patient can configure their own monitoring, and
 * only designated contacts can act on alerts.
 */

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60),
  userId: z.string().uuid(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120).optional(),
});

const ruleSchema = z.object({
  thresholdHours: z.number().int().min(12).max(168),
  escalationHours: z.number().int().min(1).max(72).nullable().optional(),
  gracePeriodMinutes: z.number().int().min(0).max(240).default(0),
  quietHoursStart: z.number().int().min(0).max(1439).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(1439).nullable().optional(),
  active: z.boolean(),
  contactIds: z.array(z.string().uuid()).min(1).max(2),
  consent: z.boolean(),
});

// GET /api/patient/welfare — the patient's rule, contacts and alert history.
export const GET = withAuth(["PATIENT", "ADMIN"], async (_req, { user }) => {
  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
  const [rule, contacts, alerts] = await Promise.all([
    prisma.inactivityRule.findUnique({ where: { patientId: patient.id } }),
    prisma.trustedContact.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "asc" } }),
    prisma.welfareAlert.findMany({
      where: { rule: { patientId: patient.id } },
      orderBy: { triggeredAt: "desc" },
      take: 20,
      include: { deliveries: true },
    }),
  ]);
  return NextResponse.json({ rule, contacts, alerts });
});

// PUT /api/patient/welfare — save or update the rule + consent.
export const PUT = withAuth(["PATIENT"], async (req: NextRequest, { user }) => {
  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
  const body = await parseBody(req, ruleSchema);

  // Verify contacts belong to this patient.
  const contacts = await prisma.trustedContact.findMany({ where: { patientId: patient.id } });
  const validIds = body.contactIds.every((id) => contacts.some((c) => c.id === id));
  if (!validIds) return NextResponse.json({ error: "Unknown contact in the monitoring rule" }, { status: 400 });

  // Consent is mandatory to activate; revoking consent deactivates monitoring.
  const consentText =
    "I consent to Medic1905 notifying my designated contacts if I have not signed in for the period I have chosen. I understand this is not an emergency service and that platform inactivity does not necessarily indicate a medical problem.";

  const rule = await prisma.inactivityRule.upsert({
    where: { patientId: patient.id },
    create: {
      patientId: patient.id,
      thresholdHours: body.thresholdHours,
      escalationHours: body.escalationHours ?? null,
      gracePeriodMinutes: body.gracePeriodMinutes,
      quietHoursStart: body.quietHoursStart ?? null,
      quietHoursEnd: body.quietHoursEnd ?? null,
      contactIds: body.contactIds,
      active: body.active && body.consent,
      consentAt: body.consent ? new Date() : null,
      consentText: body.consent ? consentText : null,
    },
    update: {
      thresholdHours: body.thresholdHours,
      escalationHours: body.escalationHours ?? null,
      gracePeriodMinutes: body.gracePeriodMinutes,
      quietHoursStart: body.quietHoursStart ?? null,
      quietHoursEnd: body.quietHoursEnd ?? null,
      contactIds: body.contactIds,
      active: body.active && body.consent,
      ...(body.consent ? { consentAt: new Date(), consentText } : { consentAt: null, consentText: null, active: false }),
    },
  });

  await writeAudit({
    userId: user.id,
    patientId: patient.id,
    actorRole: user.role,
    action: "INACTIVITY_RULE_UPDATED",
    resourceType: "InactivityRule",
    resourceId: rule.id,
    details: { active: rule.active, thresholdHours: rule.thresholdHours, contacts: rule.contactIds.length },
  });

  return NextResponse.json({ rule });
});

// POST /api/patient/welfare — contacts management + alert actions.
const postSchema = z.object({
  action: z.enum(["addContact", "removeContact", "acknowledge", "runCheck"]),
  contact: contactSchema.optional(),
  contactId: z.string().uuid().optional(),
  alertId: z.string().uuid().optional(),
});

export const POST = withAuth(["PATIENT", "ADMIN"], async (req: NextRequest, { user }) => {
  const body = await parseBody(req, postSchema);

  if (body.action === "runCheck") {
    // Manual check (also run by the scheduler): useful for testing config.
    const result = await runInactivityChecks();
    return NextResponse.json({ result });
  }

  if (body.action === "acknowledge") {
    if (!body.alertId) return NextResponse.json({ error: "alertId is required" }, { status: 400 });
    const alert = await acknowledgeWelfareAlert(body.alertId, user.id);
    return NextResponse.json({ alert });
  }

  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });

  if (body.action === "addContact") {
    if (!body.contact) return NextResponse.json({ error: "contact details are required" }, { status: 400 });
    const contact = await prisma.trustedContact.create({
      data: {
        patientId: patient.id,
        userId: body.contact.userId,
        name: body.contact.name,
        relationship: body.contact.relationship,
        phone: body.contact.phone ?? null,
        email: body.contact.email ?? null,
      },
    });
    await writeAudit({
      userId: user.id, patientId: patient.id, actorRole: user.role,
      action: "TRUSTED_CONTACT_ADDED", resourceType: "TrustedContact", resourceId: contact.id,
      details: { withUserId: body.contact.userId },
    });
    return NextResponse.json({ contact }, { status: 201 });
  }

  const removed = await prisma.trustedContact.deleteMany({
    where: { id: body.contactId, patientId: patient.id },
  });
  // Also drop it from any rule.
  await prisma.inactivityRule.updateMany({
    where: { patientId: patient.id },
    data: { contactIds: { set: [] }, active: false },
  }).catch(() => undefined);
  await writeAudit({
    userId: user.id, patientId: patient.id, actorRole: user.role,
    action: "TRUSTED_CONTACT_REMOVED", resourceType: "TrustedContact", resourceId: body.contactId,
  });
  return NextResponse.json({ removed: removed.count });
});
