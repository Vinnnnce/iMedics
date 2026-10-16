import { ProfileForm } from "@/components/profile-form";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN");

  const [doctor, lab, patientRecord] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
    user.role === "PATIENT"
      ? prisma.patient.findFirst({
          where: { userId: user.id, deletedAt: null },
          select: {
            preferredName: true, bloodGroup: true, organDonorStatus: true,
            ecName: true, ecRelationship: true, ecPhone: true,
            addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true,
          },
        })
      : null,
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account details</p>
      </div>
      <ProfileForm
        email={user.email}
        role={user.role}
        verificationStatus={doctor?.verificationStatus ?? lab?.verificationStatus ?? null}
        initial={{ name: user.name, phone: user.phone ?? "", language: user.language }}
        patient={
          patientRecord
            ? {
                preferredName: patientRecord.preferredName ?? "",
                bloodGroup: patientRecord.bloodGroup ?? "",
                organDonorStatus:
                  patientRecord.organDonorStatus === null ? "" : patientRecord.organDonorStatus ? "yes" : "no",
                ecName: patientRecord.ecName ?? "",
                ecRelationship: patientRecord.ecRelationship ?? "",
                ecPhone: patientRecord.ecPhone ?? "",
                addressLine1: patientRecord.addressLine1 ?? "",
                addressLine2: patientRecord.addressLine2 ?? "",
                city: patientRecord.city ?? "",
                state: patientRecord.state ?? "",
                postalCode: patientRecord.postalCode ?? "",
                country: patientRecord.country ?? "",
              }
            : undefined
        }
      />
      <NotificationPreferences />
    </div>
  );
}
