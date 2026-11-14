import Link from "next/link";
import { Download, ShieldCheck, Smartphone } from "lucide-react";

// Brand glyphs (lucide-react no longer ships brand icons).
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-.833 0-1.721.249-2.171.515-.441.262-.507.424-.507 1.085v1.37h3.053l-.312 2.711h-2.74v7.978z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

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
  { label: "Facebook", href: "https://facebook.com", icon: FacebookIcon },
  { label: "Instagram", href: "https://instagram.com", icon: InstagramIcon },
  { label: "X", href: "https://x.com", icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedinIcon },
  { label: "YouTube", href: "https://youtube.com", icon: YoutubeIcon },
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
        {/* Top footer: brand, description, app download and social links */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg text-xl font-extrabold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Medic<span className="text-primary">1905</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A healthcare platform connecting patients with verified doctors, hospitals,
              laboratories, diagnostic centres and pharmacies across Nigeria.
            </p>

            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Secure records · Role-based access
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold">Download the Medic1905 app</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Book care, follow results and manage your health records anywhere.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {APP_LINKS.map((app) => (
                  <a
                    key={app.label}
                    href={app.href}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    {app.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_NAVIGATION.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </h3>

                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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

        {/* Bottom bar: legal links and app download */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 lg:flex-row">
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            © 2026 Medic1905. Serving Nigeria. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-end">
            <Link
              href="/legal/privacy"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Privacy Policy
            </Link>

            <Link
              href="/legal/terms"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Terms of Use
            </Link>

            <Link
              href="/legal/cookies"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Cookies Policy
            </Link>

            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />

            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download App:
            </span>

            {APP_LINKS.map((app) => (
              <a
                key={`bottom-${app.label}`}
                href={app.href}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                {app.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;