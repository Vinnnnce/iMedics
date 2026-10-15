import { prisma } from "@/lib/prisma";
import type { CareTask, WorkspaceRole } from "./types";

export async function extensionsInstalled() {
  const rows = await prisma.$queryRaw<{ installed: string | null }[]>`SELECT to_regclass('public.workspace_tasks')::text AS installed`;
  return Boolean(rows[0]?.installed);
}
export async function getTasks(ownerId: string): Promise<CareTask[]> {
  const rows = await prisma.$queryRaw<{ id: string; title: string; kind: string; due_at: Date | null; completed_at: Date | null }[]>`
    SELECT id, title, kind, due_at, completed_at FROM workspace_tasks WHERE owner_id = ${ownerId}::uuid
    ORDER BY completed_at NULLS FIRST, due_at NULLS LAST, created_at DESC LIMIT 100`;
  return rows.map(row => ({ id: row.id, title: row.title, kind: row.kind, subtitle: row.due_at?.toISOString() ?? "No due date",
    status: row.completed_at ? "Completed" : "To do", completed: Boolean(row.completed_at), at: row.due_at?.toISOString(), tone: "neutral" }));
}
export async function extensionAudit(user: { id: string; role: WorkspaceRole }, action: string, resourceId?: string) {
  // Unlike the legacy best-effort logger, protected extension operations fail closed.
  await prisma.auditLog.create({ data: { userId: user.id, actorRole: user.role, action, resourceType: "Workspace", resourceId } });
}
