import Link from "next/link";
import {
  AlertCircle, BedDouble, Bell, Activity, Users,
  Wallet, ClipboardList, Settings, Award, TrendingUp, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import type { FacilityStaffStatus } from "@prisma/client";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { ProfileCompletenessCard } from "@/components/shared/profile-completeness-card";
import { facilityCompleteness } from "@/lib/profile-completeness";
import { FacilityHeader } from "@/components/facility/facility-header";
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
  return at === "HOSPITAL" || at === "LABORATORY" || at === "DIAGNOSTIC_CENTRE" || at === "PHARMACY" ? at : null;
}

async function recentDischargeCount(facilityId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.admission.count({
    where: { facilityId, status: "DISCHARGED", dischargeDate: { gte: sevenDaysAgo } },
  });
}

async function registeredPatientCount(facilityId: string): Promise<number> {
  return prisma.patient.count({
    where: { deletedAt: null, encounters: { some: { facilityId } } },
  });
}

async function newPatientCount(facilityId: string): Promise<number> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await prisma.encounter.findMany({
    where: { facilityId, registeredAt: { gte: monthAgo } },
    select: { patientId: true },
    distinct: ["patientId"],
  });
  if (recent.length === 0) return 0;
  return prisma.patient.count({
    where: {
      id: { in: recent.map((e) => e.patientId) },
      deletedAt: null,
      encounters: { none: { facilityId, registeredAt: { lt: monthAgo } } },
    },
  });
}

async function staffCounts(facilityId: string) {
  const activeStatuses: FacilityStaffStatus[] = ["ACTIVE", "ON_LEAVE"];
  const active = { facilityId, status: { in: activeStatuses } };
  const [doctors, nurses, total, suspended, terminated] = await Promise.all([
    prisma.facilityStaff.count({ where: { ...active, facilityRole: { in: ["DOCTOR", "RADIOLOGIST"] } } }),
    prisma.facilityStaff.count({ where: { ...active, facilityRole: "NURSE" } }),
    prisma.facilityStaff.count({ where: active }),
    prisma.facilityStaff.count({ where: { facilityId, status: "SUSPENDED" } }),
    prisma.facilityStaff.count({ where: { facilityId, status: "TERMINATED" } }),
  ]);
  return { doctors, nurses, total, suspended, terminated };
}

async function outstandingPayments(profile: { id: string; userId: string }) {
  const where = {
    status: "PENDING" as const,
    facilityBookingId: { not: null },
    payeeId: profile.userId,
  };
  const [count, sum] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { count, amount: sum._sum.amount ?? 0 };
}

async function departmentActivity(facilityId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const groups = await prisma.encounter.groupBy({
    by: ["department"],
    where: { facilityId, registeredAt: { gte: weekAgo } },
    _count: true,
  });
  return groups
    .map((g) => ({ name: g.department ?? "Unassigned", count: g._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default async function FacilityDashboardPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  if (!profile) return null;

  const today = clinicToday();
  const kind = await facilityKindOf(profile);
  const facilityId = profile.id;

  const [
    newOrders, inProgress, submittedToday, referralInbox, credentialAlerts, activeServices,
    totalPatients, newPatients, staffData, outstanding, departments,
    inpatients, criticalAlerts, recentDischarges, openEncounters,
  ] = await Promise.all([
    prisma.labOrder.count({ where: { OR: [{ performingFacilityId: facilityId, status: "ORDERED" }, { performingFacilityId: null, status: "ORDERED" }] } }),
    prisma.labOrder.count({ where: { OR: [{ performingFacilityId: facilityId, status: "IN_PROGRESS" }, { performingFacilityId: null, status: "IN_PROGRESS" }] } }),
    prisma.labResult.count({ where: { uploadedById: user.id, createdAt: { gte: clinicInstant(today, 0), lt: clinicInstant(today, 24 * 60) } } }),
    prisma.facilityReferral.count({ where: { facilityId: profile.id, status: "PENDING" } }),
    credentialAlertCount(profile.id),
    prisma.facilityService.count({ where: { facilityId: profile.id, isActive: true } }),
    registeredPatientCount(facilityId),
    newPatientCount(facilityId),
    staffCounts(facilityId),
    outstandingPayments(profile),
    kind === "HOSPITAL" ? departmentActivity(facilityId) : Promise.resolve([]),
    prisma.admission.count({ where: { facilityId, status: "ACTIVE" } }),
    prisma.criticalResultAlert.count({ where: { orderingFacilityId: facilityId, status: { in: ["SENT", "ESCALATED"] } } }),
    recentDischargeCount(facilityId),
    kind === "HOSPITAL" ? prisma.encounter.count({ where: { facilityId, closedAt: null } }) : Promise.resolve(0),
  ]);

  const completeness = facilityCompleteness({
    logoUrl: profile.logoUrl,
    about: profile.about,
    operatingHours: profile.operatingHours,
    addressLine: profile.addressLine,
    city: profile.city,
    serviceCount: activeServices,
    isPublished: profile.isPublished,
  });

  const suggestionItems = facilitySuggestions({
    accountType: kind as any,
    referralInbox,
    credentialAlerts,
    activeServices,
  });

  // Critical alerts
  const criticalItems = [];
  if (credentialAlerts > 0) criticalItems.push({ type: "credential", count: credentialAlerts, label: "Staff credentials expiring" });
  if (criticalAlerts > 0) criticalItems.push({ type: "critical", count: criticalAlerts, label: "Critical lab alerts" });
  if (referralInbox > 0) criticalItems.push({ type: "referral", count: referralInbox, label: "Pending referrals" });
  if (staffData.suspended > 0) criticalItems.push({ type: "staff", count: staffData.suspended, label: "Suspended staff members" });

  return (
    <>
      <FacilityHeader
        facilityName={profile.laboratoryName || "Facility"}
        facilityType={kind || "Healthcare Facility"}
        totalStaff={staffData.total}
        activeServices={activeServices}
        verificationStatus={profile.verificationStatus}
      />
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{profile.laboratoryName || "Facility"}</h1>
            <p className="text-muted-foreground mt-1">
              {kind === "HOSPITAL" ? "Hospital Operations" : kind === "LABORATORY" ? "Laboratory Management" : kind === "DIAGNOSTIC_CENTRE" ? "Diagnostic Center" : kind === "PHARMACY" ? "Pharmacy Management" : "Facility Management"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.verificationStatus === "VERIFIED" && (
              <Badge className="bg-green-100 text-green-800 rounded-lg">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </Badge>
            )}
            {credentialAlerts > 0 && (
              <Badge variant="destructive" className="rounded-lg">
                <AlertCircle className="h-3 w-3 mr-1" /> {credentialAlerts} Credentials expiring
              </Badge>
            )}
            <Link href="/lab/organization">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </Button>
            </Link>
          </div>
        </div>

        <ProfileCompletenessCard completeness={completeness} title="Complete your public profile" />

        {/* Account-specific suggestions */}
        <SuggestionsCard items={suggestionItems} />

        {/* Critical Alerts */}
        {criticalItems.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Pending Actions ({criticalItems.length})</p>
                  <div className="space-y-1 mt-2">
                    {criticalItems.map((item, i) => (
                      <p key={i} className="text-sm text-red-800">
                        • {item.count} {item.label}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Primary Operations KPIs */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Operations at a Glance</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* New Orders */}
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">New Orders</p>
                    <p className="text-2xl font-bold">{newOrders}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* In Progress */}
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold">{inProgress}</p>
                  </div>
                  <Activity className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* Submitted Today */}
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted Today</p>
                    <p className="text-2xl font-bold">{submittedToday}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* Active Services */}
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Services</p>
                    <p className="text-2xl font-bold">{activeServices}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* Outstanding Payments */}
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payments</p>
                    <p className="text-2xl font-bold">{outstanding.count}</p>
                  </div>
                  <Wallet className="h-8 w-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Organization Overview */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Organization Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                  <p className="text-2xl font-bold">{totalPatients}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">New (30 days)</p>
                  <p className="text-2xl font-bold">{newPatients}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Staff</p>
                  <p className="text-2xl font-bold">{staffData.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Doctors</p>
                  <p className="text-2xl font-bold">{staffData.doctors}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nurses</p>
                  <p className="text-2xl font-bold">{staffData.nurses}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="beeline-card">
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                  <p className="text-2xl font-bold text-orange-600">{staffData.suspended}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hospital-Specific Operations */}
        {kind === "HOSPITAL" && (
          <>
            <div>
              <h2 className="text-lg font-semibold mb-3">Hospital Operations</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="beeline-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Inpatients</p>
                        <p className="text-2xl font-bold">{inpatients}</p>
                      </div>
                      <BedDouble className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="beeline-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Critical Alerts</p>
                        <p className="text-2xl font-bold">{criticalAlerts}</p>
                      </div>
                      <Bell className="h-8 w-8 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="beeline-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Recent Discharges</p>
                        <p className="text-2xl font-bold">{recentDischarges}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="beeline-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Open Encounters</p>
                        <p className="text-2xl font-bold">{openEncounters}</p>
                      </div>
                      <Activity className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Department Activity */}
            {departments.length > 0 && (
              <Card className="beeline-card">
                <CardHeader>
                  <CardTitle className="text-lg">Department Activity (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {departments.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-2 border-b last:border-0">
                      <p className="font-medium">{d.name}</p>
                      <Badge variant="outline">{d.count} encounters</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Quick Access Links */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/lab/staff">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Staff
              </Button>
            </Link>
            <Link href="/lab/orders">
              <Button variant="outline" className="w-full justify-start">
                <ClipboardList className="h-4 w-4 mr-2" />
                Orders
              </Button>
            </Link>
            <Link href="/lab/admissions">
              <Button variant="outline" className="w-full justify-start">
                <BedDouble className="h-4 w-4 mr-2" />
                Admissions
              </Button>
            </Link>
            <Link href="/lab/services">
              <Button variant="outline" className="w-full justify-start">
                <Award className="h-4 w-4 mr-2" />
                Services
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
