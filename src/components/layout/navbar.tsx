"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, LifeBuoy, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Footer } from "@/components/layout/footer";
import { SubscriptionBanner } from "@/components/facility/subscription-banner";
import { useMe } from "@/lib/use-me";
import { getBottomNavigation, PATIENT_ACCOUNT_NAVIGATION } from "@/lib/navigation";
import { visibleNavigation } from "@/lib/navigation-visibility";
import { isPublicPageHref } from "@/lib/public-navigation";
import { ROLE_POLICY } from "@/lib/roles";

const PUBLIC_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact Us" },
] as const;

const PATIENT_HEALTH_PATHS = [
  "/patient/case-file",
  "/patient/cases",
  "/patient/history",
  "/patient/results",
  "/patient/prescriptions",
  "/patient/case-reports",
  "/patient/documents",
  "/patient/records",
];

/** Pages that render their own complete shell (header, navigation, theme). */
function hasOwnShell(pathname: string, signedIn: boolean): boolean {
  if (pathname === "/" && !signedIn) return true; // the public homepage has its own header
  return pathname === "/workspace" || pathname.startsWith("/workspace/");
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/patient/case-file") {
    return PATIENT_HEALTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }
  const path = href.split("?")[0].split("#")[0];
  if (!path || path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The application shell: public header for visitors, role-aware navigation for signed-in
 * accounts, a skip link, and the page content. Navigation only shapes the menu; every page
 * and API route enforces access on the server.
 */
export function Navbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const { theme, toggleTheme } = useTheme();
  // The menu is open for one pathname only, so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const menuOpen = openFor === pathname;
  const setMenuOpen = (open: boolean | ((current: boolean) => boolean)) =>
    setOpenFor((previous) => ((typeof open === "function" ? open(previous === pathname) : open) ? pathname : null));
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenFor(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (hasOwnShell(pathname, Boolean(me))) return <>{children}</>;

  const blocked = me ? me.status === "SUSPENDED" || me.status === "BANNED" : false;
  const items = me && !blocked ? visibleNavigation(me.role, me.facility?.kind) : [];
  const bottom = me && !blocked ? getBottomNavigation(me.role) : [];
  const sidebarRole = me?.role === "PATIENT" || me?.role === "DOCTOR" || me?.role === "LAB_SCIENTIST";
  const prefetchFor = (href: string) => (me || isPublicPageHref(href) ? undefined : false);

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      data-testid="navbar-theme-toggle"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${focusRing}`}
    >
      {theme === "dark" ? <Sun className="h-4.5 w-4.5" aria-hidden="true" /> : <Moon className="h-4.5 w-4.5" aria-hidden="true" />}
    </button>
  );

  const linkClass = (active: boolean) =>
    `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${focusRing} ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a href="#main-content" className="sr-only z-100 rounded-md bg-background px-4 py-2 text-sm font-semibold text-foreground shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={me && !blocked ? ROLE_POLICY[me.role].dashboard : "/"} prefetch={prefetchFor("/")} aria-label="Medic1905 home" className={`flex shrink-0 items-center rounded-lg ${focusRing}`}>
            <Image src="/medic1905-logo.png" alt="Medic1905" width={116} height={45} className="h-8 w-auto" priority />
          </Link>

          {!me && (
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {PUBLIC_LINKS.map((link) => (
                <Link key={link.href} href={link.href} prefetch={prefetchFor(link.href)} aria-current={isActive(pathname, link.href) && !link.href.includes("#") ? "page" : undefined} className={linkClass(isActive(pathname, link.href) && !link.href.includes("#"))}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {themeButton}
            {me ? (
              <>
                {!blocked && (
                  <Link href="/notifications" aria-label="Notifications" className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground ${focusRing}`}>
                    <Bell className="h-4.5 w-4.5" aria-hidden="true" />
                  </Link>
                )}
                <span className="hidden max-w-56 truncate text-sm sm:inline" title={me.email}>
                  <span className="font-medium">{me.name}</span>
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{ROLE_POLICY[me.role].label}</span>
                </span>
                <div className="hidden sm:block"><SignOutButton /></div>
              </>
            ) : (
              <>
                <Link href="/auth/login" prefetch={false} data-testid="navbar-login" className={`hidden h-10 items-center rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted sm:inline-flex ${focusRing}`}>Login</Link>
                <Link href="/auth/signup" prefetch={false} data-testid="navbar-signup" className={`hidden h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:inline-flex ${focusRing}`}>Sign up</Link>
              </>
            )}
            {(!me || items.length > 0) && (
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                data-testid="navbar-mobile-menu"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted ${me && sidebarRole ? "lg:hidden" : "md:hidden"} ${focusRing}`}
              >
                {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background">
            <nav aria-label="Mobile" className="flex flex-col gap-1 px-4 py-4">
              {(me ? items.map((i) => ({ href: i.href, label: i.label })) : [...PUBLIC_LINKS]).map((link) => (
                <Link key={link.href + link.label} href={link.href} prefetch={prefetchFor(link.href)} aria-current={isActive(pathname, link.href) ? "page" : undefined} className={linkClass(isActive(pathname, link.href))}>
                  {link.label}
                </Link>
              ))}
              {me?.role === "PATIENT" && (
                <>
                  <p className="mt-3 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                  {PATIENT_ACCOUNT_NAVIGATION.map((link) => (
                    <Link key={link.href + link.label} href={link.href} prefetch={prefetchFor(link.href)} aria-current={isActive(pathname, link.href) ? "page" : undefined} className={linkClass(isActive(pathname, link.href))}>
                      {link.label}
                    </Link>
                  ))}
                </>
              )}
              {me && (
                <Link href="/contact" prefetch={prefetchFor("/contact")} aria-current={isActive(pathname, "/contact") ? "page" : undefined} className={`mt-2 border-t border-border pt-3 ${linkClass(isActive(pathname, "/contact"))}`}>
                  Help & report a problem
                </Link>
              )}
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                {me ? <SignOutButton /> : (
                  <>
                    <Link href="/auth/login" prefetch={false} className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-sm font-semibold">Login</Link>
                    <Link href="/auth/signup" prefetch={false} className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">Sign up</Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <div className={me && sidebarRole && items.length > 0 && !pathname.startsWith("/doctor/") ? "mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6" : "flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6"}>
        {me && sidebarRole && items.length > 0 && !pathname.startsWith("/doctor/") && (
          <aside className="hidden w-60 shrink-0 lg:block">
            <nav aria-label={`${ROLE_POLICY[me.role].label} navigation`} className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-0.5 overflow-y-auto pr-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href + item.label} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 ${linkClass(active)}`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
              {me.role === "PATIENT" && (
                <>
                  <p className="mt-3 border-t border-border px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                  {PATIENT_ACCOUNT_NAVIGATION.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link key={item.href + item.label} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 ${linkClass(active)}`}>
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
              <Link href="/contact" className={`mt-2 flex items-center gap-3 border-t border-border pt-3 ${linkClass(isActive(pathname, "/contact"))}`}>
                <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Help & report a problem</span>
              </Link>
            </nav>
          </aside>
        )}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">{me && <SubscriptionBanner />}{children}</main>
      </div>

      {me && bottom.length > 0 && (
        <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
          <ul className="mx-auto flex max-w-xl items-stretch justify-around">
            {bottom.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href + item.label} className="flex-1">
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"} ${focusRing}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {!me && <Footer />}
    </div>
  );
}
