/** Used by the CLI only; never imported by an authentication or HTTP route. */
export const ACCEPTANCE_ROLES = ["owner", "author", "reviewer", "nurse", "pharmacist", "lab", "radiologist", "records", "insurance", "receptionist", "patient"] as const;
export type AcceptanceRole = typeof ACCEPTANCE_ROLES[number];
export type AcceptanceHospital = "a" | "b";

export function acceptanceEmail(runId: string, hospital: AcceptanceHospital, role: AcceptanceRole): string {
  if (!/^[a-z0-9]{6,20}$/.test(runId)) throw new Error("Run id must be 6–20 lowercase letters/numbers");
  return `imedics-${runId}-${hospital}-${role}+clerk_test@example.com`;
}

export function acceptanceRoster(runId: string) {
  return (["a", "b"] as const).flatMap((hospital) => ACCEPTANCE_ROLES.map((role) => ({
    hospital, role, email: acceptanceEmail(runId, hospital, role),
    name: `SYNTHETIC TEST ${hospital.toUpperCase()} ${role}`,
  })));
}

export function assertAcceptanceDatabase(env: Record<string, string | undefined>) {
  if (env.HIS_ACCEPTANCE_ENABLED !== "true") throw new Error("Set HIS_ACCEPTANCE_ENABLED=true explicitly");
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") throw new Error("Acceptance provisioning refuses production");
  const base = new URL(env.HIS_ACCEPTANCE_BASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || (!local && base.protocol !== "https:") || base.pathname !== "/" || base.search || base.hash ||
      ["i-medics.vercel.app", "www.i-medics.vercel.app"].includes(base.hostname) ||
      base.hostname !== env.HIS_ACCEPTANCE_ALLOWED_HOST) throw new Error("An explicitly allowlisted isolated staging origin is required");
  const database = new URL(env.HIS_ACCEPTANCE_DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      database.hostname !== env.HIS_ACCEPTANCE_DATABASE_HOST ||
      decodeURIComponent(database.pathname.slice(1)) !== env.HIS_ACCEPTANCE_DATABASE_NAME ||
      (env.DATABASE_URL && env.DATABASE_URL === env.HIS_ACCEPTANCE_DATABASE_URL)) {
    throw new Error("Use an explicitly allowlisted, separate disposable PostgreSQL database");
  }
  const ttlHours = Number(env.HIS_ACCEPTANCE_TTL_HOURS ?? "24");
  if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > 48) throw new Error("Test-account TTL must be 1–48 hours");
  return { baseUrl: base.origin, databaseUrl: database.toString(), ttlHours };
}

export function assertAcceptanceEnvironment(env: Record<string, string | undefined>) {
  const config = assertAcceptanceDatabase(env);
  const proxy = env.HIS_ACCEPTANCE_CLERK_PROXY === "true" && Boolean(env.HTTPS_PROXY);
  if ((!proxy && !env.CLERK_SECRET_KEY?.startsWith("sk_test_")) || env.CLERK_SECRET_KEY?.startsWith("sk_live_") ||
      !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) {
    throw new Error("Only Clerk TEST-instance keys are allowed");
  }
  return config;
}
