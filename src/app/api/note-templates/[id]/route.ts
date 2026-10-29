import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound, forbidden } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const renameSchema = z.object({
  name: z.string().trim().min(1, "A template needs a name").max(80),
});

async function requireOwnedTemplate(id: string, userId: string) {
  const template = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!template) throw notFound("Template not found");
  if (template.authorId !== userId) throw forbidden("You can only edit your own templates");
  return template;
}

// PUT /api/note-templates/[id] — rename a saved template (owner only).
export const PUT = withAuth<{ id: string }>(["DOCTOR", "ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  await requireOwnedTemplate(id, user.id);
  const data = await parseBody(req, renameSchema);

  const template = await prisma.noteTemplate.update({
    where: { id },
    data: { name: data.name },
    select: { id: true, name: true, kind: true, content: true, updatedAt: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "NOTE_TEMPLATE_RENAMED",
    resourceType: "NoteTemplate",
    resourceId: id,
    req,
  });

  return NextResponse.json({ template });
});

// DELETE /api/note-templates/[id] — delete a saved template (owner only).
export const DELETE = withAuth<{ id: string }>(["DOCTOR", "ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  await requireOwnedTemplate(id, user.id);

  await prisma.noteTemplate.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "NOTE_TEMPLATE_DELETED",
    resourceType: "NoteTemplate",
    resourceId: id,
    req,
  });

  return NextResponse.json({ success: true });
});
