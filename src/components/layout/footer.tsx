import Link from "next/link";
import {
  Apple, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter, Youtube,
} from "lucide-react";

const FOOTER_LINK_GROUPS = [
  {
    heading: "Patients",
    links: [
      { label: "Find a doctor", href: "/doctors" },
      { label: "Find a hospital", href: "/hospitals" },
      { label: "Find a laboratory", href: "/laboratories" },
      { label: "Find a diagnostic centre", href: "/diagnostic-centres" },
      { label: "Find a pharmacy", href: "/pharmacies" },
    ],
  },
  {
    heading: "Providers",
    links: [
      { label: "Register as a doctor", href: "/auth/signup" },
      { label: "Register a facility", href: "/auth/signup" },
      { label: "Provider dashboard", href: "/dashboard" },
      { label: "Subscription plans", href: "/pricing" },
      { label: "Help centre", href: "/help" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Health news", href: "/news" },
      { label: "Podcasts", href: "/podcasts" },
      { label: "Download app", href: "/app" },
      { label: "Contact support", href: "/contact" },
      { label: "Emergency support", href: "/emergency" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Cookies Policy", href: "/legal/cookies" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com", icon: Facebook },
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "X", href: "https://x.com", icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

const APP_LINKS = [
  {
    label: "Download for iOS",
    href: "#",
    icon: Apple,
  },
  {
    label: "Download for Android",
    href: "#",
    icon: SmartphoneIcon,
  },
  {
    label: "Download for Windows",
    href: "#",
    icon: MonitorIcon,
  },
];

function SmartphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="hidden border-t border-border bg-card md:block">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* Brand and contact */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Medic1905 home"
            >
              <span className="text-xl font-extrabold tracking-tight">
                Medic<span className="text-primary">1905</span>
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Medic1905 connects patients with verified doctors, hospitals, laboratories, diagnostic
              centres and pharmacies. Manage appointments, results, prescriptions and health records
              in one secure place.
            </p>

            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <a
                href="mailto:support@medic1905.com"
                className="inline-flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                support@medic1905.com
              </a>

              <p className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" aria-hidden="true" />
                +234 000 000 0000
              </p>

              <p className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Nigeria
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FOOTER_LINK_GROUPS.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </h3>

                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={`${group.heading}-${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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

        {/* App download */}
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-base font-semibold">Get the Medic1905 app</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Book care, follow results and manage your health records wherever you are.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {APP_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Legal and copyright */}
        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © 2026 Medic1905. Serving Nigeria. All rights reserved.
          </p>

          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-4">
              {LEGAL_LINKS.map((link) => (
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
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
          Medic1905 is a healthcare platform, not a medical provider. Doctors and facilities are
          responsible for clinical decisions. AI-generated content is informational only and does
          not replace professional medical advice.
        </p>
      </div>
    </footer>
  );
}
