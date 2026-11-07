
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/components/theme-provider";
import {
  optionalProcessingAllowed,
  COOKIE_CONSENT_EVENT,
} from "@/lib/cookie-consent";
import { navigationFeatureEnabled } from "@/lib/navigation-features";
import { moduleForPath } from "@/lib/platform/policy";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Footer } from "@/components/layout/footer";
import { ADMIN_LINKS } from "@/components/admin/admin-links";
import { NotificationCenter } from "@/components/shared/notification-center";
import { WebsiteTour } from "@/components/onboarding/website-tour";
import { SignOutButton } from "@/components/shared/sign-out-button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Sun,
  Moon,
  Menu,
  X,
  Home,
  Stethoscope,
  Users,
  FlaskConical,
  Heart,
  Sparkles,
  User,
  Globe,
  HeartPulse,
  Calendar,
  FileText,
  Video,
  MessageSquare,
  Building2,
  ClipboardList,
  Upload,
  LayoutDashboard,
  ArrowRight,
  Receipt,
  Wallet,
  Tags,
  PanelLeftClose,
  FolderOpen,
  BellRing,
  ShieldCheck,
  Settings,
  BedDouble,
  SearchCheck,
  Bell,
  Star,
  Briefcase,
  Pill,
  BarChart3,
  Activity,
  IdCard,
  CreditCard,
  type LucideIcon,
  Siren,
} from "lucide-react";
import type { Me, MeFacility } from "@/lib/use-me";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  permission?: string;
};

type NavSection = {
  label: string | null;
  items: NavItem[];
  kinds?: MeFacility["kind"][];
};

type SearchResult = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  category: string;
};

/* -------------------------------------------------------------------------- */
/* PATIENT NAVIGATION                                                         */
/* -------------------------------------------------------------------------- */

const PATIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["PATIENT"] },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar, roles: ["PATIENT"] },
  { href: "/facilities", label: "Labs & Services", icon: Building2, roles: ["PATIENT"] },
  { href: "/payments", label: "Payments", icon: Receipt, roles: ["PATIENT"] },
  { href: "/patient/results", label: "Lab Results", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/patient/case-file", label: "Case File", icon: FileText, roles: ["PATIENT"] },
  { href: "/patient/case-reports", label: "Case Reports", icon: ClipboardList, roles: ["PATIENT"] },
  { href: "/patient/history", label: "Case History", icon: ClipboardList, roles: ["PATIENT"] },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText, roles: ["PATIENT"] },
  { href: "/patient/records", label: "My Records", icon: FolderOpen, roles: ["PATIENT"] },
  { href: "/patient/reminders", label: "Med Reminders", icon: BellRing, roles: ["PATIENT"] },
  { href: "/patient/safety", label: "Wellbeing", icon: ShieldCheck, roles: ["PATIENT"] },
  { href: "/patient/consult", label: "Consultation", icon: Video, roles: ["PATIENT"] },
  { href: "/emergency", label: "Emergency", icon: HeartPulse, roles: ["PATIENT"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["PATIENT"] },
  { href: "/profile", label: "Profile", icon: User, roles: ["PATIENT"] },
];

/* -------------------------------------------------------------------------- */
/* DOCTOR NAVIGATION                                                          */
/* -------------------------------------------------------------------------- */

const DOCTOR_SECTIONS: NavSection[] = [
  {
    label: "Doctor Dashboard",
    items: [
      { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["DOCTOR"] },
      { href: "/doctor/patients", label: "My Patients", icon: Users, roles: ["DOCTOR"] },
      { href: "/doctor/booking-requests", label: "Appointments", icon: Calendar, roles: ["DOCTOR"] },
      { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList, roles: ["DOCTOR"] },
      { href: "/doctor/chat", label: "Messages", icon: MessageSquare, roles: ["DOCTOR"] },
      { href: "/doctor/lab-requests", label: "Lab Requests", icon: FlaskConical, roles: ["DOCTOR"] },
      { href: "/doctor/diagnostics", label: "Clinical Notes", icon: Heart, roles: ["DOCTOR"] },
      { href: "/doctor/prescriptions", label: "Prescriptions", icon: FileText, roles: ["DOCTOR"] },
      { href: "/doctor/case-reports", label: "Case Reports", icon: FolderOpen, roles: ["DOCTOR"] },
      { href: "/doctor/schedule", label: "Schedule", icon: Calendar, roles: ["DOCTOR"] },
      { href: "/doctor/admit", label: "Care Roster", icon: Building2, roles: ["DOCTOR"] },
      { href: "/doctor/fees", label: "Fees", icon: Tags, roles: ["DOCTOR"] },
      { href: "/doctor/services", label: "Services", icon: Briefcase, roles: ["DOCTOR"] },
      { href: "/doctor/portfolio", label: "Portfolio", icon: FolderOpen, roles: ["DOCTOR"] },
      { href: "/doctor/analytics", label: "Analytics", icon: BarChart3, roles: ["DOCTOR"] },
      { href: "/doctor/subscription", label: "Subscription", icon: CreditCard, roles: ["DOCTOR"] },
      { href: "/payments", label: "Payments & Earnings", icon: Wallet, roles: ["DOCTOR"] },
      { href: "/emergency", label: "Emergency", icon: HeartPulse, roles: ["DOCTOR"] },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { href: "/doctor/ai-tools", label: "AI Review", icon: Sparkles, roles: ["DOCTOR"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, roles: ["DOCTOR"] },
      { href: "/doctor/profile", label: "My Profile", icon: User, roles: ["DOCTOR"] },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* FACILITY NAVIGATION                                                        */
/* -------------------------------------------------------------------------- */

const FACILITY_DASHBOARD_ITEM: NavItem = {
  href: "/lab/dashboard",
  label: "Facility Dashboard",
  icon: LayoutDashboard,
  roles: ["FACILITY"],
};

const FACILITY_WEBSITE_ITEM: NavItem = {
  href: "/lab/website",
  label: "Our Website",
  icon: Globe,
  roles: ["FACILITY"],
  permission: "MANAGE_PROFILE",
};

const FACILITY_SECTIONS: NavSection[] = [
  {
    label: "Organisation",
    items: [
      { href: "/lab/organization", label: "Workforce & Departments", icon: Users, roles: ["FACILITY"], permission: "MANAGE_STAFF" },
    ],
  },
  {
    label: "Facility Dashboard",
    items: [FACILITY_DASHBOARD_ITEM],
  },
  {
    label: "Facility Services",
    items: [
      { href: "/lab/services", label: "Services & Prices", icon: Tags, roles: ["FACILITY"], permission: "MANAGE_SERVICES" },
      { href: "/lab/bookings", label: "Service Bookings", icon: Calendar, roles: ["FACILITY"], permission: "MANAGE_BOOKINGS" },
      { href: "/lab/reviews", label: "Reviews", icon: Star, roles: ["FACILITY"], permission: "MANAGE_PROFILE" },
      FACILITY_WEBSITE_ITEM,
    ],
  },
  {
    label: "Laboratory",
    kinds: ["HOSPITAL", "LABORATORY"],
    items: [
      { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList, roles: ["FACILITY"], permission: "PROCESS_ORDERS" },
      { href: "/lab/specimens", label: "Specimens", icon: FlaskConical, roles: ["FACILITY"], permission: "PROCESS_ORDERS" },
      { href: "/lab/upload", label: "Upload Results", icon: Upload, roles: ["FACILITY"], permission: "ENTER_RESULTS" },
      { href: "/lab/lab-equipment", label: "Lab Equipment & QC", icon: FlaskConical, roles: ["FACILITY"], permission: "ENTER_RESULTS" },
    ],
  },
  {
    label: "Pharmacy",
    kinds: ["HOSPITAL", "PHARMACY"],
    items: [
      { href: "/lab/pharmacy", label: "Medication Orders", icon: Pill, roles: ["FACILITY"], permission: "REVIEW_MEDICATIONS" },
    ],
  },
  {
    label: "Diagnostic Centre",
    kinds: ["HOSPITAL", "DIAGNOSTIC_CENTRE"],
    items: [
      { href: "/lab/examinations", label: "Examinations", icon: FileText, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/media", label: "Diagnostic Media", icon: Upload, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
    ],
  },
  {
    label: "Clinical Operations",
    kinds: ["HOSPITAL"],
    items: [
      { href: "/lab/registration", label: "Registration & Admission", icon: ClipboardList, roles: ["FACILITY"], permission: "MANAGE_ENCOUNTERS" },
      { href: "/lab/emergency", label: "Emergency Department", icon: Siren, roles: ["FACILITY"], permission: "MANAGE_ENCOUNTERS" },
      { href: "/lab/encounters", label: "Encounters & Queues", icon: Activity, roles: ["FACILITY"], permission: "MANAGE_ENCOUNTERS" },
      { href: "/lab/admissions", label: "Admissions", icon: BedDouble, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/wards", label: "Wards & Beds", icon: BedDouble, roles: ["FACILITY"], permission: "MANAGE_ENCOUNTERS" },
      { href: "/lab/investigations", label: "Investigations", icon: SearchCheck, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/critical-alerts", label: "Critical Alerts", icon: Bell, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
    ],
  },
  {
    label: "Medical Documents",
    items: [
      { href: "/lab/clinical-documents", label: "Clinical Documents", icon: FileText, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/document-templates", label: "Document Templates", icon: FileText, roles: ["FACILITY"], permission: "MANAGE_DOCUMENT_TEMPLATES" },
      { href: "/lab/case-reports", label: "Case Reports", icon: FolderOpen, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/referrals", label: "Referrals", icon: Briefcase, roles: ["FACILITY"], permission: "MANAGE_REFERRALS" },
    ],
  },
  {
    label: "Our Patients",
    items: [
      { href: "/lab/users", label: "Patient Lookup", icon: Users, roles: ["FACILITY"], permission: "REGISTER_PATIENTS" },
    ],
  },
  {
    label: "Our Nurses",
    kinds: ["HOSPITAL"],
    items: [
      { href: "/lab/nursing", label: "Nursing", icon: HeartPulse, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
    ],
  },
  {
    label: "Our Staff",
    items: [
      { href: "/lab/staff", label: "Staff Management", icon: Users, roles: ["FACILITY"], permission: "MANAGE_STAFF" },
      { href: "/lab/credentials", label: "Staff Credentials", icon: ShieldCheck, roles: ["FACILITY"], permission: "MANAGE_CREDENTIALS" },
    ],
  },
  {
    label: "Administration",
    kinds: ["HOSPITAL"],
    items: [
      { href: "/lab/his", label: "Hospital System", icon: Building2, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
      { href: "/lab/hospital-settings", label: "Hospital Settings", icon: Settings, roles: ["FACILITY"], permission: "MANAGE_HOSPITAL_SETTINGS" },
      { href: "/lab/his-analytics", label: "Analytics", icon: BarChart3, roles: ["FACILITY"], permission: "VIEW_ANALYTICS" },
      { href: "/lab/insurance", label: "Payer Classification", icon: Wallet, roles: ["FACILITY"], permission: "MANAGE_INSURANCE" },
    ],
  },
  {
    label: "Cashier & Billing",
    items: [
      { href: "/payments", label: "Payments & Earnings", icon: Wallet, roles: ["FACILITY"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/emergency", label: "Emergency", icon: HeartPulse, roles: ["FACILITY"] },
      { href: "/lab/me", label: "My Staff Profile", icon: IdCard, roles: ["FACILITY"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["FACILITY"] },
      { href: "/profile", label: "Profile", icon: User, roles: ["FACILITY"] },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* MOBILE NAVIGATION                                                          */
/* -------------------------------------------------------------------------- */

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, roles: ["PATIENT"] },
  { href: "/doctor/dashboard", label: "Home", icon: Home, roles: ["DOCTOR"] },
  { href: "/lab/dashboard", label: "Home", icon: Home, roles: ["LAB_SCIENTIST"] },
  { href: "/doctors", label: "Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/doctor/patients", label: "Patients", icon: Users, roles: ["DOCTOR"] },
  { href: "/lab/orders", label: "Orders", icon: ClipboardList, roles: ["LAB_SCIENTIST"] },
  { href: "/patient/results", label: "Labs", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/doctor/diagnostics", label: "Diag", icon: Heart, roles: ["DOCTOR"] },
  { href: "/lab/users", label: "Users", icon: Users, roles: ["LAB_SCIENTIST"] },
  { href: "/patient/case-file", label: "Case File", icon: FileText, roles: ["PATIENT"] },
];

/* -------------------------------------------------------------------------- */
/* SEARCH SUGGESTIONS                                                         */
/* -------------------------------------------------------------------------- */

const AI_SUGGESTIONS = [
  { text: "Find a cardiologist near me", icon: Stethoscope, category: "doctors" },
  { text: "View my latest lab results", icon: FlaskConical, category: "labs" },
  { text: "Book an appointment", icon: Calendar, category: "appointments" },
  { text: "Check my prescriptions", icon: FileText, category: "prescriptions" },
  { text: "Start a video consultation", icon: Video, category: "consultations" },
  { text: "View my case history", icon: ClipboardList, category: "history" },
];

const DOCTOR_AI_SUGGESTIONS = [
  { text: "Find patient by name or ID", icon: Users, category: "patients" },
  { text: "Review pending lab requests", icon: FlaskConical, category: "labs" },
  { text: "AI-assisted diagnostics", icon: Sparkles, category: "ai" },
  { text: "View today's schedule", icon: Calendar, category: "schedule" },
  { text: "Write consultation notes", icon: ClipboardList, category: "consultations" },
  { text: "AI case history analysis", icon: FileText, category: "ai" },
];

const ADMIN_SUGGESTIONS = [
  { text: "Manage administrative teams", icon: Users, category: "teams" },
  { text: "Manage roles and permissions", icon: ShieldCheck, category: "roles" },
  { text: "Review pending verifications", icon: ShieldCheck, category: "verification" },
  { text: "Manage healthcare facilities", icon: Building2, category: "facilities" },
  { text: "Review subscriptions and payments", icon: Receipt, category: "payments" },
  { text: "Manage clinical documents", icon: FileText, category: "documents" },
  { text: "Review security and audit logs", icon: ShieldCheck, category: "security" },
  { text: "Manage platform modules", icon: Settings, category: "modules" },
  { text: "View platform analytics", icon: BarChart3, category: "analytics" },
];

const FACILITY_SUGGESTIONS = [
  { text: "Open patient documents", icon: FolderOpen, category: "documents" },
  { text: "Manage document templates", icon: FileText, category: "templates" },
  { text: "View bookings", icon: Calendar, category: "bookings" },
  { text: "Reply to reviews", icon: Star, category: "reviews" },
];

/* -------------------------------------------------------------------------- */
/* SEARCH FILTERS                                                             */
/* -------------------------------------------------------------------------- */

type FilterChip = {
  label: string;
  value: string;
};

const PATIENT_CHIPS: FilterChip[] = [
  { label: "All", value: "all" },
  { label: "Doctors", value: "doctors" },
  { label: "Lab Results", value: "labs" },
  { label: "Appointments", value: "appointments" },
  { label: "Prescriptions", value: "prescriptions" },
];

const DOCTOR_CHIPS: FilterChip[] = [
  { label: "All", value: "all" },
  { label: "Patients", value: "patients" },
  { label: "Consultations", value: "consultations" },
  { label: "Prescriptions", value: "prescriptions" },
];

const FACILITY_CHIPS: FilterChip[] = [
  { label: "All", value: "all" },
  { label: "Patients", value: "patients" },
  { label: "Documents", value: "documents" },
  { label: "Bookings", value: "bookings" },
];

const ADMIN_CHIPS: FilterChip[] = [
  { label: "All", value: "all" },
  { label: "Users", value: "users" },
  { label: "Payments", value: "payments" },
  { label: "Verifications", value: "verification" },
];

/* -------------------------------------------------------------------------- */
/* SUPER ADMIN NAVIGATION                                                     */
/* -------------------------------------------------------------------------- */

// Only existing ADMIN_LINKS are used. This groups the existing destinations;
// it does not create or assume new admin routes.

const ADMIN_NAV: NavItem[] = [
  ...ADMIN_LINKS.map((link) => ({
    href: link.href,
    label: link.label,
    icon: link.icon,
    roles: ["ADMIN"],
  })),
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

function getAdminNavSections(items: NavItem[]): NavSection[] {
  const groups: { label: string; keywords: string[] }[] = [
    {
      label: "Platform Overview",
      keywords: ["dashboard", "overview", "home", "analytics"],
    },
    {
      label: "User & Team Management",
      keywords: ["user", "team", "staff", "doctor", "patient", "nurse", "member"],
    },
    {
      label: "Roles & Access Control",
      keywords: ["role", "permission", "access", "security", "admin"],
    },
    {
      label: "Healthcare Facilities",
      keywords: ["facility", "hospital", "laboratory", "diagnostic", "pharmacy", "department"],
    },
    {
      label: "Clinical Governance",
      keywords: ["clinical", "medical", "document", "template", "verification"],
    },
    {
      label: "Finance & Subscriptions",
      keywords: ["payment", "billing", "subscription", "revenue", "invoice", "plan"],
    },
    {
      label: "Platform Configuration",
      keywords: ["setting", "module", "feature", "integration", "api", "content", "notice", "advert"],
    },
  ];

  const assigned = new Set<string>();

  const sections: NavSection[] = groups.map((group) => {
    const matched = items.filter((item) => {
      if (assigned.has(item.href)) return false;

      const text = `${item.label} ${item.href}`.toLowerCase();
      const matches = group.keywords.some((keyword) => text.includes(keyword));

      if (matches) assigned.add(item.href);
      return matches;
    });

    return {
      label: group.label,
      items: matched,
    };
  }).filter((section) => section.items.length > 0);

  const remaining = items.filter((item) => !assigned.has(item.href));

  if (remaining.length > 0) {
    sections.push({
      label: "Other Administration",
      items: remaining,
    });
  }

  return sections;
}

const ADMIN_NAV_SECTIONS = getAdminNavSections(ADMIN_NAV);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function normalisePath(href: string) {
  return href.split("?")[0].replace(/\/+$/, "") || "/";
}

function getSearchCategory(href: string): string {
  const path = normalisePath(href).toLowerCase();

  if (path.includes("doctor")) return "doctors";
  if (path.includes("patient") || path.includes("users")) return "patients";
  if (path.includes("result") || path.includes("lab") || path.includes("specimen")) return "labs";
  if (path.includes("appointment") || path.includes("booking") || path.includes("schedule")) return "appointments";
  if (path.includes("prescription") || path.includes("pharmacy") || path.includes("medication")) return "prescriptions";
  if (path.includes("consult")) return "consultations";
  if (path.includes("history")) return "history";
  if (path.includes("document") || path.includes("case-report") || path.includes("template")) return "documents";
  if (path.includes("payment") || path.includes("billing") || path.includes("subscription")) return "payments";
  if (path.includes("verification")) return "verification";
  if (path.includes("team") || path.includes("staff")) return "teams";
  if (path.includes("role") || path.includes("permission")) return "roles";
  if (path.includes("facility") || path.includes("hospital") || path.includes("organization")) return "facilities";
  if (path.includes("security") || path.includes("audit")) return "security";
  if (path.includes("module") || path.includes("setting")) return "modules";
  if (path.includes("analytic")) return "analytics";
  if (path.includes("review")) return "reviews";

  return "other";
}

/* -------------------------------------------------------------------------- */
/* NAVBAR                                                                     */
/* -------------------------------------------------------------------------- */

export function Navbar({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const pathname = usePathname();
  const me = useMe();

  const navigationPrefetch = user ? undefined : false;

  const anonymousNavigation = (href: string) =>
    (event: { preventDefault: () => void }) => {
      if (!user) {
        event.preventDefault();
        window.location.assign(href);
      }
    };

  const role = me?.role ?? "PATIENT";
  const showNavChrome = Boolean(user);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const isFacilityUser =
    Boolean(me?.facility) &&
    (role === "PATIENT" || role === "LAB_SCIENTIST");

  /* ------------------------------------------------------------------------ */
  /* SIDEBAR PREFERENCE                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const restore = () => {
      try {
        if (optionalProcessingAllowed("preferences")) {
          setSidebarCollapsed(
            window.localStorage.getItem("medic1905.sidebar.collapsed") === "1"
          );
        }
      } catch {
        // Browser storage may be unavailable.
      }
    };

    void Promise.resolve().then(restore);

    window.addEventListener(COOKIE_CONSENT_EVENT, restore);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, restore);
    };
  }, []);

  const saveSidebarPreference = useCallback((collapsed: boolean) => {
    try {
      if (optionalProcessingAllowed("preferences")) {
        window.localStorage.setItem(
          "medic1905.sidebar.collapsed",
          collapsed ? "1" : "0"
        );
      }
    } catch {
      // Sidebar preference is optional.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      saveSidebarPreference(next);
      return next;
    });
  }, [saveSidebarPreference]);

  /* ------------------------------------------------------------------------ */
  /* PERMISSION-AWARE NAVIGATION                                              */
  /* ------------------------------------------------------------------------ */

  const permitted = useCallback(
    (href: string) => {
      const featureModule = moduleForPath(href);

      return (
        !featureModule ||
        !me?.blockedModules?.includes(featureModule)
      );
    },
    [me?.blockedModules]
  );

  const visibleNavItems = useMemo<NavItem[]>(() => {
    if (role === "ADMIN") {
      return ADMIN_NAV.filter((item) => permitted(item.href));
    }

    if (role === "DOCTOR") {
      const doctorItems = DOCTOR_SECTIONS.flatMap((section) => section.items);

      const organisationItem: NavItem[] = me?.facility
        ? [
            {
              label: "Facility organisation",
              href: "/lab/organization",
              icon: Users,
              roles: ["DOCTOR"],
            },
          ]
        : [];

      return [...doctorItems, ...organisationItem].filter((item) =>
        permitted(item.href)
      );
    }

    const facility = me?.facility ?? null;

    if (
      role === "LAB_SCIENTIST" ||
      (role === "PATIENT" && facility)
    ) {
      if (!facility) return [];

      return FACILITY_SECTIONS
        .filter(
          (section) =>
            !section.kinds ||
            section.kinds.includes(facility.kind)
        )
        .flatMap((section) =>
          section.items
            .filter((item) => {
              if (
                facility.facilityRole !== "OWNER" &&
                item.permission &&
                !facility.permissions.includes(item.permission)
              ) {
                return false;
              }

              return true;
            })
            .filter((item) =>
              navigationFeatureEnabled(
                item.href,
                facility.kind,
                facility.enabledModules
              )
            )
            .filter((item) => permitted(item.href))
            .map((item) =>
              item.href === "/lab/website"
                ? {
                    ...item,
                    href: `/lab/website?facilityId=${encodeURIComponent(facility.id)}`,
                  }
                : item
            )
        );
    }

    return PATIENT_NAV.filter((item) => permitted(item.href));
  }, [role, me, permitted]);

  /* ------------------------------------------------------------------------ */
  /* GROUPED SIDEBAR SECTIONS                                                 */
  /* ------------------------------------------------------------------------ */

  const navSections = useMemo<NavSection[]>(() => {
    if (role === "ADMIN") {
      return ADMIN_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          visibleNavItems.some((visible) => visible.href === item.href)
        ),
      })).filter((section) => section.items.length > 0);
    }

    if (role === "DOCTOR") {
      const sections = DOCTOR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          visibleNavItems.some((visible) => visible.href === item.href)
        ),
      })).filter((section) => section.items.length > 0);

      const organisationItems = visibleNavItems.filter(
        (item) => normalisePath(item.href) === "/lab/organization"
      );

      if (organisationItems.length > 0) {
        sections.push({
          label: "Facility Workspace",
          items: organisationItems,
        });
      }

      return sections;
    }

    const facility = me?.facility ?? null;

    if (
      role === "LAB_SCIENTIST" ||
      (role === "PATIENT" && facility)
    ) {
      if (!facility) return [];

      return FACILITY_SECTIONS
        .filter(
          (section) =>
            !section.kinds ||
            section.kinds.includes(facility.kind)
        )
        .map((section) => ({
          label: section.label,
          items: visibleNavItems.filter((item) =>
            section.items.some(
              (source) =>
                normalisePath(source.href) === normalisePath(item.href)
            )
          ),
        }))
        .filter((section) => section.items.length > 0);
    }

    return [
      {
        label: null,
        items: visibleNavItems,
      },
    ];
  }, [role, me?.facility, visibleNavItems]);

  const navItems = visibleNavItems;

  /* ------------------------------------------------------------------------ */
  /* MOBILE BOTTOM NAVIGATION                                                */
  /* ------------------------------------------------------------------------ */

  const bottomNav = useMemo<NavItem[]>(() => {
    if (role === "ADMIN") {
      const preferred = [
        { href: "/admin", label: "Home", icon: Home, roles: ["ADMIN"] },
        { href: "/admin/verifications", label: "Verify", icon: ShieldCheck, roles: ["ADMIN"] },
        { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
        { href: "/admin/payments", label: "Payments", icon: Receipt, roles: ["ADMIN"] },
      ];

      return preferred.filter((item) =>
        visibleNavItems.some(
          (visible) =>
            normalisePath(visible.href) === normalisePath(item.href)
        )
      );
    }

    const facility = me?.facility;

    if (
      facility &&
      (role === "PATIENT" || role === "LAB_SCIENTIST")
    ) {
      const items: NavItem[] = [
        {
          href: "/lab/dashboard",
          label: "Facility",
          icon: Home,
          roles: [role],
        },
        facility.kind === "DIAGNOSTIC_CENTRE"
          ? {
              href: "/lab/examinations",
              label: "Exams",
              icon: FileText,
              roles: [role],
            }
          : facility.kind === "HOSPITAL"
            ? {
                href: "/lab/admissions",
                label: "Wards",
                icon: BedDouble,
                roles: [role],
              }
            : facility.kind === "PHARMACY"
              ? {
                  href: "/lab/pharmacy",
                  label: "Pharmacy",
                  icon: Pill,
                  roles: [role],
                }
              : {
                  href: "/lab/orders",
                  label: "Orders",
                  icon: ClipboardList,
                  roles: [role],
                },
        {
          href: "/lab/case-reports?tab=documents",
          label: "Docs",
          icon: FolderOpen,
          roles: [role],
        },
        {
          href: "/settings",
          label: "Settings",
          icon: Settings,
          roles: [role],
        },
      ];

      return items.filter((item) =>
        visibleNavItems.some(
          (visible) =>
            normalisePath(visible.href) === normalisePath(item.href)
        )
      );
    }

    return BOTTOM_NAV_ITEMS.filter(
      (item) =>
        item.roles.includes(role) &&
        visibleNavItems.some(
          (visible) =>
            normalisePath(visible.href) === normalisePath(item.href)
        )
    );
  }, [me?.facility, role, visibleNavItems]);

  /* ------------------------------------------------------------------------ */
  /* SEARCH CONFIGURATION                                                     */
  /* ------------------------------------------------------------------------ */

  const suggestions =
    role === "ADMIN"
      ? ADMIN_SUGGESTIONS
      : isFacilityUser || role === "LAB_SCIENTIST"
        ? FACILITY_SUGGESTIONS
        : role === "DOCTOR"
          ? DOCTOR_AI_SUGGESTIONS
          : AI_SUGGESTIONS;

  const filterChips =
    role === "ADMIN"
      ? ADMIN_CHIPS
      : isFacilityUser || role === "LAB_SCIENTIST"
        ? FACILITY_CHIPS
        : role === "DOCTOR"
          ? DOCTOR_CHIPS
          : PATIENT_CHIPS;

  const searchPlaceholder =
    role === "ADMIN"
      ? "Search administration..."
      : isFacilityUser || role === "LAB_SCIENTIST"
        ? "Search facility workspace..."
        : role === "DOCTOR"
          ? "Search doctor workspace..."
          : "Search your healthcare workspace...";

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return suggestions;

    const query = searchQuery.toLowerCase();

    return suggestions.filter((suggestion) =>
      suggestion.text.toLowerCase().includes(query)
    );
  }, [searchQuery, suggestions]);

  /* ------------------------------------------------------------------------ */
  /* SEARCH RESULTS                                                           */
  /* ------------------------------------------------------------------------ */

  const getSearchResults = useCallback((): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    visibleNavItems.forEach((item) => {
      if (
        item.label.toLowerCase().includes(query) ||
        item.href.toLowerCase().includes(query)
      ) {
        results.push({
          title: item.label,
          subtitle: `Open ${item.label}`,
          href: item.href,
          icon: item.icon,
          category: getSearchCategory(item.href),
        });
      }
    });

    suggestions.forEach((suggestion) => {
      if (!suggestion.text.toLowerCase().includes(query)) return;

      const matchingNav = visibleNavItems.find((item) => {
        const category = getSearchCategory(item.href);
        return (
          category === suggestion.category ||
          (suggestion.category === "ai" && item.href.includes("/ai"))
        );
      });

      if (
        matchingNav &&
        !results.some((result) => result.href === matchingNav.href)
      ) {
        results.push({
          title: suggestion.text,
          subtitle: `Suggested: ${matchingNav.label}`,
          href: matchingNav.href,
          icon: suggestion.icon,
          category: getSearchCategory(matchingNav.href),
        });
      }
    });

    return results
      .filter(
        (result) =>
          activeFilter === "all" ||
          result.category === activeFilter
      )
      .slice(0, 8);
  }, [searchQuery, visibleNavItems, suggestions, activeFilter]);

  const searchResults = getSearchResults();

  /* ------------------------------------------------------------------------ */
  /* SEARCH FOCUS                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  /* ------------------------------------------------------------------------ */
  /* KEYBOARD SHORTCUTS                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      return (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      const insideSearch =
        (searchWrapRef.current?.contains(target) ?? false) ||
        (mobileSearchRef.current?.contains(target) ?? false);

      if (!insideSearch) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();

        if (window.matchMedia("(max-width: 639px)").matches) {
          setMobileSearchOpen(true);
          setSearchOpen(true);
        } else {
          setSearchOpen(true);
          searchRef.current?.focus();
        }

        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "b") {
        if (!isTyping(event.target)) {
          event.preventDefault();
          toggleSidebar();
        }
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileSearchOpen(false);
        setMobileSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleSidebar]);

  /* ------------------------------------------------------------------------ */
  /* MOBILE DRAWER SCROLL LOCK                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");

    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileSidebarOpen(false);
      }
    };

    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* ACTIVE ROUTE                                                             */
  /* ------------------------------------------------------------------------ */

  const isActive = useCallback(
    (href: string) => {
      const path = normalisePath(href);
      const current = normalisePath(pathname);

      return (
        current === path ||
        (path !== "/" && current.startsWith(`${path}/`))
      );
    },
    [pathname]
  );

  const currentNavItem = navItems.find((item) => isActive(item.href));

  const workspaceTitle =
    role === "ADMIN"
      ? "Super Admin Control Centre"
      : role === "DOCTOR"
        ? "Doctor Workspace"
        : me?.facility?.name ?? "Patient Workspace";

  /* ------------------------------------------------------------------------ */
  /* PUBLIC AND AUTHENTICATION PAGES                                          */
  /* ------------------------------------------------------------------------ */

  if (pathname === "/" && !user) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-border bg-card">
          <WebsiteTour publicTour />
        </div>
      </>
    );
  }

  if (
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup") ||
    pathname.startsWith("/auth/callback")
  ) {
    return <>{children}</>;
  }

  /* ------------------------------------------------------------------------ */
  /* SEARCH DROPDOWN                                                          */
  /* ------------------------------------------------------------------------ */

  const searchDropdown = searchOpen ? (
    <div className="absolute left-0 right-0 top-full z-[80] mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-xl md:left-1/2 md:right-auto md:w-full md:max-w-xl md:-translate-x-1/2">
      <div className="flex gap-2 overflow-x-auto border-b border-border p-3">
        {filterChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setActiveFilter(chip.value)}
            aria-pressed={activeFilter === chip.value}
            className={`filter-chip shrink-0 ${
              activeFilter === chip.value ? "active" : ""
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {searchQuery ? (
          searchResults.length > 0 ? (
            searchResults.map((result, index) => {
              const Icon = result.icon;

              return (
                <Link
                  key={`${result.href}-${index}`}
                  prefetch={navigationPrefetch}
                  onNavigate={anonymousNavigation(result.href)}
                  href={result.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                    setMobileSearchOpen(false);
                    setActiveFilter("all");
                  }}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="icon-badge flex h-8 w-8 items-center justify-center bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {result.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.subtitle}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })
          ) : (
            <div className="p-6 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No navigation results for &quot;{searchQuery}&quot;
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try another search term or select All.
              </p>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Workspace Suggestions
              </span>
            </div>

            {filteredSuggestions.map((suggestion, index) => {
              const Icon = suggestion.icon;

              return (
                <button
                  key={`${suggestion.category}-${index}`}
                  type="button"
                  onClick={() => {
                    setSearchQuery(suggestion.text);
                    setActiveFilter("all");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="icon-badge flex h-8 w-8 items-center justify-center bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <span className="text-sm text-foreground">
                    {suggestion.text}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  ) : null;

  /* ------------------------------------------------------------------------ */
  /* MAIN NAVBAR                                                              */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
          {/* Mobile menu button */}
          {showNavChrome && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((open) => !open)}
              aria-label={mobileSidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileSidebarOpen}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted md:hidden"
            >
              {mobileSidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Medic1905 logo */}
          <Link
            prefetch={navigationPrefetch}
            onNavigate={anonymousNavigation("/dashboard")}
            href="/dashboard"
            aria-label="Medic1905 home"
            className={`${
              user ? "hidden sm:flex" : "flex"
            } shrink-0 items-center rounded-lg transition-opacity hover:opacity-80`}
          >
            <Image
              src="/medic1905-logo.png"
              alt="Medic1905"
              width={465}
              height={180}
              priority
              className="h-7 w-auto sm:h-8 dark:rounded-lg dark:bg-white dark:p-1.5"
            />
          </Link>

          {/* Workspace identity */}
          {me && (
            <nav
              aria-label="Current workspace"
              className="workspace-title min-w-0"
            >
              <span className="hidden truncate text-xs text-muted-foreground lg:block">
                {workspaceTitle}
              </span>

              <span className="block max-w-40 truncate font-medium sm:max-w-56">
                {currentNavItem?.label ??
                  (pathname.startsWith("/auth/callback")
                    ? "Registration"
                    : "Medic1905")}
              </span>
            </nav>
          )}

          {/* Desktop search */}
          <div
            ref={searchWrapRef}
            className="relative mx-auto hidden min-w-0 max-w-xl flex-1 sm:block"
          >
            <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

              <input
                ref={searchRef}
                type="text"
                placeholder={searchPlaceholder}
                aria-label="Search authorised workspace navigation"
                aria-expanded={searchOpen}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveFilter("all");
                }}
                onFocus={() => setSearchOpen(true)}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("all");
                    setSearchOpen(false);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground md:block">
                Ctrl K
              </kbd>
            </div>

            {searchDropdown}
          </div>

          {/* Right-side actions */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Mobile search */}
            {showNavChrome && (
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen(true);
                  setSearchOpen(true);
                }}
                aria-label="Search workspace"
                aria-expanded={mobileSearchOpen}
                data-testid="button-mobile-search"
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted sm:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            <NotificationCenter enabled={Boolean(me)} />

            <WebsiteTour
              links={
                me?.status === "ACTIVE" && me.onboardingComplete
                  ? navItems
                  : []
              }
              publicTour={!user}
              compact={Boolean(user)}
            />

            {/* Theme switch */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-pressed={theme === "dark"}
              data-testid="button-theme-toggle"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
            >
              {theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>

            {/* Account menu */}
            {user ? (
              <details className="relative">
                <summary
                  className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg"
                  aria-label="Open profile menu"
                >
                  <NavbarAvatar me={me} user={user} />
                </summary>

                <div className="absolute right-0 top-full z-[90] mt-2 grid min-w-56 gap-2 rounded-xl border border-border bg-popover p-3 shadow-lg">
                  <p className="break-words px-2 text-sm font-semibold">
                    {me?.name ?? "Your account"}
                  </p>

                  <button
                    type="button"
                    className="rounded-lg p-3 text-left text-sm hover:bg-muted sm:hidden"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setMobileSearchOpen(true);
                      setSearchOpen(true);
                    }}
                  >
                    Search workspace
                  </button>

                  <button
                    type="button"
                    className="rounded-lg p-3 text-left text-sm hover:bg-muted sm:hidden"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      window.dispatchEvent(new Event("medic1905:tour"));
                    }}
                  >
                    Help & Tour
                  </button>

                  <Link
                    prefetch={navigationPrefetch}
                    onNavigate={anonymousNavigation("/profile")}
                    href="/profile"
                    className="rounded-lg p-3 text-sm hover:bg-muted"
                  >
                    My profile
                  </Link>

                  <Link
                    prefetch={navigationPrefetch}
                    onNavigate={anonymousNavigation("/settings")}
                    href="/settings"
                    className="rounded-lg p-3 text-sm hover:bg-muted"
                  >
                    Account settings
                  </Link>

                  <Link
                    prefetch={navigationPrefetch}
                    onNavigate={anonymousNavigation("/legal/history")}
                    href="/legal/history"
                    className="rounded-lg p-3 text-sm hover:bg-muted"
                  >
                    My policy history
                  </Link>

                  <SignOutButton />
                </div>
              </details>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  prefetch={navigationPrefetch}
                  onNavigate={anonymousNavigation("/auth/login")}
                  href="/auth/login"
                  className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
                >
                  Sign In
                </Link>

                <Link
                  prefetch={navigationPrefetch}
                  onNavigate={anonymousNavigation("/auth/signup")}
                  href="/auth/signup"
                  className="pill-btn hidden bg-foreground px-4 py-2 text-sm text-background sm:inline-block"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile search panel */}
      {mobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="fixed inset-x-0 top-16 z-[80] border-b border-border bg-card p-3 shadow-lg sm:hidden"
        >
          <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

            <input
              type="text"
              autoFocus
              placeholder={searchPlaceholder}
              aria-label="Search workspace"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveFilter("all");
              }}
              onFocus={() => setSearchOpen(true)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />

            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchOpen(false);
                setSearchQuery("");
              }}
              aria-label="Close search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {searchDropdown}
        </div>
      )}

      {/* Main application layout */}
      <SidebarProvider
        open={!sidebarCollapsed}
        onOpenChange={(open) => {
          setSidebarCollapsed(!open);
          saveSidebarPreference(!open);
        }}
        className="w-full flex-1"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        {/* Desktop sidebar */}
        {showNavChrome && (
          <Sidebar
            collapsible="icon"
            data-testid="desktop-sidebar"
            data-collapsed={sidebarCollapsed}
            style={{
              top: "4rem",
              height: "calc(100vh - 4rem)",
            }}
          >
            <SidebarHeader>
              <div className="flex items-center justify-between px-3 pt-4">
                <span className="truncate text-xs font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {workspaceTitle}
                </span>

                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  aria-expanded={!sidebarCollapsed}
                  title={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  data-testid="button-sidebar-toggle"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PanelLeftClose
                    className={`h-4 w-4 transition-transform ${
                      sidebarCollapsed ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            </SidebarHeader>

            <SidebarContent>
              {navSections.map((section, sectionIndex) => (
                <SidebarGroup key={section.label ?? "main"}>
                  {section.label && (
                    <SidebarGroupLabel
                      data-testid={`sidebar-section-${section.label}`}
                    >
                      {section.label}
                    </SidebarGroupLabel>
                  )}

                  <SidebarMenu>
                    {section.items.map((item, index) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      return (
                        <SidebarMenuItem
                          key={`${item.href}-${sectionIndex}-${index}`}
                        >
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={item.label}
                            aria-label={item.label}
                            render={
                              <Link
                                prefetch={navigationPrefetch}
                                onNavigate={anonymousNavigation(item.href)}
                                href={item.href}
                              />
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </SidebarContent>

            <SidebarFooter>
              <p className="text-xs text-muted-foreground">
                Medic1905 is a platform only, not a medical provider. AI content
                is informational.
              </p>
            </SidebarFooter>

            <SidebarRail />
          </Sidebar>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="has-bottom-nav flex-1 p-4 md:p-6">
            {children}
          </main>

          <Footer />
        </div>
      </SidebarProvider>

      {/* Mobile navigation drawer */}
      {showNavChrome && (
        <Sheet
          open={mobileSidebarOpen}
          onOpenChange={setMobileSidebarOpen}
        >
          <SheetContent
            side="left"
            className="z-[70] w-[min(320px,90vw)] overflow-y-auto bg-sidebar"
          >
            <SheetTitle className="sr-only">
              Workspace navigation
            </SheetTitle>

            <SheetDescription className="sr-only">
              Modules available to your account. Escape closes this menu.
            </SheetDescription>

            <div className="flex h-16 items-center gap-2 border-b border-border px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-background"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2v20M2 12h20"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <span className="block truncate text-base font-bold text-foreground">
                  Medic1905
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {workspaceTitle}
                </span>
              </div>
            </div>

            <nav
              className="space-y-4 p-3 pb-20"
              aria-label="Mobile workspace navigation"
            >
              {navSections.map((section, sectionIndex) => (
                <div
                  key={section.label ?? "main"}
                  className="space-y-1"
                >
                  {section.label && (
                    <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                  )}

                  {section.items.map((item, index) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        prefetch={navigationPrefetch}
                        onNavigate={anonymousNavigation(item.href)}
                        key={`${item.href}-${sectionIndex}-${index}`}
                        href={item.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile bottom navigation */}
      {showNavChrome && bottomNav.length > 0 && (
        <nav
          className="bottom-nav md:hidden"
          aria-label="Mobile bottom navigation"
        >
          {bottomNav.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                prefetch={navigationPrefetch}
                onNavigate={anonymousNavigation(item.href)}
                key={`${item.href}-${index}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`bottom-nav-item ${
                  active ? "active" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* NAVBAR AVATAR                                                              */
/* -------------------------------------------------------------------------- */

function NavbarAvatar({
  me,
  user,
}: {
  me: Me | null;
  user: NonNullable<ReturnType<typeof useUser>["user"]>;
}) {
  const [imageBroken, setImageBroken] = useState(false);

  const src = me?.avatarUrl ?? user.imageUrl;

  const initial =
    user.firstName?.[0] ||
    user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ||
    "U";

  if (src && !imageBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        onError={() => setImageBroken(true)}
        className="h-9 w-9 rounded-lg bg-muted object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
      {initial}
    </div>
  );
}