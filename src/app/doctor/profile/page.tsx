import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { ProfessionalProfileForm } from "@/components/doctor/professional-profile-form";

export default async function DoctorProfilePage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const cvFile = doctor.cvFileId ? await prisma.doctorFile.findUnique({ where: { id: doctor.cvFileId }, select: { fileName: true } }) : null;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Professional profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What patients see on your public profile. Nothing is published until you provide it.
        </p>
      </div>
      <ProfessionalProfileForm
        initial={{
          professionalTitle: doctor.professionalTitle,
          qualifications: doctor.qualifications,
          clinicalInterests: doctor.clinicalInterests,
          conditionsTreated: doctor.conditionsTreated,
          proceduresPerformed: doctor.proceduresPerformed,
          patientCarePhilosophy: doctor.patientCarePhilosophy,
          consultationApproach: doctor.consultationApproach,
          whenToBookGuidance: doctor.whenToBookGuidance,
          consultationModes: doctor.consultationModes,
          linkedinUrl: doctor.linkedinUrl,
          linkedinPublic: doctor.linkedinPublic,
          cvFileName: cvFile?.fileName ?? null,
          cvFileId: doctor.cvFileId,
          licensingAuthority: doctor.licensingAuthority,
          licenseExpiry: doctor.licenseExpiry ? doctor.licenseExpiry.toISOString().slice(0, 10) : null,
          licensePublic: doctor.licensePublic,
          professionalMemberships: doctor.professionalMemberships,
          awards: doctor.awards,
          hospitalAffiliations: doctor.hospitalAffiliations,
        }}
      />
    </div>
  );
}
