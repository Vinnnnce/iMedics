import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
describe("production release approval boundary", () => {
  it.each([
    ["", "", ""],
    ["1", "", "change-reference"],
    ["1", "1", ""],
    ["", "1", "change-reference"],
  ])("halts before npm/migrations without complete approval (%s,%s,%s)", (approved, restored, reference) => {
    const r = spawnSync("bash", ["scripts/release-safe-build.sh"], { encoding: "utf8", env: {
      ...process.env, MEDIC1905_ORG_RELEASE_APPROVED: approved,
      MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED: restored, MEDIC1905_ORG_BACKUP_REFERENCE: reference,
    } });
    expect(r.status).toBe(78);
    expect(r.stderr).toContain("held before database migration");
    expect(r.stdout).not.toContain("prisma");
  });
});
