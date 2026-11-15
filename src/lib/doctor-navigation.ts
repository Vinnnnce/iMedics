import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  MessageSquare,
  FlaskConical,
  Briefcase,
  Clock,
  DollarSign,
  CreditCard,
  BarChart3,
  User,
  Award,
  Star,
  Sparkles,
  Upload,
  Building2,
  Settings,
  HelpCircle,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
}

export interface NavSection {
  label: string;
  description?: string;
  items: NavItem[];
}

export const DOCTOR_NAVIGATION: Record<string, NavSection> = {
  practice: {
    label: "Practice Hub",
    description: "Overview and patient management",
    items: [
      { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Health at a glance" },
      { href: "/doctor/patients", label: "My Patients", icon: Users, description: "Patient directory" },
    ],
  },
  clinical: {
    label: "Clinical Work",
    description: "Core clinical activities",
    items: [
      { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList, description: "Write and manage consultations" },
      { href: "/doctor/booking-requests", label: "Appointments", icon: Calendar, description: "Booking requests and schedule" },
      { href: "/doctor/chat", label: "Messages", icon: MessageSquare, description: "Patient conversations", badge: "unread" },
      { href: "/doctor/lab-requests", label: "Lab Orders", icon: FlaskConical, description: "Lab results and alerts" },
    ],
  },
  management: {
    label: "Practice Management",
    description: "Business and operations",
    items: [
      { href: "/doctor/services", label: "Services", icon: Briefcase, description: "Manage your services" },
      { href: "/doctor/schedule", label: "Schedule", icon: Clock, description: "Availability and hours" },
      { href: "/doctor/fees", label: "Earnings", icon: DollarSign, description: "Revenue and payments" },
      { href: "/doctor/subscription", label: "Subscription", icon: CreditCard, description: "Plans and billing" },
      { href: "/doctor/analytics", label: "Analytics", icon: BarChart3, description: "Performance metrics" },
    ],
  },
  profile: {
    label: "Professional Profile",
    description: "Public presence and credentials",
    items: [
      { href: "/doctor/profile", label: "Profile", icon: User, description: "Personal information" },
      { href: "/doctor/portfolio", label: "Portfolio", icon: Briefcase, description: "Experience and education" },
      { href: "/doctor/reviews", label: "Reviews", icon: Star, description: "Patient feedback" },
      { href: "/doctor/credentials", label: "Credentials", icon: Award, description: "Licenses and verification" },
    ],
  },
  advanced: {
    label: "Advanced Features",
    description: "Additional tools",
    items: [
      { href: "/doctor/ai-tools", label: "AI Review", icon: Sparkles, description: "AI analysis tools" },
      { href: "/doctor/diagnostics", label: "Upload Media", icon: Upload, description: "Document upload" },
      { href: "/doctor/admit", label: "Care Roster", icon: Building2, description: "Patient admissions" },
    ],
  },
  account: {
    label: "Account",
    description: "Settings and support",
    items: [
      { href: "/doctor/profile", label: "Settings", icon: Settings, description: "Account preferences" },
      { href: "/payments", label: "Payments", icon: Wallet, description: "Payment methods" },
      { href: "/help", label: "Help & Support", icon: HelpCircle, description: "Documentation" },
    ],
  },
};

export function getDoctorNavSections(): NavSection[] {
  return Object.values(DOCTOR_NAVIGATION);
}

export function getAllDoctorNavItems(): NavItem[] {
  return Object.values(DOCTOR_NAVIGATION).flatMap((section) => section.items);
}
