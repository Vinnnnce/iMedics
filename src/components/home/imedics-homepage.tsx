"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, ChevronDown, FileText, FlaskConical, FolderOpen, HeartPulse,
  Menu, MessageCircle, Moon, Sparkles, Stethoscope, Sun, X, type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  IMEDICS_FAQS, IMEDICS_FEATURED_PANEL, IMEDICS_FOOTER_LINKS,
  IMEDICS_HOW_IT_WORKS_STEPS, IMEDICS_SERVICE_CARDS, type ImedicsServiceCard,
} from "@/lib/home/imedics-home-content";

const SERVICE_ICONS: Record<ImedicsServiceCard["icon"], LucideIcon> = {
  stethoscope: Stethoscope,
  "message-circle": MessageCircle,
  calendar: Calendar,
  flask: FlaskConical,
  folder: FolderOpen,
  "file-text": FileText,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
};

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-lg bg-foreground text-background ${className ?? "h-8 w-8"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M12 4v16M4 12h16" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ServiceCard({ card }: { card: ImedicsServiceCard }) {
  const Icon = SERVICE_ICONS[card.icon];
  return (
    <Link
      href={card.href}
      data-testid={`link-service-${card.icon}`}
      className="im-service-card group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-3 text-sm font-semibold">{card.title}</span>
      <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.description}</span>
      <span className="mt-3 text-[11px] font-medium text-muted-foreground">
        {card.access === "public" ? "No account needed" : "Free account required"}
      </span>
    </Link>
  );
}

export function ImedicsHomepage() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="im-mono flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="i-Medics home">
            <BrandMark />
            <span className="text-base font-bold tracking-tight">i-Medics</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              data-testid="button-home-theme-toggle"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <Link
              href="/auth/login"
              data-testid="link-home-login"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:inline"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              data-testid="link-home-signup"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              aria-expanded={menuOpen}
              aria-controls="im-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              data-testid="button-home-mobile-menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {menuOpen && (
          <nav
            id="im-mobile-menu"
            aria-label="Mobile"
            className="border-t border-border bg-background px-4 py-3 md:hidden"
          >
            <ul className="flex flex-col">
              {NAV_LINKS.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <Link
                href="/auth/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-center text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-foreground px-4 py-2 text-center text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Sign up
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-16">
        {/* Welcome area — deliberately compact; the service grid is the page */}
        <section aria-labelledby="welcome-heading" className="mx-auto w-full max-w-5xl px-4 pb-8 pt-10 md:pt-14">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Welcome to i-Medics</p>
          <h1 id="welcome-heading" className="mt-2 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Healthcare, all in one place.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Discover medical resources, explore healthcare services, and find the information you
            need to take your next step with confidence.
          </p>
        </section>

        {/* Service grid — compact app-hub tiles */}
        <section id="services" aria-labelledby="services-heading" className="mx-auto w-full max-w-5xl px-4">
          <h2 id="services-heading" className="text-base font-semibold">Explore services</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {IMEDICS_SERVICE_CARDS.map(card => (
              <ServiceCard key={card.href} card={card} />
            ))}
          </div>
        </section>

        {/* Featured panel */}
        <section aria-labelledby="featured-heading" className="mx-auto w-full max-w-5xl px-4 pt-10">
          <div className="rounded-2xl bg-foreground p-6 text-background md:flex md:items-center md:justify-between md:p-8">
            <div className="max-w-xl">
              <h2 id="featured-heading" className="text-lg font-bold tracking-tight md:text-xl">
                {IMEDICS_FEATURED_PANEL.heading}
              </h2>
              <p className="mt-1 text-sm leading-relaxed opacity-80">
                {IMEDICS_FEATURED_PANEL.description}
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3 md:mt-0 md:flex-row md:items-center">
              <Link
                href={IMEDICS_FEATURED_PANEL.ctaHref}
                data-testid="link-featured-open"
                className="rounded-full bg-background px-5 py-2.5 text-center text-sm font-semibold text-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
              >
                {IMEDICS_FEATURED_PANEL.cta}
              </Link>
              <Link
                href={IMEDICS_FEATURED_PANEL.secondaryCtaHref}
                className="rounded-full border border-background/40 px-5 py-2.5 text-center text-sm font-semibold text-background transition-colors hover:border-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
              >
                {IMEDICS_FEATURED_PANEL.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto w-full max-w-5xl px-4 pt-12">
          <h2 id="how-heading" className="text-base font-semibold">How it works</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {IMEDICS_HOW_IT_WORKS_STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background"
                >
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto w-full max-w-5xl px-4 pt-12">
          <h2 id="faq-heading" className="text-base font-semibold">Frequently asked questions</h2>
          <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {IMEDICS_FAQS.map(faq => (
              <details key={faq.question} className="group px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark className="h-7 w-7" />
              <span className="text-base font-bold tracking-tight">i-Medics</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              A healthcare platform, not a medical provider. Doctors and facilities are responsible
              for clinical decisions; AI content is informational only.
            </p>
          </div>
          {IMEDICS_FOOTER_LINKS.map(group => (
            <nav key={group.heading} aria-label={group.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.heading}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
          © 2026 i-Medics. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
