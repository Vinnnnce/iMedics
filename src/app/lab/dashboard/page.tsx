import Link from "next/link";
import { ClipboardList, FlaskConical, Upload, BedDouble, Activity, SearchCheck, Bell, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { facilitySuggestions } from "@/lib/suggestions";

/** Credentials expiring within 90 days (or already expired) for the facility. */
async function credentialAlertCount(facilityId: string): Promise<number> {
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return prisma.staffCredential.count({ where: { staff: { facilityId }, expiryDate: { lte: in90Days } } });
}

async function facilityKindOf(profile: { id: string; kind: string | null; userId: string }) {
  if (profile.kind) return profile.kind;
  const owner = await prisma.user.findUnique({ where: { id: profile.userId }, select: { accountType: true } });
  const at = owner?.accountType;
  return at === "HOSPITAL" || at === "LABORATORY" || at === "DIAGNOSTIC_CENTRE" ? at : null;
}

/** Admissions discharged within the last 7 days. */
async function recentDischargeCount(facilityId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.admission.count({
    where: { facilityId, status: "DISCHARGED", dischargeDate: { gte: sevenDaysAgo } },
  });
}

export default async function LabDashboardPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  if (!profile) return null;
  const today = clinicToday();
  const kind = await facilityKindOf(profile);
  const facilityId = profile.id;

  const [newOrders, inProgress, submittedToday, referralInbox, credentialAlerts, activeServices] = await Promise.all([
    // Facility-scoped work queues — never a global count across organizations.
    prisma.labOrder.count({ where: { OR: [{ performingFacilityId: facilityId, status: "ORDERED" }, { performingFacilityId: null, status: "ORDERED" }] } }),
    prisma.labOrder.count({ where: { OR: [{ performingFacilityId: facilityId, status: "IN_PROGRESS" }, { performingFacilityId: null, status: "IN_PROGRESS" }] } }),
    prisma.labResult.count({ where: { uploadedById: user.id, createdAt: { gte: clinicInstant(today, 0), lt: clinicInstant(today, 24 * 60) } } }),
    // Referral inbox
    prisma.facilityReferral.count({ where: { facilityId: profile.id, status: "PENDING" } }),
    // Credential alerts: expiring within 90 days or already expired
    credentialAlertCount(profile.id),
    prisma.facilityService.count({ where: { facilityId: profile.id, isActive: true } }),
  ]);

  const stats = [
    { label: "New orders", value: newOrders, icon: ClipboardList, href: "/lab/orders" },
    { label: "In progress", value: inProgress, icon: FlaskConical, href: "/lab/orders" },
    { label: "Submitted today", value: submittedToday, icon: Upload, href: "/lab/upload" },
  ];

  // Module dashboards (spec section 8) — shown per facility kind.
  const [
    inpatients, pendingLabInvestigations, criticalToAcknowledge, recentDischarges,
    newLabRequests, specimensToReceive, recollectionsNeeded, labCriticalOpen,
    newReferrals, reportsAwaitingInterpretation, reportsAwaitingVerification, reportsAwaitingDelivery,
  ] = await Promise.all([
    prisma.admission.count({ where: { facilityId, status: "ACTIVE" } }),
    prisma.labOrder.count({ where: { requestingFacilityId: facilityId, status: { in: ["ORDERED", "ACCEPTED", "SPECIMEN_PENDING", "IN_PROGRESS", "AWAITING_VERIFICATION"] } } }),
    prisma.criticalResultAlert.count({ where: { orderingFacilityId: facilityId, status: { in: ["SENT", "ESCALATED"] } } }),
    recentDischargeCount(facilityId),
    prisma.labOrder.count({ where: { OR: [{ performingFacilityId: facilityId, status: "ORDERED" }, { performingFacilityId: null, status: "ORDERED" }] } }),
    prisma.specimen.count({ where: { facilityId, status: { in: ["PENDING_COLLECTION", "COLLECTED"] } } }),
    prisma.specimen.count({ where: { facilityId, status: "RECOLLECTION_REQUESTED" } }),
    prisma.criticalResultAlert.count({ where: { labResult: { labOrder: { performingFacilityId: facilityId } }, status: { in: ["SENT", "ESCALATED"] } } }),
    prisma.facilityBooking.count({ where: { service: { facilityId }, status: "REQUESTED" } }),
    prisma.diagnosticReport.count({ where: { facilityId, status: "DRAFT" } }),
    prisma.diagnosticReport.count({ where: { facilityId, status: "AWAITING_VERIFICATION" } }),
    prisma.diagnosticReport.count({ where: { facilityId, status: { in: ["FINALIZED", "AMENDED"] } } }),
  ]);

  const moduleStats =
    kind === "HOSPITAL"
      ? [
          { label: "Current inpatients", value: inpatients, icon: BedDouble, href: "/lab/admissions" },
          { label: "Pending lab investigations", value: pendingLabInvestigations, icon: SearchCheck, href: "/lab/investigations" },
          { label: "Critical results to acknowledge", value: criticalToAcknowledge, icon: Bell, href: "/lab/critical-alerts" },
          { label: "Recent discharges", value: recentDischarges, icon: Activity, href: "/lab/admissions" },
        ]
      : kind === "LABORATORY"
        ? [
            { label: "New requests", value: newLabRequests, icon: ClipboardList, href: "/lab/orders" },
            { label: "Specimens to receive", value: specimensToReceive, icon: FlaskConical, href: "/lab/specimens" },
            { label: "Recollections needed", value: recollectionsNeeded, icon: FlaskConical, href: "/lab/specimens" },
            { label: "Critical alerts open", value: labCriticalOpen, icon: Bell, href: "/lab/critical-alerts" },
          ]
        : kind === "DIAGNOSTIC_CENTRE"
          ? [
              { label: "New referrals", value: newReferrals, icon: ClipboardList, href: "/lab/examinations" },
              { label: "Reports awaiting interpretation", value: reportsAwaitingInterpretation, icon: FileText, href: "/lab/examinations" },
              { label: "Reports awaiting verification", value: reportsAwaitingVerification, icon: SearchCheck, href: "/lab/examinations" },
              { label: "Finalized awaiting delivery", value: reportsAwaitingDelivery, icon: Activity, href: "/lab/examinations" },
            ]
          : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orders and results at a glance</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {moduleStats.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">
            {kind === "HOSPITAL" ? "Hospital" : kind === "LABORATORY" ? "Laboratory" : "Diagnostic centre"} module
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {moduleStats.map((s) => (
              <Link key={s.label} href={s.href}>
                <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <s.icon className="h-5 w-5 text-muted-foreground" />
                    <p className="mt-3 text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Account-specific suggestions */}
      <SuggestionsCard
        items={facilitySuggestions({
          accountType: user.accountType,
          referralInbox,
          credentialAlerts,
          activeServices,
        })}
      />
    </div>
  );
}
