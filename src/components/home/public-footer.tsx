import Link from "next/link";
import { EMERGENCY_NUMBERS } from "@/lib/home/content";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "For patients",
    links: [
      { href: "/doctors", label: "Find a doctor" },
      { href: "/facilities", label: "Find a laboratory or diagnostic centre" },
      { href: "/doctors", label: "Book a consultation" },
      { href: "/auth/signup", label: "Create a free account" },
    ],
  },
  {
    heading: "For providers",
    links: [
      { href: "/auth/signup", label: "Register as a doctor" },
      { href: "/auth/signup", label: "Register a hospital or facility" },
      { href: "/pricing", label: "Subscription plans" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#trust-safety", label: "Trust and safety" },
      { href: "/#providers", label: "For providers" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/cookies", label: "Cookie policy" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M2 12h20" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight">Medic1905</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quality healthcare, wherever you are. A platform connecting patients with verified doctors,
              laboratories, hospitals, and diagnostic centres across Nigeria.
            </p>
            <p className="disclaimer-box p-3 text-xs text-muted-foreground">
              <strong>Emergencies:</strong> call {EMERGENCY_NUMBERS.national} (national) or {EMERGENCY_NUMBERS.lagos} (Lagos) or go to
              the nearest hospital. Medic1905 is a platform, not an emergency service.
            </p>
          </div>
          {COLUMNS.map(column => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-sm font-semibold">{column.heading}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map(link => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Medic1905. Serving Nigeria. All rights reserved. Medic1905 is a platform
          only, not a medical provider. AI content is informational.
        </p>
      </div>
    </footer>
  );
}