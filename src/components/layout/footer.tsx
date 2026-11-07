import Link from "next/link";
import {
  Download,
  Facebook,
  Instagram,
  Linkedin,
  ShieldCheck,
  Smartphone,
  Twitter,
  Youtube,
} from "lucide-react";

const FOOTER_NAVIGATION = [
  {
    heading: "Patients",
    links: [
      { label: "Find a doctor", href: "/doctors" },
      { label: "Find a laboratory", href: "/laboratories" },
      { label: "Diagnostic centres", href: "/diagnostic-centres" },
      { label: "Find a pharmacy", href: "/pharmacies" },
      { label: "Book appointment", href: "/doctors" },
    ],
  },
  {
    heading: "Providers",
    links: [
      { label: "For doctors", href: "/doctors/register" },
      { label: "For hospitals", href: "/hospitals/register" },
      { label: "For laboratories", href: "/laboratories/register" },
      { label: "For pharmacies", href: "/pharmacies/register" },
      { label: "Subscription plans", href: "/pricing" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Health records", href: "/dashboard" },
      { label: "Health news", href: "/news" },
      { label: "Podcasts", href: "/podcasts" },
      { label: "Help centre", href: "/help" },
      { label: "Contact support", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Terms of use", href: "/legal/terms" },
      { label: "Cookies policy", href: "/legal/cookies" },
      { label: "Accessibility", href: "/legal/accessibility" },
      { label: "Report an issue", href: "/contact" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com", icon: Facebook },
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "X", href: "https://x.com", icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

const APP_LINKS = [
  { label: "iOS", href: "/app/ios" },
  { label: "Android", href: "/app/android" },
  { label: "Windows", href: "/app/windows" },
];

export function Footer() {
  return (
    <footer className="hidden border-t border-border bg-card md:block">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
        {/* Brand, app downloads, social links, and navigation */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <Link
              href="/"
              aria-label="Medic1905 home"
              className="inline-flex items-center rounded-lg text-xl font-extrabold tracking-tight text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Medic<span className="text-primary">1905</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A healthcare platform connecting patients with verified doctors,
              hospitals, laboratories, diagnostic centres and pharmacies across
              Nigeria.
            </p>

            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              Secure records · Role-based access
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground">
                Download the Medic1905 app
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Book care, follow results and manage your health records
                anywhere.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {APP_LINKS.map((app) => (
                  <Link
                    key={app.label}
                    href={app.href}
                    aria-label={`Download Medic1905 for ${app.label}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Smartphone
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {app.label}
                  </Link>
                ))}
              </div>
            </div>

            <div
              className="mt-6 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Social media"
            >
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (opens in a new tab)`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Footer navigation groups */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_NAVIGATION.map((group) => (
              <nav
                key={group.heading}
                aria-label={`${group.heading} footer navigation`}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </h3>

                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Copyright, legal links, and app shortcuts */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 lg:flex-row">
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            © 2026 Medic1905. Serving Nigeria. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-end">
            <Link
              href="/legal/privacy"
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Privacy Policy
            </Link>

            <Link
              href="/legal/terms"
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Terms of Use
            </Link>

            <Link
              href="/legal/cookies"
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Cookies Policy
            </Link>

            <span
              className="hidden h-4 w-px bg-border sm:block"
              aria-hidden="true"
            />

            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download App:
            </span>

            {APP_LINKS.map((app) => (
              <Link
                key={`bottom-${app.label}`}
                href={app.href}
                aria-label={`Download Medic1905 for ${app.label}`}
                className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Smartphone
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {app.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
