import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acknowledgeWelfareAlert } from "@/lib/welfare";
import { AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The welfare alert page a trusted contact is directed to. It states that the
 * patient has not checked in and asks the contact to follow the agreed
 * welfare-check procedure. No clinical information is displayed.
 */
export default async function WelfareAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const alert = await prisma.welfareAlert.findUnique({
    where: { id },
    include: { rule: { include: { patient: true } }, deliveries: true },
  });

  const contact = alert
    ? await prisma.trustedContact.findFirst({ where: { patientId: alert.rule.patientId, userId: user.id } })
    : null;

  if (!alert || !contact) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-bold">Alert not found</h1>
        <p className="text-sm text-muted-foreground">This alert does not exist or is not addressed to your account.</p>
        <Link href="/dashboard" className="text-sm underline">Back to your dashboard</Link>
      </div>
    );
  }

  const isForMe = alert.rule.contactIds.includes(contact.id);
  const alreadyAcknowledged = alert.status === "ACKNOWLEDGED" || alert.acknowledgedAt != null;

  async function acknowledge() {
    "use server";
    await acknowledgeWelfareAlert(id, user.id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
      </Link>

      <Card className="beeline-card">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-bold">Welfare check alert</h1>
              <Badge variant={alreadyAcknowledged ? "secondary" : "destructive"} className="mt-1 rounded-lg">
                {alert.status.replaceAll("_", " ").toLowerCase()}
              </Badge>
            </div>
          </div>

          <p className="text-sm">
            This patient has not checked in on the platform within the last {alert.rule.thresholdHours} hours.
            Please follow the agreed welfare-check procedure.
          </p>

          <p className="text-xs text-muted-foreground">
            Platform inactivity does not necessarily indicate a medical problem. This alert is not an emergency
            service — if you believe the patient is in immediate danger, contact your local emergency number.
          </p>

          {isForMe && !alreadyAcknowledged ? (
            <form action={acknowledge}>
              <Button type="submit" data-testid="button-acknowledge-alert">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Acknowledge this alert
              </Button>
            </form>
          ) : alreadyAcknowledged ? (
            <p className="text-sm text-muted-foreground">This alert has been acknowledged. Thank you.</p>
          ) : (
            <p className="text-sm text-muted-foreground">This alert is addressed to another designated contact.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
