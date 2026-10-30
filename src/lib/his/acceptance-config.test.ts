import { describe, expect, it } from "vitest";
import { acceptanceEmail, acceptanceRoster, assertAcceptanceEnvironment } from "./acceptance-config";

const env = {
  HIS_ACCEPTANCE_ENABLED: "true", HIS_ACCEPTANCE_BASE_URL: "https://imedics-stage.example.com",
  HIS_ACCEPTANCE_ALLOWED_HOST: "imedics-stage.example.com",
  HIS_ACCEPTANCE_DATABASE_URL: "postgresql://synthetic:synthetic@localhost:5432/imedics_acceptance",
  HIS_ACCEPTANCE_DATABASE_HOST: "localhost", HIS_ACCEPTANCE_DATABASE_NAME: "imedics_acceptance",
  CLERK_SECRET_KEY: "sk_test_synthetic", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
};
describe("disposable account safety", () => {
  it("creates disjoint two-hospital identities, without real delivery addresses", () => {
    const rows = acceptanceRoster("accept2026");
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((r) => r.email)).size).toBe(20);
    expect(rows.every((r) => r.email.endsWith("+clerk_test@example.com"))).toBe(true);
  });
  it("rejects invalid namespace injection", () => {
    expect(() => acceptanceEmail("../real", "a", "owner")).toThrow();
  });
  it("accepts an explicitly isolated staging setup", () => {
    expect(assertAcceptanceEnvironment(env)).toMatchObject({ baseUrl: "https://imedics-stage.example.com", ttlHours: 24 });
  });
  it.each([
    { HIS_ACCEPTANCE_ENABLED: "false" }, { VERCEL_ENV: "production" }, { NODE_ENV: "production" },
    { HIS_ACCEPTANCE_BASE_URL: "https://i-medics.vercel.app", HIS_ACCEPTANCE_ALLOWED_HOST: "i-medics.vercel.app" },
    { HIS_ACCEPTANCE_BASE_URL: "https://not-allowlisted.example.com" },
    { HIS_ACCEPTANCE_BASE_URL: "https://imedics-stage.example.com/path" },
    { HIS_ACCEPTANCE_BASE_URL: "https://user:pass@imedics-stage.example.com" },
    { HIS_ACCEPTANCE_BASE_URL: "http://imedics-stage.example.com" },
    { HIS_ACCEPTANCE_DATABASE_HOST: "production-db.example.com" },
    { HIS_ACCEPTANCE_DATABASE_NAME: "production" },
    { DATABASE_URL: env.HIS_ACCEPTANCE_DATABASE_URL },
    { CLERK_SECRET_KEY: "sk_live_not-allowed" }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_not-allowed" },
    { HIS_ACCEPTANCE_TTL_HOURS: "168" },
  ])("refuses unsafe configuration %j", (unsafe) => {
    expect(() => assertAcceptanceEnvironment({ ...env, ...unsafe })).toThrow();
  });
});
