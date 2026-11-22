import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { AiUnavailableError, completeJson } from "@/lib/ai/llm";
import { AI_REQUEST_ACTION, enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { writeAudit } from "@/lib/audit";
import { requireDoctorOrderAccess } from "@/lib/investigations/access";
import { scoreMatch, tokens } from "@/lib/investigations/search";
import { notFound } from "@/lib/errors";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("suggest"), domain: z.enum(["LABORATORY", "DIAGNOSTIC"]), description: z.string().trim().min(3).max(500) }),
  z.object({ mode: z.literal("summarise"), itemId: z.string().uuid() }),
]);

const suggestOut = z.object({ matches: z.array(z.object({ id: z.string(), reason: z.string().max(200) })).max(10) });
const summaryOut = z.object({ summary: z.string().max(1500) });

const SAFETY = "You support a licensed doctor. You never diagnose, never order investigations and never release results; you only help find catalogue entries or summarise already-released reports. Reply with a single JSON object.";

// POST /api/investigations/ai-assist — optional, doctor-reviewed assistance. Suggestions only ever reference
// catalogue ids that exist; the doctor still selects and authorises every order. Falls back to ranked catalogue
// search when AI is unavailable.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  await enforceAiRateLimit(user.id);
  await writeAudit({ userId: user.id, actorRole: user.role, action: AI_REQUEST_ACTION, resourceType: "InvestigationAssist", details: { mode: body.mode }, req });

  if (body.mode === "suggest") {
    const ts = tokens(body.description).filter((t) => t.length > 2);
    const candidates = await prisma.investigation_catalogue_items.findMany({
      where: { domain: body.domain, isActive: true, ...(ts.length ? { OR: ts.map((t) => ({ searchText: { contains: t } })) } : {}) },
      select: { id: true, name: true, commonName: true, abbreviation: true, synonyms: true, code: true, loincCode: true, snomedCode: true, searchText: true, subcategory: true },
      take: 300,
    });
    const ranked = candidates.map((c) => ({ c, s: scoreMatch(c, body.description) || ts.filter((t) => c.searchText.includes(t)).length })).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.c);
    const fallback = ranked.slice(0, 8).map((c) => ({ id: c.id, name: c.name, reason: "Closest catalogue match to your description" }));
    if (ranked.length === 0) return NextResponse.json({ matches: [], source: "search" });
    try {
      const out = await completeJson({
        system: `${SAFETY} Given a doctor's free-text description and a list of catalogue entries, return {"matches":[{"id","reason"}]} choosing up to 8 entries that match what was described. Use only ids from the list.`,
        user: JSON.stringify({ description: body.description, catalogue: ranked.map((c) => ({ id: c.id, name: c.name, abbreviation: c.abbreviation, group: c.subcategory })) }),
        schema: suggestOut, maxTokens: 600,
      });
      const byId = new Map(ranked.map((c) => [c.id, c]));
      const matches = out.matches.filter((m) => byId.has(m.id)).map((m) => ({ id: m.id, name: byId.get(m.id)!.name, reason: m.reason }));
      return NextResponse.json({ matches: matches.length ? matches : fallback, source: matches.length ? "ai" : "search" });
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      return NextResponse.json({ matches: fallback, source: "search" });
    }
  }

  const item = await prisma.investigation_order_items.findUnique({ where: { id: body.itemId }, select: { id: true, orderId: true, nameSnapshot: true } });
  if (!item) throw notFound("Investigation not found");
  await requireDoctorOrderAccess(user, item.orderId);
  const result = await prisma.investigation_results.findFirst({ where: { itemId: item.id, status: "RELEASED" }, orderBy: { version: "desc" }, include: { observations: { orderBy: { sortOrder: "asc" } } } });
  if (!result) throw notFound("No released report to summarise");
  try {
    const out = await completeJson({
      system: `${SAFETY} Summarise the released report in 3-5 plain sentences for a clinician. Return {"summary": string}. Do not add diagnoses or treatment advice beyond what the report states.`,
      user: JSON.stringify({ investigation: item.nameSnapshot, findings: result.findings, impression: result.impression, conclusion: result.conclusion, observations: result.observations.map((o) => ({ name: o.name, value: o.valueNumeric ?? o.valueText, unit: o.unit, flag: o.flag })) }),
      schema: summaryOut, maxTokens: 500,
    });
    return NextResponse.json({ summary: out.summary, source: "ai", notice: "AI-generated summary. Review the full report before acting on it." });
  } catch (error) {
    if (error instanceof AiUnavailableError) return NextResponse.json({ error: "AI assistance is unavailable right now" }, { status: 503 });
    throw error;
  }
});
