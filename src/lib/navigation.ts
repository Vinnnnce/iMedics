import {
  Activity,
  BarChart3, BedDouble, Bell, Briefcase, Building2, Calendar, CalendarClock, ClipboardList, CreditCard, FileText,
  FlaskConical, FolderOpen, Home, IdCard, LayoutDashboard, MessageSquare, Pill, Receipt, Settings,
  Shield, Sparkles, Star, Stethoscope, Tags, Upload, User, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_POLICY } from "./roles";

export interface NavItem { href: string; label: string; icon: LucideIcon }
const profile: NavItem = { href: "/profile", label: "Profile", icon: User };
const settings: NavItem = { href: "/settings", label: "Settings", icon: Settings };
/**
 * Role-aware navigation. Every entry must resolve to a real route (enforced by
 * navigation.test.ts). The visible set follows the platform navigation matrix:
 * Home, Appointments, Consultations, Records/Cases, Results & reports, Messages,
 * Payments & earnings, Find care, Subscription, Analytics and Settings per role.
 */
export const ROLE_NAVIGATION: Record<Role, readonly NavItem[]> = {
  PATIENT: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/doctors", label: "Find Care", icon: Stethoscope },
    { href: "/patient/appointments", label: "Appointments", icon: Calendar },
    { href: "/patient/consult", label: "Messages", icon: MessageSquare },
    { href: "/patient/results", label: "Results & Reports", icon: FlaskConical },
    { href: "/patient/documents", label: "Hospital Documents", icon: FileText },
    { href: "/patient/case-file", label: "Health Record", icon: FileText },
    { href: "/patient/cases", label: "My Cases", icon: FolderOpen },
    { href: "/patient/history", label: "Case History", icon: ClipboardList },
    { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
    { href: "/facilities", label: "Labs & Diagnostics", icon: Building2 },
    { href: "/payments", label: "Payments", icon: Receipt },
    { href: "/notifications", label: "Notifications", icon: Bell },
    settings,
    profile,
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
    { href: "/lab/document-templates", label: "Document Templates", icon: FileText },
    { href: "/lab/reviews", label: "Reviews", icon: Star },
    { href: "/lab/services", label: "Service Catalogue", icon: Tags },
    { href: "/lab/users", label: "Patient Lookup", icon: Users },
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
    case "PATIENT": return [home, { href: "/doctors", label: "Find Care", icon: Stethoscope }, { href: "/facilities", label: "Labs", icon: Building2 }, { href: "/patient/results", label: "Results", icon: FlaskConical }, { href: "/patient/case-file", label: "Diag", icon: FileText }];
    case "DOCTOR": return [home, { href: "/doctor/patients", label: "Patients", icon: Users }, { href: "/doctor/consultations", label: "Notes", icon: ClipboardList }, { href: "/doctor/chat", label: "Messages", icon: MessageSquare }];
    case "LAB_SCIENTIST": return [home, { href: "/lab/orders", label: "Orders", icon: ClipboardList }, { href: "/lab/bookings", label: "Bookings", icon: Calendar }, { href: "/lab/services", label: "Services", icon: Tags }];
    case "ADMIN": return [home, { href: "/admin", label: "Admin", icon: Shield }, { href: "/workspace", label: "Ops", icon: ClipboardList }, profile];
  }
}