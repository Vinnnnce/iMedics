import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { completeJson, AiUnavailableError } from "@/lib/ai/llm";
import { logAiUsage } from "@/lib/ai/audit";

const explainSchema = z.object({
  mode: z.literal("EXPLAIN"),
  documentId: z.string().uuid(),
});

const questionsSchema = z.object({
  mode: z.literal("QUESTIONS"),
  topic: z.string().trim().min(3).max(300),
});

const faqSchema = z.object({
  mode: z.literal("FAQ"),
});

const bodySchema = z.discriminatedUnion("mode", [explainSchema, questionsSchema, faqSchema]);

const explainOutput = z.object({
  explanation: z.string().min(1),
  keyTerms: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
});

const questionsOutput = z.object({
  questions: z.array(z.string()).min(1).max(8),
});

/**
 * POST /api/patient/assistant — the patient-facing AI assistant.
 *
 * Modes:
 * - EXPLAIN: explains one of the patient's own RELEASED clinical documents
 *   in plain language. Drafts and unreleased documents are never accessible.
 * - QUESTIONS: helps the patient prepare questions for their doctor.
 * - FAQ: deterministic portal guidance (no AI).
 *
 * The assistant must never diagnose, prescribe, alter treatment or replace
 * emergency services. Every response is labelled AI-generated.
 */
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const body = await parseBody(req, bodySchema);
  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw notFound("Patient profile not found");

  if (body.mode === "FAQ") {
    return NextResponse.json({
      mode: "FAQ",
      answers: [
        { q: "Where do I see my results?", a: "Open Medical Records → Laboratory or Diagnostic Reports. Only reports your doctor has reviewed and released are shown." },
        { q: "Why can't I see a report yet?", a: "Reports appear after a qualified professional verifies and releases them. Drafts and preliminary results are never shown." },
        { q: "How do I book an appointment?", a: "Go to Appointments → Book, or contact your facility directly." },
        { q: "How do I book an emergency?", a: "If it is a medical emergency, contact your local emergency number immediately — do not use the portal." },
      ],
    });
  }

  await enforceAiRateLimit(user.id);

  if (body.mode === "QUESTIONS") {
    let output: z.infer<typeof questionsOutput>;
    let generated = true;
    try {
      output = await completeJson({
        schema: questionsOutput,
        maxTokens: 600,
        system: `You help a patient prepare questions for their doctor about the topic they provide.
Generate clear, non-technical questions the patient can ask. Do not answer the questions, give medical advice or suggest diagnoses.
Return JSON {questions: string[3..6]}.`,
        user: body.topic,
      });
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        generated = false;
        output = {
          questions: [
            `What is the likely cause of my ${body.topic}?`,
            "What tests do I need, and what will they show?",
            "What are my treatment options and their side effects?",
            "What should I do if my symptoms get worse?",
            "When should I come back for a follow-up?",
          ],
        };
      } else {
        throw error;
      }
    }
    await logAiUsage({
      userId: user.id,
      feature: "PATIENT_ASSISTANT",
      status: "COMPLETED",
      patientId: patient.id,
      inputRefs: ["topic"],
      metadata: { submode: "QUESTIONS", generatedByProvider: generated },
    });
    return NextResponse.json({
      mode: "QUESTIONS",
      questions: output.questions,
      aiGenerated: generated,
      disclaimer: "AI-generated suggestions to discuss with your doctor. This is not medical advice.",
    });
  }

  // EXPLAIN mode: only the patient's own released documents.
  const document = await prisma.clinicalDocument.findFirst({
    where: {
      id: body.documentId,
      patientId: patient.id,
      releasedToPatientAt: { not: null },
      status: { in: ["FINAL", "AMENDED"] },
    },
    select: { id: true, title: true, groupCode: true, content: true },
  });
  if (!document) throw notFound("Document not found or not released to you");
  if (!document.content) throw badRequest("This document has no readable content yet");

  let output: z.infer<typeof explainOutput>;
  let generated = true;
  try {
    output = await completeJson({
      schema: explainOutput,
      maxTokens: 900,
      system: `You explain a released medical document to its patient in plain, everyday language.
Simplify terminology and describe what the document covers. Do NOT diagnose, interpret abnormal findings, recommend treatment or medication changes, or speculate.
If the document contains findings, translate only the vocabulary. Advise the patient to discuss findings with their doctor.
Return JSON {explanation, keyTerms (term: plain meaning), followUpQuestions}.`,
      user: JSON.stringify({ title: document.title, groupCode: document.groupCode, content: String(document.content).slice(0, 6000) }),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      generated = false;
      output = {
        explanation: `This document ("${document.title}") has been reviewed and released by your care team. Your doctor can walk you through its contents at your next visit.`,
        keyTerms: [],
        followUpQuestions: ["What does this document mean for me?", "Do I need any follow-up tests?"],
      };
    } else {
      throw error;
    }
  }
  await logAiUsage({
    userId: user.id,
    feature: "PATIENT_ASSISTANT",
    status: "COMPLETED",
    patientId: patient.id,
    inputRefs: [`document:${document.id}`],
    metadata: { submode: "EXPLAIN", generatedByProvider: generated },
  });
  return NextResponse.json({
    mode: "EXPLAIN",
    explanation: output.explanation,
    keyTerms: output.keyTerms,
    followUpQuestions: output.followUpQuestions,
    aiGenerated: generated,
    disclaimer: "AI-generated plain-language summary of your released document. It is not a diagnosis — discuss findings with your doctor.",
  });
});
