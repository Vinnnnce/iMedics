"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Users,
  Calendar,
  FlaskConical,
  Sparkles,
  LayoutDashboard,
  FileText,
  Stethoscope,
  User,
  Settings,
  Heart,
  MessageSquare,
  Video,
  ClipboardList,
  Upload,
  Building2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  roles: string[];
};

const NAV_ITEMS: NavItem[] = [
  // Patient items
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["PATIENT"] },
  { href: "/patient/results", label: "Analysis Results", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/patient/diagnostics", label: "Diagnostics", icon: Heart, roles: ["PATIENT"] },
  { href: "/patient/case-file", label: "Case File", icon: FileText, roles: ["PATIENT"] },
  { href: "/patient/history", label: "Case History", icon: ClipboardList, roles: ["PATIENT"] },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText, roles: ["PATIENT"] },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar, roles: ["PATIENT"] },
  { href: "/patient/consult", label: "Consultation", icon: Video, roles: ["PATIENT"] },

  // Doctor items
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["DOCTOR"] },
  { href: "/doctor/booking-requests", label: "Booking Requests", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/patients", label: "My Patients", icon: Users, roles: ["DOCTOR"] },
  { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList, roles: ["DOCTOR"] },
  { href: "/doctor/chat", label: "Chat", icon: MessageSquare, roles: ["DOCTOR"] },
  { href: "/doctor/lab-requests", label: "Lab Requests", icon: FlaskConical, roles: ["DOCTOR"] },
  { href: "/doctor/diagnostics", label: "Diagnostics", icon: Heart, roles: ["DOCTOR"] },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/ai-tools", label: "AI Tools", icon: Sparkles, roles: ["DOCTOR"] },
  { href: "/doctor/admit", label: "Admit/Discharge", icon: Building2, roles: ["DOCTOR"] },

  // Lab items
  { href: "/lab/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/users", label: "User Directory", icon: Users, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/upload", label: "Upload Results", icon: Upload, roles: ["LAB_SCIENTIST"] },

  // Shared
  { href: "/profile", label: "Profile", icon: User, roles: ["PATIENT", "DOCTOR", "LAB_SCIENTIST"] },
  { href: "/profile", label: "Settings", icon: Settings, roles: ["PATIENT", "DOCTOR", "LAB_SCIENTIST"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const role = ((user?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary neon-glow">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v20M2 12h20" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-base font-bold text-primary neon-text">Medic1905</span>
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary neon-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Medic1905 is a platform only, not a medical provider. AI content is informational.
        </p>
      </div>
    </aside>
  );
}
