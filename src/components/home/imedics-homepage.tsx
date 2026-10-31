"use client";

import { useState } from "react";
import Image from "next/image";
import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import {
  Calendar, ChevronDown, FileText, Mic, Newspaper, FlaskConical, FolderOpen,
  HeartPulse, Menu, MessageCircle, Moon, Sparkles, Stethoscope, Star, Sun, X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { HomeAdsCarousel } from "@/components/home/home-ads-carousel";
import { HomeSingleAdBanner } from "@/components/home/home-single-ad-banner";
import {
  IMEDICS_FAQS, IMEDICS_FEATURED_PANEL, IMEDICS_FOOTER_LINKS,
  IMEDICS_HOW_IT_WORKS_STEPS, IMEDICS_SERVICE_CARDS, type ImedicsServiceCard, type ImedicsHomeSlide,
} from "@/lib/home/imedics-home-content";

/** A simple ad from the admin content manager (no clinical data, ever). */
export interface ImedicsHomeAd {
  title: string;
  content: string;
  /** Optional https image shown with the ad. */
  imageUrl?: string | null;
  /** Optional https destination; opens in a new tab when set. */
  linkUrl?: string | null;
}

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
  { href: "#ratings", label: "Ratings" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

export interface TopRatedDoctor {
  id: string;
  name: string;
  specialty: string | null;
  ratingAvg: number;
  ratingCount: number;
}

export type TopRatedFacilityType = "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE" | "PHARMACY";

export interface TopRatedFacility {
  id: string;
  name: string;
  type: TopRatedFacilityType;
  slug: string | null;
  ratingAvg: number;
  ratingCount: number;
}

const FACILITY_TYPE_ROUTES: Record<TopRatedFacilityType, { directory: string; profile: string; label: string; plural: string }> = {
  HOSPITAL: { directory: "/hospitals", profile: "/hospitals", label: "Hospital", plural: "hospitals" },
  LABORATORY: { directory: "/laboratories", profile: "/laboratories", label: "Laboratory", plural: "laboratories" },
  DIAGNOSTIC_CENTRE: { directory: "/diagnostic-centres", profile: "/diagnostic-centres", label: "Diagnostic centre", plural: "diagnostic centres" },
  PHARMACY: { directory: "/pharmacies", profile: "/pharmacies", label: "Pharmacy", plural: "pharmacies" },
};

interface RatingCardData {
  id: string;
  href: string;
  name: string;
  subtitle: string;
  ratingAvg: number;
  ratingCount: number;
}

/** One rated group (doctors, or one facility type) with an honest empty state. */
function RatingGroup({
  heading, browseHref, browseLabel, emptyText, cards,
}: {
  heading: string;
  browseHref: string;
  browseLabel: string;
  emptyText: string;
  cards: RatingCardData[];
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <Link
          href={browseHref}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {browseLabel}
        </Link>
      </div>
      {cards.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => (
            <Link
              key={card.id}
              href={card.href}
              data-testid={`link-top-rated-${card.id}`}
              className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-1" aria-label={`Rated ${card.ratingAvg.toFixed(1)} out of 5 from ${card.ratingCount} reviews`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 ${i < Math.round(card.ratingAvg) ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`}
                  />
                ))}
                <span className="ml-1 text-xs font-semibold">{card.ratingAvg.toFixed(1)}</span>
              </span>
              <span className="mt-2 truncate text-sm font-semibold">{card.name}</span>
              <span className="mt-0.5 text-xs text-muted-foreground">{card.subtitle}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                {card.ratingCount} patient {card.ratingCount === 1 ? "review" : "reviews"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  // Medic1905 logo with the background removed. In dark mode it sits on a
  // small white chip so the navy wordmark stays visible; hover feedback on
  // the surrounding link signals it is clickable.
  return (
    <Image
      src="/medic1905-logo.png"
      alt="Medic1905"
      width={465}
      height={180}
      priority
      className={`w-auto dark:rounded-lg dark:bg-white dark:p-1.5 dark:shadow-sm ${className ?? "h-9"}`}
    />
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

export function ImedicsHomepage({
  topDoctors,
  topFacilities,
  carouselAds,
  bannerAd,
}: {
  topDoctors: TopRatedDoctor[];
  topFacilities: TopRatedFacility[];
  /** Active HOMEPAGE_CAROUSEL ads; replace the built-in carousel slides when set. */
  carouselAds?: ImedicsHomeAd[];
  /** The active HOMEPAGE_BANNER ad; the built-in default is used when absent. */
  bannerAd?: ImedicsHomeAd | null;
}) {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin-managed ads are mapped onto the carousel's slide format — they are
  // plain promotional content and never carry clinical data.
  const adSlides: ImedicsHomeSlide[] | undefined = carouselAds
    ? carouselAds.map((ad, i) => ({
        id: `ad-${i}`,
        title: ad.title,
        description: ad.content,
        ctaHref: ad.linkUrl || "/facilities",
        ctaLabel: ad.linkUrl ? "Learn more" : "Explore facilities",
        icon: "sparkles",
        image: ad.imageUrl ?? undefined,
      }))
    : undefined;

  return (
    <div className="im-mono flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Medic1905 home">
            <BrandMark className="h-10" />
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Welcome to Medic1905</p>
          <h1 id="welcome-heading" className="mt-2 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Healthcare, all in one place.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Discover medical resources, explore healthcare services, and find the information you
            need to take your next step with confidence.
          </p>
        </section>

        {/* Sliding highlights card */}
        <div className="pb-2">
          <HomeAdsCarousel slides={adSlides} />
        </div>

        {/* Single sponsored banner */}
        <HomeSingleAdBanner ad={bannerAd} />

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

        {/* Patient ratings — real aggregates from published reviews, shown
            separately for doctors and each facility type. */}
        <section id="ratings" aria-labelledby="ratings-heading" className="mx-auto w-full max-w-5xl px-4 pt-12">
          <h2 id="ratings-heading" className="text-base font-semibold">Patient ratings</h2>

          <RatingGroup
            heading="Top-rated doctors"
            browseHref="/doctors"
            browseLabel="Browse doctors"
            emptyText="No published doctor ratings yet."
            cards={topDoctors.map(doctor => ({
              id: doctor.id,
              href: `/doctors/${doctor.id}`,
              name: doctor.name,
              subtitle: doctor.specialty ?? "Doctor",
              ratingAvg: doctor.ratingAvg,
              ratingCount: doctor.ratingCount,
            }))}
          />

          {(Object.keys(FACILITY_TYPE_ROUTES) as TopRatedFacilityType[]).map(type => {
            const route = FACILITY_TYPE_ROUTES[type];
            return (
              <RatingGroup
                key={type}
                heading={`Top-rated ${route.plural}`}
                browseHref={route.directory}
                browseLabel={`Browse ${route.plural}`}
                emptyText={`No published ${route.plural} ratings yet.`}
                cards={topFacilities
                  .filter(facility => facility.type === type)
                  .map(facility => ({
                    id: facility.id,
                    href: facility.slug ? `${route.profile}/${facility.slug}` : route.directory,
                    name: facility.name,
                    subtitle: route.label,
                    ratingAvg: facility.ratingAvg,
                    ratingCount: facility.ratingCount,
                  }))}
              />
            );
          })}
        </section>

        {/* News and podcasts: the pages show "coming soon" until the feature is switched on. */}
        <section aria-labelledby="media-heading" className="mx-auto w-full max-w-5xl px-4 pt-12">
          <h2 id="media-heading" className="text-base font-semibold">News and podcasts</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/news", title: "Health news", text: "Updates and guidance from the Medic1905 team.", icon: Newspaper },
              { href: "/podcasts", title: "Podcasts", text: "Conversations with doctors and care teams.", icon: Mic },
            ].map(({ href, title, text, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
                </span>
              </Link>
            ))}
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
              <BrandMark className="h-8" />
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
          © 2026 Medic1905. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
