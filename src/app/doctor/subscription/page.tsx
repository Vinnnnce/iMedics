import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { monthStart } from "@/lib/clinic-time";
import { loadWorkspace } from "@/lib/workspace/data";
import { prisma } from "@/lib/prisma";
import { SubscriptionActions } from "./subscription-actions";

export default async function DoctorSubscriptionPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const workspace = await loadWorkspace(user);
  // The subscription table comes from an optional migration; only query it when
  // the workspace extensions are ready so deployments without it still render.
  const [row, consultationsThisMonth] = await Promise.all([
    workspace.extensionsReady
      ? prisma.$queryRaw<{ plan: string; status: "ACTIVE" | "PAUSED" | "CANCELLED"; renews_at: Date | null }[]>`
          SELECT plan, status, renews_at FROM workspace_subscriptions WHERE owner_id = ${user.id}::uuid`
      : Promise.resolve([]),
    prisma.consultation.count({
      where: { doctorId: doctor.id, createdAt: { gte: monthStart() } },
    }),
  ]);

  const subscription = row[0]
    ? { plan: row[0].plan, status: row[0].status, renewsAt: row[0].renews_at }
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your plan, usage, and renewal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <SubscriptionActions subscription={subscription} ready={workspace.extensionsReady} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No subscription record is configured yet. Plans are activated by the platform administrator after
                credential verification.
              </p>
              <p className="text-xs text-muted-foreground">
                Contact support to choose a plan, or finish your profile so verification can be completed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage this month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-bold">{consultationsThisMonth}</p>
          <p className="text-sm text-muted-foreground">Consultations created this calendar month</p>
          <p className="text-xs text-muted-foreground">
            Feature access — including AI-enabled documentation and triage support on eligible plans — is shown in
            your dashboard once your plan is active.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}