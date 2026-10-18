import Link from "next/link";
import { ClipboardList, FlaskConical, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { clinicInstant, clinicToday, daysFromNow } from "@/lib/clinic-time";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { facilitySuggestions } from "@/lib/suggestions";

export default async function LabDashboardPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  const today = clinicToday();
  const in90Days = daysFromNow(90);

  const [newOrders, inProgress, submittedToday, referralInbox, credentialAlerts, activeServices] = await Promise.all([
    prisma.labOrder.count({ where: { status: "ORDERED" } }),
    prisma.labOrder.count({ where: { status: "IN_PROGRESS" } }),
    prisma.labResult.count({ where: { uploadedById: user.id, createdAt: { gte: clinicInstant(today, 0), lt: clinicInstant(today, 24 * 60) } } }),
    // Referral inbox
    prisma.facilityReferral.count({ where: { facilityId: profile.id, status: "PENDING" } }),
    // Credential alerts: expiring within 90 days or already expired
    prisma.staffCredential.count({ where: { staff: { facilityId: profile.id }, expiryDate: { lte: in90Days } } }),
    prisma.facilityService.count({ where: { facilityId: profile.id, deletedAt: null, isPublished: true } }),
  ]);

  const stats = [
    { label: "New orders", value: newOrders, icon: ClipboardList, href: "/lab/orders" },
    { label: "In progress", value: inProgress, icon: FlaskConical, href: "/lab/orders" },
    { label: "Submitted today", value: submittedToday, icon: Upload, href: "/lab/upload" },
  ];

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
