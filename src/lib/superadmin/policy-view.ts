import { prisma } from "@/lib/prisma";

/** Latest revision per policy key for a given kind (FEATURE or DOCUMENT). */
export async function latestPolicies(kind: "FEATURE" | "DOCUMENT") {
  const policies = await prisma.platformPolicy.findMany({ where: { kind }, orderBy: { revision: "desc" }, take: 500 });
  const latest = new Map<string, (typeof policies)[number]>();
  for (const p of policies) if (!latest.has(p.key)) latest.set(p.key, p);
  return [...latest.values()];
}

/** The current availability mode for a module resource, if a policy exists. */
export async function moduleMode(resource: string): Promise<string> {
  const policies = await prisma.platformPolicy.findMany({ where: { kind: "FEATURE", resource }, orderBy: { revision: "desc" }, take: 1 });
  return policies[0]?.mode ?? "ENABLED";
}
