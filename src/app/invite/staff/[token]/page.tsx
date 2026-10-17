import { AcceptStaffInvitation } from "@/components/shared/accept-staff-invitation";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Accept staff invitation — Medic1905" };

export default async function AcceptStaffInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/invite/staff/${token}`)}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <AcceptStaffInvitation token={token} />
    </div>
  );
}
