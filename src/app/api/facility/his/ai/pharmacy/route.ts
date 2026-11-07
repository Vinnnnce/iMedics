import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { completeJson, AiUnavailableError } from "@/lib/ai/llm";
import { logAiUsage } from "@/lib/ai/audit";

const schema = z.object({
  medicationOrderId: z.string().uuid(),
});

const outputSchema = z.object({
  reviewNotes: z.string().min(1),
  checksToConfirm: z.array(z.string()).default([]),
});

/**
 * POST /api/facility/his/ai/pharmacy — AI prescription review assistance.
 * The pharmacist receives a draft review note compiled from the order, the
 * facility's own interaction rules and the patient's allergy history.
 * The AI never approves, dispenses or alters medication orders — the
 * qualified pharmacist makes every final decision.
 */
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "REVIEW_MEDICATIONS", req, ["HOSPITAL", "PHARMACY"]);
  const body = await parseBody(req, schema);

  const order = await prisma.medicationOrder.findFirst({
    where: { id: body.medicationOrderId, facilityId: access.facility.id },
    include: {
      patient: { select: { id: true, caseNumber: true } },
    },
  });
  if (!order) throw notFound("Medication order not found");

  const [history, rules, batches] = await Promise.all([
    prisma.medicalHistory.findFirst({
      where: { patientId: order.patientId },
      orderBy: { createdAt: "desc" },
      select: { allergies: true, medications: true },
    }),
    prisma.medicationInteractionRule.findMany({
      where: { facilityId: access.facility.id, OR: [{ medicationA: order.medicationName }, { medicationB: order.medicationName }] },
      select: { medicationA: true, medicationB: true, severity: true, description: true },
    }),
    prisma.pharmacyStockBatch.findMany({
      where: { facilityId: access.facility.id, medicationName: order.medicationName, quantity: { gt: 0 }, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
      take: 5,
      select: { batchNumber: true, quantity: true, expiresAt: true },
    }),
  ]);

  await enforceAiRateLimit(user.id);

  const context = {
    order: {
      medication: order.medicationName, strength: order.strength, dose: order.dose,
      route: order.route, frequency: order.frequency, duration: order.duration,
    },
    patientAllergies: history?.allergies ?? null,
    currentMedications: history?.medications ?? null,
    facilityInteractionRules: rules,
    stockAvailable: batches.map((b) => ({ batch: b.batchNumber, quantity: b.quantity, expires: b.expiresAt.toISOString().slice(0, 10) })),
  };

  let output: z.infer<typeof outputSchema>;
  let generated = true;
  try {
    output = await completeJson({
      schema: outputSchema,
      maxTokens: 1000,
      system: `You are a pharmacy documentation assistant preparing a REVIEW DRAFT for a pharmacist.
Summarize the checks a pharmacist should confirm for this order: allergies, interactions (only those present in the supplied facility rules), duplicate therapy, stock/expiry.
Do not approve, dispense, adjust dosing or give clinical advice. State unknowns explicitly.
Return JSON {reviewNotes, checksToConfirm}. All output requires pharmacist review.`,
      user: JSON.stringify(context),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      generated = false;
      output = {
        reviewNotes: `Order review checklist (auto-compiled): medication ${order.medicationName}; ${rules.length} facility interaction rule(s) matched; ${batches.length} in-stock batch(es).`,
        checksToConfirm: [
          "Confirm patient allergies against the order",
          rules.length > 0 ? `Review ${rules.length} flagged interaction rule(s)` : "No facility interaction rules matched",
          batches.length === 0 ? "No tracked stock batches — confirm supply source" : "Confirm batch expiry dates",
        ],
      };
    } else {
      throw error;
    }
  }

  await logAiUsage({
    userId: user.id,
    feature: "PHARMACY_REVIEW",
    status: "COMPLETED",
    facilityId: access.facility.id,
    patientId: order.patientId,
    inputRefs: [`order:${order.id}`],
    metadata: { generatedByProvider: generated, interactionRules: rules.length },
  });

  return NextResponse.json({
    draft: output,
    aiGenerated: generated,
    disclaimer: "AI-generated review draft. The pharmacist makes the final decision; AI cannot approve or dispense medication.",
  });
});
