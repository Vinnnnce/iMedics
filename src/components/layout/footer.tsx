import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const FOOTER_NAVIGATION = [
  {
    heading: "Patients",
    links: [
      { label: "Find a doctor", href: "/doctors" },
      { label: "Find a laboratory", href: "/laboratories" },
      { label: "Diagnostic centres", href: "/diagnostic-centres" },
      { label: "Find a pharmacy", href: "/pharmacies" },
          ],
  },
  {
    heading: "Providers",
    links: [
      { label: "Join as a doctor or facility", href: "/auth/signup" },
      { label: "Pricing", href: "/pricing" },
      { label: "About Medic1905", href: "/about" },
    ],
  },
  {
    heading: "Platform",
    links: [
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
      { label: "Report an issue", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
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

          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;