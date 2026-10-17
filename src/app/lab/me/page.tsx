import { MyStaffProfile } from "@/components/lab/my-staff-profile";
import { Card, CardContent } from "@/components/ui/card";
import { requireFacilityPortalPage } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";

export default async function LabMePage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);

  const membership = await prisma.facilityStaff.findFirst({
    where: { userId: user.id, facilityId: facility.id },
    select: {
      id: true, fullName: true, email: true, facilityRole: true, status: true,
      department: { select: { name: true } }, branch: { select: { name: true } },
      professionalTitle: true, qualifications: true, specialty: true, yearsExperience: true,
      bio: true, photoUrl: true, languages: true, linkedinUrl: true, linkedinPublic: true,
      publicProfileVisible: true, profileConsent: true, bookingEligible: true,
    },
  });
  if (!membership) {
    return (
      <Card className="beeline-card mx-auto max-w-md">
        <CardContent className="p-6 text-sm text-muted-foreground">
          You do not have a staff profile for this facility.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">My staff profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {facility.laboratoryName} · Update your professional details and choose whether your profile appears on
          the facility&apos;s public page.
        </p>
      </div>
      <MyStaffProfile
        staff={{
          ...membership,
          facilityName: facility.laboratoryName,
        }}
      />
    </div>
  );
}
