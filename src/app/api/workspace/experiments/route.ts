import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { experimentVariant } from "@/lib/workspace/intelligence";
export const POST = withAuth(null, async (req, { user }) => {
  const b = await parseBody(req, z.object({ consent: z.literal(true), experiment: z.enum(["homepage-cta", "dashboard-engagement"]), event: z.enum(["exposure", "engagement", "conversion"]) }));
  const variant = experimentVariant(user.id, b.experiment);
  // One event per user/experiment/type/day, serialized to resist accidental double clicks.
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id + b.experiment + b.event}))::text`;
    await tx.$executeRaw`INSERT INTO workspace_experiment_events(id, owner_id, experiment, variant, event)
      SELECT ${randomUUID()}::uuid, ${user.id}::uuid, ${b.experiment}, ${variant}, ${b.event}
      WHERE NOT EXISTS(SELECT 1 FROM workspace_experiment_events WHERE owner_id = ${user.id}::uuid AND experiment = ${b.experiment} AND event = ${b.event} AND created_at > now() - interval '24 hours')`;
  });
  return Response.json({ variant });
});
export const GET = withAuth(["ADMIN"], async () => {
  return Response.json(await prisma.$queryRaw`SELECT experiment, variant, event, COUNT(DISTINCT owner_id)::int AS users FROM workspace_experiment_events GROUP BY experiment, variant, event`, { headers: { "Cache-Control": "no-store" } });
});
