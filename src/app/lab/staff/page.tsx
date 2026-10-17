import { StaffManager } from "@/components/lab/staff-manager";
import { Card, CardContent } from "@/components/ui/card";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { FACILITY_ROLE_LABEL } from "@/lib/facility-staff";

export default async function LabStaffPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  const [staff, departments, branches] = await Promise.all([
    prisma.facilityStaff.findMany({
      where: { facilityId: profile.id, status: { not: "TERMINATED" } },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true, email: true, fullName: true, facilityRole: true, status: true,
        department: { select: { name: true } }, branch: { select: { name: true } },
        employmentType: true, publicProfileVisible: true, profileConsent: true,
        bookingEligible: true, professionalTitle: true, specialty: true,
        userId: true, acceptedAt: true, lastLoginAt: true,
        credentials: { select: { id: true, type: true, expiryDate: true, verificationStatus: true } },
      },
    }),
    prisma.facilityDepartment.findMany({ where: { facilityId: profile.id }, select: { id: true, name: true } }),
    prisma.facilityBranch.findMany({ where: { facilityId: profile.id }, select: { id: true, name: true } }),
  ]);

  const canManageStaff = staff.some((s) => s.userId === user.id && s.facilityRole === "OWNER");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every staff member signs in with their own account. Invitations are sent to a work email and must be
          accepted by that person — shared or generic accounts are not allowed.
        </p>
      </div>

      {profile.verificationStatus !== "VERIFIED" && (
        <Card className="beeline-card">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You can invite staff once an administrator has verified your facility.
          </CardContent>
        </Card>
      )}

      <StaffManager
        staff={staff.map((s) => ({
          ...s,
          credentials: s.credentials.map((c) => ({
            id: c.id, type: c.type, expiryDate: c.expiryDate?.toISOString() ?? null, verificationStatus: c.verificationStatus,
          })),
          acceptedAt: s.acceptedAt?.toISOString() ?? null,
          lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
        }))}
        departments={departments}
        branches={branches}
        canManageStaff={canManageStaff}
      />

      <Card className="beeline-card">
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How access works</p>
          <p>
            Roles carry least-privilege permissions: a receptionist can register patients and take payments but
            cannot enter results; a laboratory scientist processes samples, enters and releases results but cannot
            manage payouts. Permissions are checked by the server on every request.
          </p>
          <p>
            Available roles: {Object.values(FACILITY_ROLE_LABEL).join(", ")}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
