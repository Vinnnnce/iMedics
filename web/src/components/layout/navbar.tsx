"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/components/theme-provider";
import {
  Search, Sun, Moon, Menu, X, Home, Stethoscope, Users,
  FlaskConical, Heart, Sparkles, User, Settings, Shield,
  Calendar, FileText, Video, MessageSquare, Building2,
  ClipboardList, Upload, LayoutDashboard, ArrowRight,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  roles: string[];
};

const PATIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["PATIENT"] },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope, roles: ["PATIENT"] },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar, roles: ["PATIENT"] },
  { href: "/patient/results", label: "Lab Results", icon: FlaskConical, roles: ["PATIENT"] },
  { href: "/patient/case-file", label: "Case File", icon: FileText, roles: ["PATIENT"] },
  { href: "/patient/history", label: "Case History", icon: ClipboardList, roles: ["PATIENT"] },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText, roles: ["PATIENT"] },
  { href: "/patient/consult", label: "Consultation", icon: Video, roles: ["PATIENT"] },
  { href: "/profile", label: "Profile", icon: User, roles: ["PATIENT"] },
  { href: "/profile", label: "Settings", icon: Settings, roles: ["PATIENT"] },
  { href: "/admin", label: "Admin Panel", icon: Shield, roles: ["PATIENT"] },
];

const DOCTOR_NAV: NavItem[] = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["DOCTOR"] },
  { href: "/doctor/patients", label: "Find Patients", icon: Users, roles: ["DOCTOR"] },
  { href: "/doctor/booking-requests", label: "Booking Requests", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/consultations", label: "Consultations", icon: ClipboardList, roles: ["DOCTOR"] },
  { href: "/doctor/chat", label: "Chat", icon: MessageSquare, roles: ["DOCTOR"] },
  { href: "/doctor/lab-requests", label: "Lab Requests", icon: FlaskConical, roles: ["DOCTOR"] },
  { href: "/doctor/diagnostics", label: "AI Diagnostics", icon: Heart, roles: ["DOCTOR"] },
  { href: "/doctor/ai-tools", label: "AI Tools", icon: Sparkles, roles: ["DOCTOR"] },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar, roles: ["DOCTOR"] },
  { href: "/doctor/admit", label: "Admit/Discharge", icon: Building2, roles: ["DOCTOR"] },
  { href: "/profile", label: "Profile", icon: User, roles: ["DOCTOR"] },
  { href: "/profile", label: "Settings", icon: Settings, roles: ["DOCTOR"] },
  { href: "/admin", label: "Admin Panel", icon: Shield, roles: ["DOCTOR"] },
];

const LAB_NAV: NavItem[] = [
  { href: "/lab/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/users", label: "User Directory", icon: Users, roles: ["LAB_SCIENTIST"] },
  { href: "/lab/upload", label: "Upload Results", icon: Upload, roles: ["LAB_SCIENTIST"] },
  { href: "/profile", label: "Profile", icon: User, roles: ["LAB_SCIENTIST"] },
  { href: "/profile", label: "Settings", icon: Settings, roles: ["LAB_SCIENTIST"] },
  { href: "/admin", label: "Admin Panel", icon: Shield, roles: ["LAB_SCIENTIST"] },
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const role = ((user?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  const navItems = role === "DOCTOR" ? DOCTOR_NAV : role === "LAB_SCIENTIST" ? LAB_NAV : PATIENT_NAV;
  const bottomNav = BOTTOM_NAV_ITEMS.filter((item) => item.roles.includes(role));
  const suggestions = role === "DOCTOR" ? DOCTOR_AI_SUGGESTIONS : AI_SUGGESTIONS;

  const filteredSuggestions = searchQuery
    ? suggestions.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : suggestions;

  // AI-driven search results
  const getSearchResults = useCallback(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { title: string; subtitle: string; href: string; icon: any }[] = [];

    // Search nav items
    navItems.forEach((item) => {
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
  }, [searchQuery, navItems, suggestions]);

  const searchResults = getSearchResults();

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const isActive = (href: string) => {
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/");
  };

  return (
    <>
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

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v20M2 12h20" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground hidden sm:inline">Medic1905</span>
          </Link>

          {/* AI Search Bar */}
          <div className="flex-1 max-w-xl mx-auto min-w-0">
            <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder={role === "DOCTOR" ? "Search patients, labs, AI tools..." : "Search doctors, labs, appointments..."}
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
            {searchOpen && (searchQuery || !searchQuery) && (
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
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
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
                        <p className="text-sm text-muted-foreground">No results for "{searchQuery}"</p>
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
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3 shrink-0">
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
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                  {user.firstName?.[0] || user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                </div>
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

      {/* Content row: sidebar beside main content, below the full-width header */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar w-64 shrink-0 border-r border-border bg-sidebar flex-col sticky top-16 h-[calc(100vh-4rem)]">
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto pt-5">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
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

        <div className="border-t border-border p-4 shrink-0">
          <p className="text-xs text-muted-foreground">
            Medic1905 is a platform only, not a medical provider. AI content is informational.
          </p>
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
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
            <nav className="p-3 space-y-1">
              {navItems.map((item, index) => {
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
      <nav className="bottom-nav md:hidden">
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
    </>
  );
}
