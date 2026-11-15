import {
  Activity,
  BarChart3, BedDouble, Bell, Briefcase, Building2, Calendar, CalendarClock, ClipboardList, CreditCard, FileText,
  FlaskConical, FolderOpen, Home, IdCard, LayoutDashboard, MessageSquare, Pill, Receipt, Settings,
  Shield, Siren, Sparkles, Star, Stethoscope, Syringe, Tags, UserCog, Upload, User, Users, Wallet, Globe, type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_POLICY } from "./roles";

export interface NavItem { href: string; label: string; icon: LucideIcon }
const profile: NavItem = { href: "/profile", label: "Profile", icon: User };
const settings: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export const PATIENT_ACCOUNT_NAVIGATION: readonly NavItem[] = [
  profile,
  { href: "/settings", label: "Settings & privacy", icon: Settings },
  { href: "/payments", label: "Payments", icon: Receipt },
];

export const PATIENT_HEALTH_LINKS: readonly NavItem[] = [
  { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/cases", label: "Care episodes", icon: FolderOpen },
  { href: "/patient/history", label: "Health history", icon: ClipboardList },
  { href: "/patient/results", label: "Test results", icon: FlaskConical },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/patient/reminders", label: "Medication reminders", icon: Bell },
  { href: "/patient/documents", label: "Documents", icon: FileText },
  { href: "/patient/safety", label: "Medical alerts", icon: Shield },
  { href: "/patient/case-reports?tab=documents", label: "Hospital documents", icon: FileText },
  { href: "/patient/case-reports", label: "Case reports", icon: FileText },
];

/**
 * Role-aware primary navigation. Every entry must resolve to a real route
 * (enforced by navigation.test.ts); less frequent patient links live in My Health
 * or PATIENT_ACCOUNT_NAVIGATION.
 */
export const ROLE_NAVIGATION: Record<Role, readonly NavItem[]> = {
  PATIENT: [
    { href: "/patient/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/patient/appointments", label: "Appointments", icon: Calendar },
    { href: "/patient/prescriptions", label: "Medications", icon: Pill },
    { href: "/patient/results", label: "Results", icon: FlaskConical },
    { href: "/patient/documents", label: "Documents", icon: FileText },
    { href: "/patient/consult", label: "Messages", icon: MessageSquare },
  ],
  DOCTOR: [
    { href: "/doctor/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/doctor/booking-requests", label: "Appointments", icon: Calendar },
    { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList },
    { href: "/doctor/patients", label: "My Patients", icon: Users },
    { href: "/doctor/lab-requests", label: "Results & Reports", icon: FlaskConical },
    { href: "/doctor/chat", label: "Messages", icon: MessageSquare },
    { href: "/doctor/schedule", label: "Schedule", icon: CalendarClock },
    { href: "/doctor/subscription", label: "Subscription", icon: CreditCard },
    { href: "/doctor/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/doctor/ai-tools", label: "AI Review", icon: Sparkles },
    { href: "/doctor/services", label: "Services", icon: Briefcase },
    { href: "/doctor/fees", label: "Fees", icon: Tags },
    { href: "/doctor/portfolio", label: "Portfolio", icon: FolderOpen },
    { href: "/doctor/admit", label: "Care Roster", icon: Building2 },
    { href: "/doctor/profile", label: "My Profile", icon: IdCard },
    { href: "/payments", label: "Payments & Earnings", icon: Wallet },
    settings,
  ],
  LAB_SCIENTIST: [
    { href: "/lab/dashboard", label: "Home", icon: LayoutDashboard },
    // Hospital / laboratory / diagnostic modules — each page enforces the
    // facility kind server-side and redirects organizations that do not
    // belong to that module.
    { href: "/lab/his", label: "Hospital System", icon: Building2 },
    { href: "/lab/clinical-documents", label: "Medical Documents", icon: FileText },
    { href: "/lab/encounters", label: "Encounters & Queues", icon: Activity },
    { href: "/lab/media", label: "Diagnostic Media", icon: Upload },
    { href: "/lab/insurance", label: "Payer Classification", icon: Wallet },
    { href: "/lab/admissions", label: "Admissions", icon: BedDouble },
    { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList },
    { href: "/lab/specimens", label: "Specimens", icon: FlaskConical },
    { href: "/lab/examinations", label: "Examinations", icon: FileText },
    { href: "/lab/investigations", label: "Investigations", icon: Stethoscope },
    { href: "/lab/critical-alerts", label: "Critical Alerts", icon: Bell },
    { href: "/lab/bookings", label: "Appointments", icon: Calendar },
    { href: "/lab/upload", label: "Upload Results", icon: Upload },
    { href: "/lab/case-reports", label: "Case Reports", icon: FolderOpen },
    { href: "/lab/reviews", label: "Reviews", icon: Star },
    { href: "/lab/emergency", label: "Emergency", icon: Siren },
    { href: "/lab/wards", label: "Wards & Beds", icon: BedDouble },
    { href: "/lab/nursing", label: "Nursing", icon: Syringe },
    { href: "/lab/pharmacy", label: "Pharmacy", icon: Pill },
    { href: "/lab/lab-equipment", label: "Equipment & QC", icon: FlaskConical },
    { href: "/lab/registration", label: "Registration", icon: ClipboardList },
    { href: "/lab/referrals", label: "Referrals", icon: FolderOpen },
    { href: "/lab/services", label: "Service Catalogue", icon: Tags },
    { href: "/lab/users", label: "Patient Lookup", icon: Users },
    { href: "/lab/document-templates", label: "Document Templates", icon: FileText },
    { href: "/lab/staff", label: "Staff", icon: Users },
    { href: "/lab/organization", label: "Organization", icon: UserCog },
    { href: "/lab/website", label: "Public Website", icon: Globe },
    { href: "/lab/subscription", label: "Subscription", icon: Wallet },
    { href: "/payments", label: "Payments & Earnings", icon: Wallet },
    settings,
    profile,
  ],
  ADMIN: [
    { href: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/admin", label: "Admin Panel", icon: Shield },
    { href: "/workspace", label: "Operations", icon: ClipboardList },
    settings,
    profile,
  ],
};
export function getRoleNavigation(role: Role | null | undefined): readonly NavItem[] {
  return role ? ROLE_NAVIGATION[role] : [];
}
export function getBottomNavigation(role: Role | null | undefined): readonly NavItem[] {
  if (!role) return [];
  const home = { href: ROLE_POLICY[role].dashboard, label: "Home", icon: Home };
  switch (role) {
    case "PATIENT": return [
      { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/patient/appointments", label: "Appointments", icon: Calendar },
      { href: "/patient/prescriptions", label: "Medications", icon: Pill },
      { href: "/patient/consult", label: "Messages", icon: MessageSquare },
    ];
    case "DOCTOR": return [home, { href: "/doctor/patients", label: "Patients", icon: Users }, { href: "/doctor/consultations", label: "Notes", icon: ClipboardList }, { href: "/doctor/chat", label: "Messages", icon: MessageSquare }];
    case "LAB_SCIENTIST": return [home, { href: "/lab/orders", label: "Orders", icon: ClipboardList }, { href: "/lab/bookings", label: "Bookings", icon: Calendar }, { href: "/lab/services", label: "Services", icon: Tags }];
    case "ADMIN": return [home, { href: "/admin", label: "Admin", icon: Shield }, { href: "/workspace", label: "Ops", icon: ClipboardList }, profile];
  }
}