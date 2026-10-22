"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/components/theme-provider";
import { Footer } from "@/components/layout/footer";
import { NotificationCenter } from "@/components/shared/notification-center";
import {
  Search, Sun, Moon, Menu, X, Home, Stethoscope, Users,
  FlaskConical, Heart, Sparkles, User, Shield, Globe, HeartPulse,
  Calendar, FileText, Video, MessageSquare, Building2,
  ClipboardList, Upload, LayoutDashboard, ArrowRight, Receipt, Wallet, Tags, PanelLeftClose,
  FolderOpen, BellRing, ShieldCheck, Settings, BedDouble, SearchCheck, Bell, Star, Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { Me, MeFacility } from "@/lib/use-me";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  /** Facility permission required to see this link. Owners always see it. */
  permission?: string;
};

const PATIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["PATIENT"] },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar, roles: ["PATIENT"] },
  { href: "/facilities", label: "Labs & Services", icon: Building2, roles: ["PATIENT"] },
  { href: "/payments", label: "Payments", icon: Receipt, roles: ["PATIENT"] },
  { href: "/patient/results", label: "Lab Results", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/patient/case-file", label: "Case File", icon: FileText, roles: ["PATIENT"] },
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

const DOCTOR_NAV: NavItem[] = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["DOCTOR"] },
  { href: "/doctor/patients", label: "My Patients", icon: Users, roles: ["DOCTOR"] },
  { href: "/doctor/booking-requests", label: "Booking Requests", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList, roles: ["DOCTOR"] },
  { href: "/doctor/chat", label: "Chat", icon: MessageSquare, roles: ["DOCTOR"] },
  { href: "/doctor/lab-requests", label: "Lab Requests", icon: FlaskConical, roles: ["DOCTOR"] },
  { href: "/doctor/diagnostics", label: "Clinical Notes", icon: Heart, roles: ["DOCTOR"] },
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: FileText, roles: ["DOCTOR"] },
  { href: "/doctor/records", label: "Patient Records", icon: FolderOpen, roles: ["DOCTOR"] },
  { href: "/doctor/ai-tools", label: "AI Review", icon: Sparkles, roles: ["DOCTOR"] },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/fees", label: "Fees", icon: Tags, roles: ["DOCTOR"] },
  { href: "/payments", label: "Payments", icon: Wallet, roles: ["DOCTOR"] },
  { href: "/doctor/admit", label: "Care Roster", icon: Building2, roles: ["DOCTOR"] },
  { href: "/emergency", label: "Emergency", icon: HeartPulse, roles: ["DOCTOR"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["DOCTOR"] },
  { href: "/doctor/profile", label: "My Profile", icon: User, roles: ["DOCTOR"] },
];

/**
 * The hospital / laboratory / diagnostic-centre modules. Each page enforces the
 * facility kind and the caller's facility membership server-side
 * (requireModulePage in lib/modules/page-guards.ts) — these links only decide
 * what is worth showing. Items map to the module pages that exist today:
 * /lab/admissions, /lab/investigations, /lab/orders, /lab/specimens,
 * /lab/examinations, /lab/critical-alerts, /lab/documents,
 * /lab/document-templates and /lab/referrals.
 */
const FACILITY_MODULE_ITEMS: NavItem[] = [
  // Hospital documents: admissions, investigations, critical alerts.
  { href: "/lab/admissions", label: "Admissions", icon: BedDouble, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
  { href: "/lab/investigations", label: "Investigations", icon: SearchCheck, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
  // Laboratory workflows: the order queue, specimens and result upload.
  { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList, roles: ["FACILITY"], permission: "PROCESS_ORDERS" },
  { href: "/lab/specimens", label: "Specimens", icon: FlaskConical, roles: ["FACILITY"], permission: "PROCESS_ORDERS" },
  { href: "/lab/upload", label: "Upload Results", icon: Upload, roles: ["FACILITY"], permission: "ENTER_RESULTS" },
  // Diagnostic-centre workflows: examinations and reports.
  { href: "/lab/examinations", label: "Examinations", icon: FileText, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
  // Critical-result alerts (hospital and laboratory kinds only).
  { href: "/lab/critical-alerts", label: "Critical Alerts", icon: Bell, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
  // Documents shared by every facility kind.
  { href: "/lab/documents", label: "Documents", icon: FolderOpen, roles: ["FACILITY"], permission: "VIEW_PATIENT_DOCUMENTS" },
  { href: "/lab/document-templates", label: "Document Templates", icon: FileText, roles: ["FACILITY"], permission: "MANAGE_DOCUMENT_TEMPLATES" },
  { href: "/lab/referrals", label: "Referrals", icon: Briefcase, roles: ["FACILITY"], permission: "MANAGE_REFERRALS" },
];

/** Which module links apply to a facility kind (mirrors the page guards). */
const FACILITY_DASHBOARD_ITEM: NavItem = {
  href: "/lab/dashboard",
  label: "Facility Dashboard",
  icon: LayoutDashboard,
  roles: ["FACILITY"],
};

const KIND_MODULE_HREFS: Record<MeFacility["kind"], readonly string[]> = {
  HOSPITAL: ["/lab/admissions", "/lab/investigations", "/lab/critical-alerts", "/lab/documents", "/lab/document-templates", "/lab/referrals"],
  LABORATORY: ["/lab/orders", "/lab/specimens", "/lab/upload", "/lab/critical-alerts", "/lab/documents", "/lab/document-templates", "/lab/referrals"],
  DIAGNOSTIC_CENTRE: ["/lab/examinations", "/lab/documents", "/lab/document-templates", "/lab/referrals"],
};

const LAB_NAV: NavItem[] = [
  { href: "/lab/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["LAB_SCIENTIST"] },
  ...FACILITY_MODULE_ITEMS,
  { href: "/lab/bookings", label: "Bookings", icon: Calendar, roles: ["LAB_SCIENTIST"], permission: "MANAGE_BOOKINGS" },
  { href: "/lab/services", label: "Services & Prices", icon: Tags, roles: ["LAB_SCIENTIST"], permission: "MANAGE_SERVICES" },
  { href: "/lab/reviews", label: "Reviews", icon: Star, roles: ["LAB_SCIENTIST"], permission: "MANAGE_PROFILE" },
  { href: "/lab/users", label: "Patient Lookup", icon: Users, roles: ["LAB_SCIENTIST"], permission: "REGISTER_PATIENTS" },
  { href: "/lab/website", label: "Our Website", icon: Globe, roles: ["LAB_SCIENTIST"], permission: "MANAGE_PROFILE" },
  { href: "/emergency", label: "Emergency", icon: HeartPulse, roles: ["LAB_SCIENTIST"] },
  { href: "/payments", label: "Payments", icon: Wallet, roles: ["LAB_SCIENTIST"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["LAB_SCIENTIST"] },
  { href: "/profile", label: "Profile", icon: User, roles: ["LAB_SCIENTIST"] },
];

const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home, roles: ["PATIENT"] },
  { href: "/doctor/dashboard", label: "Home", icon: Home, roles: ["DOCTOR"] },
  { href: "/lab/dashboard", label: "Home", icon: Home, roles: ["LAB_SCIENTIST"] },
  { href: "/doctors", label: "Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/doctor/patients", label: "Patients", icon: Users, roles: ["DOCTOR"] },
  { href: "/lab/orders", label: "Orders", icon: ClipboardList, roles: ["LAB_SCIENTIST"] },
  { href: "/patient/results", label: "Labs", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/doctor/diagnostics", label: "Diag", icon: Heart, roles: ["DOCTOR"] },
  { href: "/lab/users", label: "Users", icon: Users, roles: ["LAB_SCIENTIST"] },
  { href: "/patient/case-file", label: "Diag", icon: Heart, roles: ["PATIENT"] },
];

const AI_SUGGESTIONS = [
  { text: "Find a cardiologist near me", icon: Stethoscope, category: "doctor" },
  { text: "View my latest lab results", icon: FlaskConical, category: "results" },
  { text: "Book an appointment", icon: Calendar, category: "appointment" },
  { text: "Check my prescriptions", icon: FileText, category: "prescription" },
  { text: "Start a video consultation", icon: Video, category: "consult" },
  { text: "View my case history", icon: ClipboardList, category: "history" },
];

const DOCTOR_AI_SUGGESTIONS = [
  { text: "Find patient by name or ID", icon: Users, category: "patient" },
  { text: "Review pending lab requests", icon: FlaskConical, category: "lab" },
  { text: "AI-assisted diagnostics", icon: Sparkles, category: "ai" },
  { text: "View today's schedule", icon: Calendar, category: "schedule" },
  { text: "Write consultation notes", icon: ClipboardList, category: "consult" },
  { text: "AI case history analysis", icon: FileText, category: "ai" },
];

const FILTER_CHIPS = [
  { label: "All", value: "all" },
  { label: "Doctors", value: "doctors" },
  { label: "Patients", value: "patients" },
  { label: "Lab Results", value: "labs" },
  { label: "Appointments", value: "appointments" },
  { label: "Prescriptions", value: "prescriptions" },
];

export function Navbar({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const me = useMe();
  const role = me?.role ?? "PATIENT";

  // Remember the sidebar preference across sessions (desktop only).
  useEffect(() => {
    void Promise.resolve().then(() => {
      setSidebarCollapsed(window.localStorage.getItem("medic1905.sidebar.collapsed") === "1");
    });
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      window.localStorage.setItem("medic1905.sidebar.collapsed", collapsed ? "0" : "1");
      return !collapsed;
    });
  }, []);

  /**
   * One resolver for the sidebar, the mobile drawer, the bottom navigation and
   * the search results. Links marked FACILITY need a resolved facility
   * context: the /api/me response computes the facility kind and permissions
   * server-side, and the target pages still enforce everything independently.
   */
  const visibleNavItems = useMemo(() => {
    const base =
      role === "DOCTOR" ? DOCTOR_NAV : role === "LAB_SCIENTIST" ? LAB_NAV : PATIENT_NAV;
    // Facility staff whose platform role is PATIENT still get the workspace
    // module links: the facility context is resolved server-side in /api/me.
    const items =
      role === "PATIENT" && me?.facility
        ? [FACILITY_DASHBOARD_ITEM, ...FACILITY_MODULE_ITEMS, ...base]
        : base;

    const filtered = items.filter((item) => {
      if (!item.roles.includes("FACILITY")) return item.roles.includes(role);
      const facility = me?.facility;
      if (!facility) return false;
      if (!KIND_MODULE_HREFS[facility.kind].includes(item.href)) return false;
      if (
        facility.facilityRole !== "OWNER" &&
        item.permission &&
        !facility.permissions.includes(item.permission)
      ) {
        return false;
      }
      return true;
    });

    // The admin panel link is shown only to accounts the server has granted the ADMIN role.
    if (role === "ADMIN") {
      filtered.push({ href: "/admin", label: "Admin Panel", icon: Shield, roles: [role] });
    }
    return filtered;
  }, [role, me]);
  const navItems = visibleNavItems;
  const bottomNav = useMemo(() => {
    const facility = me?.facility;
    if (facility && (role === "PATIENT" || role === "LAB_SCIENTIST")) {
      // Facility users: quick links to their workspace modules by kind.
      const kind = facility.kind;
      const items: NavItem[] = [
        { href: "/lab/dashboard", label: "Facility", icon: Home, roles: [role] },
        kind === "DIAGNOSTIC_CENTRE"
          ? { href: "/lab/examinations", label: "Exams", icon: FileText, roles: [role] }
          : kind === "HOSPITAL"
            ? { href: "/lab/admissions", label: "Wards", icon: BedDouble, roles: [role] }
            : { href: "/lab/orders", label: "Orders", icon: ClipboardList, roles: [role] },
        { href: "/lab/documents", label: "Docs", icon: FolderOpen, roles: [role] },
        { href: "/settings", label: "Settings", icon: Settings, roles: [role] },
      ];
      return items;
    }
    return BOTTOM_NAV_ITEMS.filter((item) => item.roles.includes(role));
  }, [me?.facility, role]);
  const suggestions = role === "DOCTOR" ? DOCTOR_AI_SUGGESTIONS : AI_SUGGESTIONS;

  const filteredSuggestions = searchQuery
    ? suggestions.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : suggestions;

  // AI-driven search results
  const getSearchResults = useCallback(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { title: string; subtitle: string; href: string; icon: LucideIcon }[] = [];

    // Search nav items
    visibleNavItems.forEach((item) => {
      if (item.label.toLowerCase().includes(q)) {
        results.push({
          title: item.label,
          subtitle: `Navigate to ${item.label}`,
          href: item.href,
          icon: item.icon,
        });
      }
    });

    // AI suggestions
    suggestions.forEach((s) => {
      if (s.text.toLowerCase().includes(q)) {
        const matchingNav = navItems.find((n) =>
          s.category === "doctor" && n.href.includes("doctors") ||
          s.category === "patient" && n.href.includes("patients") ||
          s.category === "results" && n.href.includes("results") ||
          s.category === "appointment" && n.href.includes("appointments") ||
          s.category === "prescription" && n.href.includes("prescriptions") ||
          s.category === "consult" && n.href.includes("consult") ||
          s.category === "history" && n.href.includes("history") ||
          s.category === "lab" && n.href.includes("lab") ||
          s.category === "schedule" && n.href.includes("schedule") ||
          s.category === "ai" && n.href.includes("ai")
        );
        if (matchingNav) {
          results.push({
            title: s.text,
            subtitle: "AI suggestion",
            href: matchingNav.href,
            icon: s.icon,
          });
        }
      }
    });

    return results.slice(0, 6);
  }, [searchQuery, visibleNavItems, suggestions, navItems]);

  const searchResults = getSearchResults();

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close the search dropdown when clicking outside of it, and support the
  // ⌘K / Ctrl+K shortcut advertised in the search bar. Escape always closes it.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const insideSearch =
        (searchWrapRef.current?.contains(target) ?? false) || (mobileSearchRef.current?.contains(target) ?? false);
      if (!insideSearch) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(max-width: 639px)").matches) {
          // On phones the inline search input is hidden; open the search row.
          setMobileSearchOpen(true);
          setSearchOpen(true);
        } else {
          setSearchOpen(true);
          searchRef.current?.focus();
        }
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Lock the page scroll while the mobile drawer is open so the content
  // underneath cannot be scrolled past the overlay. Closing the drawer when the
  // viewport grows past the mobile breakpoint also releases the lock.
  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileSidebarOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isActive = (href: string) => {
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/");
  };

  // Logged-out visitors on the public homepage render it standalone: the
  // homepage brings its own header, footer, and theme toggle, so the
  // application chrome (sidebar, search, bottom nav) stays out of the way.
  // Authenticated visitors never reach this branch with the homepage: the
  // root page redirects them (only suspended accounts render there, with the
  // app chrome, which is the correct shell for them).
  if (pathname === "/" && !user) {
    return <>{children}</>;
  }

  // The AI search dropdown, shared by the desktop search bar and the mobile search row.
  const searchDropdown = searchOpen ? (
<div className="absolute top-full left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-xl mt-1 ai-suggestions overflow-hidden z-50">
                {/* Filter chips */}
                <div className="flex gap-2 p-3 overflow-x-auto border-b border-border">
                  {FILTER_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => setActiveFilter(chip.value)}
                      className={`filter-chip ${activeFilter === chip.value ? "active" : ""}`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* AI Suggestions or Search Results */}
                <div className="max-h-80 overflow-y-auto">
                  {searchQuery ? (
                    searchResults.length > 0 ? (
                      searchResults.map((result, i) => (
                        <Link
                          key={i}
                          href={result.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); setMobileSearchOpen(false); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors cursor-pointer"
                        >
                          <div className="icon-badge h-8 w-8 bg-muted">
                            <result.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      ))
                    ) : (
                      <div className="p-6 text-center">
                        <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No results for &quot;{searchQuery}&quot;</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">AI Suggestions</span>
                      </div>
                      {filteredSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setSearchQuery(suggestion.text)}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-accent transition-colors text-left"
                        >
                          <div className="icon-badge h-8 w-8 bg-muted">
                            <suggestion.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm text-foreground">{suggestion.text}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* AI-Driven Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted"
          >
            {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo — Medic1905 wordmark (white chip keeps it legible in dark mode) */}
          <Link href="/dashboard" className="flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80" aria-label="Medic1905 home">
            <Image
              src="/medic1905-logo.png"
              alt="Medic1905"
              width={465}
              height={180}
              priority
              className="h-8 w-auto dark:rounded-lg dark:bg-white dark:p-1.5"
            />
          </Link>

          {/* AI Search Bar (sm and up; on phones it collapses to a search icon) */}
          <div ref={searchWrapRef} className="relative hidden flex-1 max-w-xl mx-auto min-w-0 sm:block">
            <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder={role === "DOCTOR" ? "Search patients, labs…" : "Search doctors, labs…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="hidden md:block text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
            </div>

            {/* AI Search Results Dropdown */}
            {searchDropdown}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 shrink-0 sm:gap-3">
            {/* Mobile search toggle */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
              data-testid="button-mobile-search"
              className="flex sm:hidden h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
            >
              <Search className="h-5 w-5" />
            </button>
            <NotificationCenter enabled={Boolean(me)} />
            {/* Theme switch toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
              className="rs-switch"
              data-active={theme === "light"}
            >
              <span className="rs-switch-thumb flex items-center justify-center">
                {theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </span>
            </button>

            {/* User avatar or sign in */}
            {user ? (
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="Your profile">
                <NavbarAvatar me={me} user={user} />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="pill-btn bg-foreground text-background px-4 py-2 text-sm hidden sm:inline-block"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile search row — opens from the search icon on phones */}
      {mobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="fixed inset-x-0 top-16 z-50 border-b border-border bg-card p-3 shadow-lg sm:hidden"
        >
          <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder={role === "DOCTOR" ? "Search patients, labs…" : "Search doctors, labs…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => { setMobileSearchOpen(false); setSearchOpen(false); }}
              aria-label="Close search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {searchDropdown}
        </div>
      )}

      {/* Content row: sidebar beside main content, below the full-width header */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar (collapsible to an icon rail) */}
      <aside
        className={`desktop-sidebar shrink-0 border-r border-border bg-sidebar flex-col sticky top-16 h-[calc(100vh-4rem)] transition-[width] ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
        data-testid="desktop-sidebar"
        data-collapsed={sidebarCollapsed}
      >
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="button-sidebar-toggle"
          className="mx-3 mt-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
        </button>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto pt-3" aria-label="Main navigation">
          {visibleNavItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={sidebarCollapsed ? "sr-only" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 shrink-0">
          <p className={`text-xs text-muted-foreground ${sidebarCollapsed ? "sr-only" : ""}`}>
            Medic1905 is a platform only, not a medical provider. AI content is informational.
          </p>
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-6 has-bottom-nav">{children}</main>
        <Footer />
      </div>
      </div>

      {/* Mobile sidebar overlay — above the bottom navigation so the backdrop covers it and the last links stay reachable */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border overflow-y-auto">
            <div className="flex h-16 items-center gap-2 border-b border-border px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M2 12h20" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-base font-bold text-foreground">Medic1905</span>
            </div>
            <nav className="space-y-1 p-3 pb-20">
              {visibleNavItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={`${item.label}-${index}`}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav md:hidden" aria-label="Mobile bottom navigation">
        {bottomNav.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={`${item.label}-${index}`}
              href={item.href}
              className={`bottom-nav-item ${active ? "active" : ""}`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * The header avatar: the user's saved profile image with a graceful fallback
 * to their initials. A failed image load never renders a broken-image icon —
 * it swaps to the initials once and keeps the layout stable.
 */
function NavbarAvatar({ me, user }: { me: Me | null; user: NonNullable<ReturnType<typeof useUser>["user"]> }) {
  const [imageBroken, setImageBroken] = useState(false);
  const src = me?.avatarUrl ?? user.imageUrl;
  const initial =
    user.firstName?.[0] || user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U";

  if (src && !imageBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Clerk/S3 avatar in a fixed chip
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
    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-foreground">
      {initial}
    </div>
  );
}
