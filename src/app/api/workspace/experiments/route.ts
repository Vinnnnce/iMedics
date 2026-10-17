import { z } from "zod";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { experimentVariant } from "@/lib/workspace/intelligence";
import { EXPERIMENTS } from "@/lib/workspace/experiments";
import { extensionAudit } from "@/lib/workspace/extensions";
import { analyticsRange, analyticsRangeSchema } from "@/lib/workspace/analytics";
import { badRequest } from "@/lib/errors";
const schema = z.object({ experiment: z.enum(EXPERIMENTS), event: z.enum(["exposure", "engagement"]), consent: z.literal(true) });
export const POST = withAuth(null, async (req, { user }) => {
  const body = await parseBody(req, schema);
  const variant = experimentVariant(user.id, body.experiment);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
    if (body.event === "engagement") {
      const exposure = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM workspace_experiments WHERE owner_id = ${user.id}::uuid
        AND experiment = ${body.experiment} AND event = 'exposure' AND created_at > now() - interval '30 days' LIMIT 1`;
      if (!exposure.length) throw badRequest("Opt in before recording engagement");
    }
    await tx.$executeRaw`INSERT INTO workspace_experiments(owner_id, experiment, variant, event)
      SELECT ${user.id}::uuid, ${body.experiment}, ${variant}, ${body.event}
      WHERE NOT EXISTS(SELECT 1 FROM workspace_experiments WHERE owner_id = ${user.id}::uuid AND experiment = ${body.experiment}
        AND event = ${body.event} AND created_at::date = current_date)`;
  });
  return Response.json({ variant });
});
export const GET = withAuth(["ADMIN"], async (req, { user }) => {
  let range;
  try { range = analyticsRange(parseQuery(req, analyticsRangeSchema)); } catch { throw badRequest("Choose an ordered date range of up to 366 days"); }
  await extensionAudit(user, "EXPERIMENT_REPORT_READ");
  return Response.json(await prisma.$queryRaw`SELECT experiment, variant, event, count(*)::int AS daily_events,
    count(DISTINCT owner_id)::int AS accounts FROM workspace_experiments
    WHERE created_at >= ${range.start} AND created_at < ${range.end} GROUP BY experiment, variant, event ORDER BY experiment, variant, event`);
});
export const DELETE = withAuth(null, async (req, { user }) => {
  await parseBody(req, z.object({ confirm: z.literal(true) }));
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
    await tx.$executeRaw`DELETE FROM workspace_experiments WHERE owner_id = ${user.id}::uuid`;
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "EXPERIMENT_CONSENT_REVOKED", resourceType: "Workspace" } });
  });
  return Response.json({ success: true });
});
