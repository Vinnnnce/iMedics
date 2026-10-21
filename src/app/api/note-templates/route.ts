import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const TEMPLATE_KINDS = ["CONSULTATION", "CASE_NOTE", "REFERRAL"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "A template needs a name").max(80),
  kind: z.enum(TEMPLATE_KINDS),
  /** JSON-encoded scaffold fields; keys are free-form, values are text. */
  content: z.string().min(1).max(20000),
});

// GET /api/note-templates?kind= — list the signed-in clinician's saved
// documentation templates. Doctors and admins only; templates are personal.
export const GET = withAuth(["DOCTOR", "ADMIN"], async (req, { user }) => {
  const { kind } = parseQuery(
    req,
    z.object({ kind: z.enum(TEMPLATE_KINDS).optional() }),
  );

  const templates = await prisma.noteTemplate.findMany({
    where: { authorId: user.id, ...(kind ? { kind } : {}) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, kind: true, content: true, updatedAt: true },
  });

  return NextResponse.json({ templates });
});

// POST /api/note-templates — save a reusable documentation scaffold. The
// content is structure only (field prompts); patient data must never be
// saved into a template.
export const POST = withAuth(["DOCTOR", "ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  // Reject non-object content early so garbage never reaches the store.
  let fields: unknown;
  try {
    fields = JSON.parse(data.content);
  } catch {
    return NextResponse.json(
      { error: "Template content must be a JSON object of scaffold fields" },
      { status: 400 },
    );
  }
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    return NextResponse.json(
      { error: "Template content must be a JSON object of scaffold fields" },
      { status: 400 },
    );
  }

  const template = await prisma.noteTemplate.create({
    data: { authorId: user.id, name: data.name, kind: data.kind, content: data.content },
    select: { id: true, name: true, kind: true, content: true, updatedAt: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "NOTE_TEMPLATE_CREATED",
    resourceType: "NoteTemplate",
    resourceId: template.id,
    req,
  });

  return NextResponse.json({ template }, { status: 201 });
});
