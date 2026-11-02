import Link from "next/link";
import {
  ClipboardList, FlaskConical, Upload, BedDouble, Activity, SearchCheck, Bell, FileText,
  Users, Stethoscope, HeartPulse, Wallet, CalendarClock, Building2, LayoutDashboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import type { FacilityStaffStatus } from "@prisma/client";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { facilitySuggestions } from "@/lib/suggestions";
import { ProfileCompletenessCard } from "@/components/shared/profile-completeness-card";
import { facilityCompleteness } from "@/lib/profile-completeness";

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

/** Admissions discharged within the last 7 days. */
async function recentDischargeCount(facilityId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.admission.count({
    where: { facilityId, status: "DISCHARGED", dischargeDate: { gte: sevenDaysAgo } },
  });
}

/** Registered patients: distinct patients that have had an encounter here. */
async function registeredPatientCount(facilityId: string): Promise<number> {
  return prisma.patient.count({
    where: { deletedAt: null, encounters: { some: { facilityId } } },
  });
}

/** New patients: first-ever encounter at this facility within the last 30 days. */
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

/** Facility staff headcount by role family (doctors, nurses, total active). */
async function staffCounts(facilityId: string) {
  const activeStatuses: FacilityStaffStatus[] = ["ACTIVE", "ON_LEAVE"];
  const active = { facilityId, status: { in: activeStatuses } };
  const [doctors, nurses, total] = await Promise.all([
    prisma.facilityStaff.count({ where: { ...active, facilityRole: { in: ["DOCTOR", "RADIOLOGIST"] } } }),
    prisma.facilityStaff.count({ where: { ...active, facilityRole: "NURSE" } }),
    prisma.facilityStaff.count({ where: active }),
  ]);
  return { doctors, nurses, total };
}

/** Outstanding payments: pending facility bookings billed to this facility. */
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

/** Department activity: encounters in the last 7 days grouped by department. */
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

  // Organization overview (spec section 6) — real database counts, scoped to
  // this facility only.
  const [totalPatients, newPatients, staff, outstanding] = await Promise.all([
    registeredPatientCount(facilityId),
    newPatientCount(facilityId),
    staffCounts(facilityId),
    outstandingPayments(profile),
  ]);

  const organizationStats = [
    { label: "Registered patients", value: totalPatients, icon: Users, href: "/lab/users" },
    { label: "New patients (30 days)", value: newPatients, icon: Activity, href: "/lab/users" },
    { label: "Doctors", value: staff.doctors, icon: Stethoscope, href: "/lab/staff" },
    { label: "Nurses", value: staff.nurses, icon: HeartPulse, href: "/lab/nursing" },
    { label: "Staff members", value: staff.total, icon: Building2, href: "/lab/staff" },
    { label: "Outstanding payments", value: outstanding.count, icon: Wallet, href: "/payments" },
  ];

  // Module dashboards (spec section 8) — shown per facility kind.
  const [
    inpatients, pendingLabInvestigations, criticalToAcknowledge, recentDischarges,
    newLabRequests, specimensToReceive, recollectionsNeeded, labCriticalOpen,
    newReferrals, reportsAwaitingInterpretation, reportsAwaitingVerification, reportsAwaitingDelivery,
    ordersToReview, dispensedToday, activeFormulary,
    emergencyOpen, plannedAdmissions, departments, openEncounters,
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
    prisma.medicationOrder.count({ where: { facilityId, status: "SUBMITTED" } }),
    prisma.medicationOrder.count({ where: { facilityId, status: "DISPENSED", dispensedAt: { gte: clinicInstant(today, 0) } } }),
    prisma.formularyItem.count({ where: { facilityId, active: true } }),
    // Hospital operations: open emergency encounters and planned inpatients.
    kind === "HOSPITAL"
      ? prisma.encounter.count({ where: { facilityId, closedAt: null, priority: "EMERGENCY" } })
      : Promise.resolve(0),
    kind === "HOSPITAL"
      ? prisma.encounter.count({ where: { facilityId, closedAt: null, type: "PLANNED_INPATIENT" } })
      : Promise.resolve(0),
    kind === "HOSPITAL" ? departmentActivity(facilityId) : Promise.resolve([]),
    kind === "HOSPITAL"
      ? prisma.encounter.count({ where: { facilityId, closedAt: null } })
      : Promise.resolve(0),
  ]);

  const hospitalOperationsStats = [
    { label: "Emergency patients (open)", value: emergencyOpen, icon: HeartPulse, href: "/lab/encounters?board=emergency" },
    { label: "Planned admissions", value: plannedAdmissions, icon: CalendarClock, href: "/lab/admissions" },
    { label: "Open encounters", value: openEncounters, icon: LayoutDashboard, href: "/lab/his" },
  ];

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
          : kind === "PHARMACY"
            ? [
                { label: "Orders to review", value: ordersToReview, icon: ClipboardList, href: "/lab/pharmacy" },
                { label: "Dispensed today", value: dispensedToday, icon: Activity, href: "/lab/pharmacy" },
                { label: "Active formulary entries", value: activeFormulary, icon: FileText, href: "/lab/pharmacy" },
                { label: "Orders in progress", value: inProgress, icon: SearchCheck, href: "/lab/pharmacy" },
              ]
            : [];

  const completeness = facilityCompleteness({
    logoUrl: profile.logoUrl,
    about: profile.about,
    operatingHours: profile.operatingHours,
    addressLine: profile.addressLine,
    city: profile.city,
    serviceCount: activeServices,
    isPublished: profile.isPublished,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facility Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operations, patients and departments at a glance</p>
      </div>
      <ProfileCompletenessCard completeness={completeness} title="Complete your public page" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {/* Organization overview — facility headcount and patient population. */}
      <h2 className="text-lg font-semibold">Organization</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {organizationStats.map((s) => (
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

      {kind === "HOSPITAL" && (
        <>
          <h2 className="text-lg font-semibold">Hospital operations</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {hospitalOperationsStats.map((s) => (
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

          {/* Department activity — the last 7 days of encounters per department. */}
          {departments.length > 0 && (
            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="text-lg">Department activity (7 days)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {departments.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-muted-foreground">{d.count} encounters</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {moduleStats.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">
            {kind === "HOSPITAL"
              ? "Hospital"
              : kind === "LABORATORY"
                ? "Laboratory"
                : kind === "PHARMACY"
                  ? "Pharmacy"
                  : "Diagnostic centre"}{" "}
            module
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
