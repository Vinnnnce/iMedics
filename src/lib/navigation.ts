import {
  Briefcase, Building2, Calendar, ClipboardList, FileText, FlaskConical, FolderOpen, Heart, Home,
  IdCard, LayoutDashboard, MessageSquare, Receipt, Shield, Sparkles, Stethoscope,
  Tags, Upload, User, Users, Video, Wallet, type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_POLICY } from "./roles";

export interface NavItem { href: string; label: string; icon: LucideIcon }
const profile: NavItem = { href: "/profile", label: "Profile", icon: User };
export const ROLE_NAVIGATION: Record<Role, readonly NavItem[]> = {
  PATIENT: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/doctors", label: "Find Doctors", icon: Stethoscope },
    { href: "/patient/appointments", label: "Appointments", icon: Calendar },
    { href: "/facilities", label: "Labs & Services", icon: Building2 },
    { href: "/payments", label: "Payments", icon: Receipt },
    { href: "/patient/results", label: "Lab Results", icon: FlaskConical },
    { href: "/patient/case-file", label: "Case File", icon: FileText },
    { href: "/patient/history", label: "Case History", icon: ClipboardList },
    { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText },
    { href: "/patient/consult", label: "Consultation", icon: Video }, profile,
  ],
  DOCTOR: [
    { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/doctor/patients", label: "My Patients", icon: Users },
    { href: "/doctor/booking-requests", label: "Booking Requests", icon: Calendar },
    { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList },
    { href: "/doctor/chat", label: "Chat", icon: MessageSquare },
    { href: "/doctor/lab-requests", label: "Lab Requests", icon: FlaskConical },
    { href: "/doctor/diagnostics", label: "Clinical Notes", icon: Heart },
    { href: "/doctor/ai-tools", label: "AI Review", icon: Sparkles },
    { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
    { href: "/doctor/fees", label: "Fees", icon: Tags },
    { href: "/doctor/services", label: "Services", icon: Briefcase },
    { href: "/doctor/portfolio", label: "Portfolio", icon: FolderOpen },
    { href: "/doctor/profile", label: "My Profile", icon: IdCard },
    { href: "/payments", label: "Payments", icon: Wallet },
    { href: "/doctor/admit", label: "Care Roster", icon: Building2 }, profile,
  ],
  LAB_SCIENTIST: [
    { href: "/lab/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList },
    { href: "/lab/users", label: "Patient Lookup", icon: Users },
    { href: "/lab/upload", label: "Upload Results", icon: Upload },
    { href: "/lab/services", label: "Services & Prices", icon: Tags },
    { href: "/lab/bookings", label: "Bookings", icon: Calendar },
    { href: "/payments", label: "Payments", icon: Wallet }, profile,
  ],
  ADMIN: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin", label: "Admin Panel", icon: Shield },
    { href: "/workspace", label: "Operations", icon: ClipboardList }, profile,
  ],
};
export function getRoleNavigation(role: Role | null | undefined): readonly NavItem[] {
  return role ? ROLE_NAVIGATION[role] : [];
}
export function getBottomNavigation(role: Role | null | undefined): readonly NavItem[] {
  if (!role) return [];
  const home = { href: ROLE_POLICY[role].dashboard, label: "Home", icon: Home };
  switch (role) {
    case "PATIENT": return [home, ROLE_NAVIGATION.PATIENT[1], { href: "/patient/results", label: "Labs", icon: FlaskConical }, { href: "/patient/case-file", label: "Diag", icon: Heart }];
    case "DOCTOR": return [home, { href: "/doctor/patients", label: "Patients", icon: Users }, { href: "/doctor/diagnostics", label: "Diag", icon: Heart }];
    case "LAB_SCIENTIST": return [home, { href: "/lab/orders", label: "Orders", icon: ClipboardList }, { href: "/lab/users", label: "Users", icon: Users }];
    case "ADMIN": return [home, { href: "/admin", label: "Admin", icon: Shield }, profile];
  }
}
