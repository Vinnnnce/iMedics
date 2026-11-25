/**
 * Who may see which analytics, and over what slice of the facility.
 *
 * Authorisation is decided here on the server, for pages and API routes alike. Hiding a menu entry
 * is presentation only.
 *
 *  - Facility isolation: every query is keyed by `facilityId`, taken from a verified membership
 *    (never from the request body) and, when row-level security is on, enforced again by Postgres.
 *  - Permission: aggregate dashboards need VIEW_ANALYTICS; financial figures also need VIEW_REVENUE
 *    (insurance claims: MANAGE_INSURANCE).
 *  - Organisation kind: a laboratory sees laboratory analytics, a pharmacy pharmacy analytics, and
 *    so on, mirroring the module access matrix.
 *  - Department scope: staff whose access level is DEPARTMENT (or a department head with assigned
 *    departments) see only dashboards that can be filtered to those departments, filtered to them.
 *  - LIMITED staff have no aggregate analytics at all; they may open their own performance page.
 *  - Patient-level drill-downs are a separate, stricter check (see canIdentifyPatients).
 */
import type { LabStaffProfile, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import type { FacilityPermission } from "@/lib/facility-staff";
import { resolveFacilityKind, type FacilityKindValue } from "@/lib/modules/access-matrix";
import { DEFAULT_CALENDAR, type CalendarSettings } from "./periods";
import type { DashboardKey } from "./types";

export interface DashboardRule {
  key: DashboardKey;
  label: string;
  description: string;
  kinds: readonly FacilityKindValue[];
  /** Extra permission needed besides VIEW_ANALYTICS. */
  requires?: FacilityPermission;
  /** Can be restricted to a department scope. */
  departmentScoped: boolean;
}

const ALL: readonly FacilityKindValue[] = ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"];

export const DASHBOARD_RULES: Record<DashboardKey, DashboardRule> = {
  overview: { key: "overview", label: "Overview", description: "Executive summary of organisational performance", kinds: ALL, departmentScoped: false },
  "command-centre": { key: "command-centre", label: "Command centre", description: "Live beds, emergency, pending discharges and alerts", kinds: ["HOSPITAL"], departmentScoped: true },
  hospital: { key: "hospital", label: "Hospital operations", description: "Patient flow, admissions, discharges, transfers and beds", kinds: ["HOSPITAL"], departmentScoped: true },
  emergency: { key: "emergency", label: "Emergency department", description: "Arrivals, triage, waiting and flow", kinds: ["HOSPITAL"], departmentScoped: true },
  mortality: { key: "mortality", label: "Mortality & outcomes", description: "Mortality, readmissions and outcome indicators with explicit denominators", kinds: ["HOSPITAL"], departmentScoped: true },
  nursing: { key: "nursing", label: "Nursing performance", description: "Tasks, observations, assessments, handovers and medication administration", kinds: ["HOSPITAL"], departmentScoped: true },
  doctors: { key: "doctors", label: "Clinical staff activity", description: "Workload and documentation by clinician, shown with context rather than ranked", kinds: ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"], departmentScoped: false },
  laboratory: { key: "laboratory", label: "Laboratory", description: "Workload, turnaround, rejection, quality control, equipment and reagents", kinds: ["LABORATORY", "HOSPITAL"], departmentScoped: false },
  diagnostic: { key: "diagnostic", label: "Diagnostic centre", description: "Examinations by modality, reporting turnaround and equipment", kinds: ["DIAGNOSTIC_CENTRE", "HOSPITAL"], departmentScoped: false },
  pharmacy: { key: "pharmacy", label: "Pharmacy", description: "Orders, dispensing, stock, expiry and procurement", kinds: ["PHARMACY", "HOSPITAL"], departmentScoped: false },
  departments: { key: "departments", label: "Departments", description: "Department performance management centre", kinds: ALL, departmentScoped: true },
  quality: { key: "quality", label: "Quality & safety", description: "Documentation, critical alerts, ratings and data-quality indicators", kinds: ALL, departmentScoped: false },
  financial: { key: "financial", label: "Financial", description: "Revenue, outstanding payments, refunds and claims", kinds: ALL, requires: "VIEW_REVENUE", departmentScoped: false },
  "my-performance": { key: "my-performance", label: "My performance", description: "Your own activity and workload", kinds: ALL, departmentScoped: false },
  forecast: { key: "forecast", label: "Forecasting", description: "Statistical predictions of demand and stock — recommendations, not facts", kinds: ALL, departmentScoped: false },
};

export interface AnalyticsScope {
  user: Pick<User, "id" | "role">;
  facility: Pick<LabStaffProfile, "id" | "laboratoryName">;
  facilityName: string;
  kind: FacilityKindValue;
  staffId: string | null;
  permissions: readonly FacilityPermission[];
  accessLevel: string;
  /** null = whole facility; otherwise only these department ids. */
  departmentIds: string[] | null;
  calendar: CalendarSettings;
  canViewFinancial: boolean;
  /** May see patient case numbers in drill-down lists. */
  canIdentifyPatients: boolean;
  /** Name of the department filter in words, for exports. */
  limitedToDepartments: boolean;
}

const hasPermission = (permissions: readonly FacilityPermission[], p: FacilityPermission) => permissions.includes(p);

export async function loadCalendar(facilityId: string): Promise<CalendarSettings> {
  const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId }, select: { timeZone: true, weekStartsOn: true, financialYearStartMonth: true } });
  return settings ? { timeZone: settings.timeZone || DEFAULT_CALENDAR.timeZone, weekStartsOn: settings.weekStartsOn, financialYearStartMonth: settings.financialYearStartMonth } : DEFAULT_CALENDAR;
}

/** Build the scope for an already-verified facility membership. */
export async function buildScope(input: {
  user: Pick<User, "id" | "role">;
  facility: LabStaffProfile;
  staffId: string | null;
  permissions: readonly FacilityPermission[];
}): Promise<AnalyticsScope> {
  const kind = await resolveFacilityKind(input.facility.id);
  if (!kind) throw forbidden("Your organization is not authorized to use analytics");
  const staff = input.staffId
    ? await prisma.facilityStaff.findUnique({ where: { id: input.staffId }, select: { accessLevel: true, departmentIds: true, facilityRole: true, facilityId: true } })
    : null;
  if (staff && staff.facilityId !== input.facility.id) throw forbidden("Membership does not belong to this facility");
  const accessLevel = staff?.accessLevel ?? "FULL";
  const departmentRestricted = accessLevel === "DEPARTMENT" || (staff?.facilityRole === "DEPARTMENT_HEAD" && (staff.departmentIds?.length ?? 0) > 0);
  const departmentIds = departmentRestricted ? [...(staff?.departmentIds ?? [])] : null;
  const patientLevelAccess = !["LIMITED", "DEPARTMENT", "NONE"].includes(accessLevel) && hasPermission(input.permissions, "VIEW_PATIENT_DOCUMENTS");
  return {
    user: input.user,
    facility: input.facility,
    facilityName: input.facility.laboratoryName ?? "Facility",
    kind,
    staffId: input.staffId,
    permissions: input.permissions,
    accessLevel,
    departmentIds,
    calendar: await loadCalendar(input.facility.id),
    canViewFinancial: hasPermission(input.permissions, "VIEW_REVENUE"),
    canIdentifyPatients: patientLevelAccess,
    limitedToDepartments: departmentIds !== null,
  };
}

/** Throws unless the scope may open this dashboard. Pure, so it is unit-testable. */
export function assertDashboardAllowed(scope: Pick<AnalyticsScope, "kind" | "permissions" | "accessLevel" | "departmentIds">, dashboard: DashboardKey): DashboardRule {
  const rule = DASHBOARD_RULES[dashboard];
  if (!rule) throw forbidden("Unknown dashboard");
  if (!hasPermission(scope.permissions, "VIEW_ANALYTICS")) throw forbidden("Your role does not allow viewing analytics");
  if (scope.accessLevel === "LIMITED" || scope.accessLevel === "NONE") throw forbidden("Your access level does not include organisation analytics");
  if (!rule.kinds.includes(scope.kind)) throw forbidden("This dashboard is not available for your type of organization");
  if (rule.requires && !hasPermission(scope.permissions, rule.requires)) throw forbidden("Your role does not allow this analytics view");
  if (scope.departmentIds !== null && !rule.departmentScoped) throw forbidden("This dashboard covers the whole facility and is not available with department-limited access");
  return rule;
}

/** The dashboards a scope may open, for building navigation. */
export function dashboardsFor(scope: Pick<AnalyticsScope, "kind" | "permissions" | "accessLevel" | "departmentIds">): DashboardRule[] {
  return (Object.keys(DASHBOARD_RULES) as DashboardKey[]).flatMap((key) => {
    try { return [assertDashboardAllowed(scope, key)]; } catch { return []; }
  });
}

/** Department filter helpers: the wards and department names a department-limited user may see. */
export async function departmentFilter(scope: Pick<AnalyticsScope, "departmentIds" | "facility">): Promise<{ wardIds: string[]; wardNames: string[]; departmentNames: string[] } | null> {
  if (scope.departmentIds === null) return null;
  const [wards, departments] = await Promise.all([
    prisma.ward.findMany({ where: { facilityId: scope.facility.id, departmentId: { in: scope.departmentIds } }, select: { id: true, name: true } }),
    prisma.facilityDepartment.findMany({ where: { facilityId: scope.facility.id, id: { in: scope.departmentIds } }, select: { name: true } }),
  ]);
  return { wardIds: wards.map((w) => w.id), wardNames: wards.map((w) => w.name), departmentNames: departments.map((d) => d.name) };
}
