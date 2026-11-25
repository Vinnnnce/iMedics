import { describe, expect, it } from "vitest";
const url = process.env.ANALYTICS_TEST_DATABASE_URL;
describe.skipIf(!url)("owner without a membership row", () => {
  it("is admitted, gets an OWNER membership, and a suspended owner stays blocked", async () => {
    process.env.DATABASE_URL = url;
    const { prisma } = await import("@/lib/prisma");
    const { requireFacilityAccess } = await import("@/lib/facility-auth");
    const { getStaffMembership } = await import("@/lib/staff-access");
    const run = Math.random().toString(36).slice(2, 7);
    const user = await prisma.user.create({ data: { clerkId: `ow_${run}`, email: `ow-${run}@example.test`, name: "Owner", role: "LAB_SCIENTIST", accountType: "HOSPITAL", status: "ACTIVE", onboardingComplete: true } });
    const fac = await prisma.labStaffProfile.create({ data: { userId: user.id, laboratoryName: `OWN ${run}`, kind: "HOSPITAL", verificationStatus: "VERIFIED", isPublished: false, departments: [] } });
    expect(await prisma.facilityStaff.count({ where: { userId: user.id } })).toBe(0);
    const access = await requireFacilityAccess(user, "VIEW_ANALYTICS");
    expect(access.facility.id).toBe(fac.id);
    expect(access.facilityRole).toBe("OWNER");
    expect(await prisma.facilityStaff.count({ where: { userId: user.id } })).toBe(1);
    expect((await getStaffMembership(user, fac.id)).staffId).toBe(access.staffId);
    // a deliberately suspended owner is not silently re-admitted
    await prisma.facilityStaff.updateMany({ where: { userId: user.id }, data: { status: "SUSPENDED" } });
    await expect(requireFacilityAccess(user, "VIEW_ANALYTICS")).rejects.toThrow();
    expect(await prisma.facilityStaff.count({ where: { userId: user.id } })).toBe(1);
    // another account is never made an owner of someone else's facility
    const other = await prisma.user.create({ data: { clerkId: `ot_${run}`, email: `ot-${run}@example.test`, name: "Other", role: "LAB_SCIENTIST", accountType: "HOSPITAL", status: "ACTIVE", onboardingComplete: true } });
    await expect(requireFacilityAccess(other, null, new Request(`http://x/api?facilityId=${fac.id}`))).rejects.toThrow();
    expect(await prisma.facilityStaff.count({ where: { userId: other.id } })).toBe(0);
  });
});
