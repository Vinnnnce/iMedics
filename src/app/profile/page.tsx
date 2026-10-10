import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const [doctor, lab] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
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
      />
    </div>
  );
}
