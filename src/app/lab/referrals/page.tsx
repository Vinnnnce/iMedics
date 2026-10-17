import { ReferralsInbox } from "@/components/lab/referrals-inbox";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";

export default async function LabReferralsPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  const referrals = await prisma.facilityReferral.findMany({
    where: { facilityId: profile.id },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true, status: true, note: true, createdAt: true, handledAt: true,
      service: { select: { name: true, price: true, currency: true } },
      fromDoctor: { select: { specialty: true, user: { select: { name: true } } } },
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Referral inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Referrals sent to your facility by Medic1905 doctors.
        </p>
      </div>
      <ReferralsInbox
        referrals={referrals.map((r) => ({
          id: r.id, status: r.status, note: r.note, createdAt: r.createdAt.toISOString(),
          service: r.service ? { name: r.service.name, price: Number(r.service.price), currency: r.service.currency } : null,
          doctor: { name: r.fromDoctor.user.name, specialty: r.fromDoctor.specialty },
          patient: { name: `${r.patient.firstName} ${r.patient.lastName}`, caseNumber: r.patient.caseNumber },
        }))}
      />
    </div>
  );
}
