import { randomUUID } from "node:crypto";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { extensionAudit } from "@/lib/workspace/extensions";
import { wearableImportSchema } from "@/lib/workspace/validation";
export const GET = withAuth(["PATIENT"], async (_req, { user }) => {
  await extensionAudit(user, "WORKSPACE_WEARABLES_READ");
  const rows = await prisma.$queryRaw`SELECT metric, value, recorded_at, source FROM workspace_wearable_readings WHERE owner_id = ${user.id}::uuid ORDER BY recorded_at DESC LIMIT 365`;
  return Response.json(rows, { headers: { "Cache-Control": "private, no-store" } });
});
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const b = await parseBody(req, wearableImportSchema);
  await prisma.$transaction(async tx => {
    for (const r of b.readings) {
      await tx.$executeRaw`INSERT INTO workspace_wearable_readings(id, owner_id, metric, value, recorded_at, source)
        VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${r.metric}, ${r.value}, ${new Date(r.recordedAt)}, ${b.source})
        ON CONFLICT(owner_id, metric, recorded_at, source) DO NOTHING`;
    }
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_WEARABLE_IMPORT", resourceType: "Workspace", details: { count: b.readings.length } } });
  });
  return Response.json({ success: true });
});
