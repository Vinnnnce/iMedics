import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { extensionAudit, getTasks } from "@/lib/workspace/extensions";
import { notFound } from "@/lib/errors";
export const GET = withAuth(null, async (_req, { user }) => Response.json(await getTasks(user.id), { headers: { "Cache-Control": "no-store" } }));
export const POST = withAuth(null, async (req, { user }) => {
  const body = await parseBody(req, z.object({ title: z.string().trim().min(1).max(160), kind: z.enum(["CARE", "NOTE", "PRESCRIPTION", "REFERRAL", "RESULT_REVIEW"]).default("CARE"), dueAt: z.iso.datetime().optional() }));
  const id = randomUUID();
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO workspace_tasks(id, owner_id, title, kind, due_at) VALUES(${id}::uuid, ${user.id}::uuid, ${body.title}, ${body.kind}, ${body.dueAt ? new Date(body.dueAt) : null})`;
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_TASK_CREATED", resourceType: "WorkspaceTask", resourceId: id } });
  });
  return Response.json({ id }, { status: 201 });
});
export const PATCH = withAuth(null, async (req, { user }) => {
  const { id, completed } = await parseBody(req, z.object({ id: z.uuid(), completed: z.boolean() }));
  await extensionAudit(user, "WORKSPACE_TASK_UPDATED", id);
  const count = await prisma.$executeRaw`UPDATE workspace_tasks SET completed_at = ${completed ? new Date() : null} WHERE id = ${id}::uuid AND owner_id = ${user.id}::uuid`;
  if (!count) throw notFound("Task not found");
  return Response.json({ success: true });
});
