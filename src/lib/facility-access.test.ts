import { describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
vi.mock("./access", () => ({ getVerifiedFacilityProfile: vi.fn().mockResolvedValue({ id: "facility-a" }) }));
import { facilityPatientWhere } from "./facility-access";
describe("facility clinical scope", () => {
  it("requires a facility booking or the caller's own upload, never a global queue", async () => {
    const where = await facilityPatientWhere({ id: "staff-a" } as User);
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toHaveLength(2);
    expect(JSON.stringify(where)).toContain("facility-a");
    expect(JSON.stringify(where)).toContain("staff-a");
    expect(JSON.stringify(where)).toContain("SUCCESSFUL");
    expect(JSON.stringify(where)).not.toContain('"PENDING"');
  });
});
