import { notFound } from "next/navigation";
import { LetterheadManager, type LetterheadRow } from "@/components/his/letterhead-manager";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function DoctorLetterheadsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();
  const letterheads = await prisma.letterheadProfile.findMany({
    where: { userId: doctor.userId, active: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">My letterheads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal letterhead is used on consultation reports you issue from your independent practice.
          When you work under a hospital, that hospital&apos;s letterhead is used instead — you cannot issue
          documents under another facility&apos;s registration.
        </p>
      </div>
      <LetterheadManager base="/api/doctors/me/letterheads" facilityMode={false} letterheads={letterheads as LetterheadRow[]} />
    </div>
  );
}
