import { CredentialsManager } from "@/components/lab/credentials-manager";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { credentialExpiryState } from "@/lib/facility-staff";

export default async function LabCredentialsPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  const credentials = await prisma.staffCredential.findMany({
    where: { staff: { facilityId: profile.id } },
    orderBy: [{ expiryDate: "asc" }],
    select: {
      id: true, type: true, number: true, authority: true,
      issueDate: true, expiryDate: true, verificationStatus: true, verifiedAt: true,
      restrictions: true, renewalStatus: true,
      staff: { select: { id: true, fullName: true, facilityRole: true, status: true } },
    },
  });

  const staff = await prisma.facilityStaff.findMany({
    where: { facilityId: profile.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: [{ fullName: "asc" }],
    select: { id: true, fullName: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Credentials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Licences, registrations and certifications for your staff. Expiry reminders are sent at 90, 60, 30 and 7
          days, and expired credentials are flagged on the dashboard.
        </p>
      </div>
      <CredentialsManager
        credentials={credentials.map((c) => ({
          ...c,
          issueDate: c.issueDate?.toISOString() ?? null,
          expiryDate: c.expiryDate?.toISOString() ?? null,
          verifiedAt: c.verifiedAt?.toISOString() ?? null,
          expiryState: credentialExpiryState(c),
        }))}
        staff={staff}
      />
    </div>
  );
}
