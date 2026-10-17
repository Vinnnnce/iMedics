import { SubscriptionManager } from "@/components/doctor/subscription-manager";
import { requirePageRole } from "@/lib/guards";

export default async function DoctorSubscriptionPage() {
  await requirePageRole("DOCTOR");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan to unlock video and audio consultations, AI tools and analytics. Chat with your patients and your
          directory listing are always included.
        </p>
      </div>
      <SubscriptionManager />
    </div>
  );
}
