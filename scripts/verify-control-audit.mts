import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("A securely provisioned database connection is required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const result = await db.$queryRaw<{ total: bigint; invalid: bigint }[]>`
    SELECT count(*) AS total, count(*) FILTER (WHERE previous_hash <> expected_previous
      OR hash <> encode(sha256(convert_to(jsonb_build_array(previous_hash, sequence, actor_id,
        facility_id, action, resource_id, details, occurred_at)::text, 'UTF8')), 'hex')) AS invalid
    FROM (SELECT *, lag(hash, 1, '') OVER (ORDER BY sequence) AS expected_previous FROM control_audit_events) e`;
  console.log(JSON.stringify({ total: String(result[0].total), invalid: String(result[0].invalid) }));
  if (Number(result[0].invalid)) process.exitCode = 1;
} finally { await db.$disconnect(); }
