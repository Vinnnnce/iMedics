import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Building2, CreditCard,
  FileText, FlaskConical, HeartPulse, Lock, Receipt, Search, ShieldCheck,
  Smartphone, Stethoscope, TrendingUp, Video, type LucideIcon,
} from "lucide-react";
import {
  HERO_TRUST_BADGES, HOW_IT_WORKS_STEPS, PROVIDER_BENEFITS, SERVICE_CARDS, TRUST_ITEMS,
} from "@/lib/home/content";
import { FAQS } from "@/lib/faqs";
import { FaqSection } from "@/components/shared/faq-section";
import { HOMEPAGE_SUGGESTIONS } from "@/lib/suggestions";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { SpecialtyGrid } from "./specialty-grid";
import { PublicFooter } from "./public-footer";

const TRUST_ICONS = [BadgeCheck, Lock, Receipt, FileText, ShieldCheck, Bell];
const SERVICE_ICONS: readonly LucideIcon[] = [
  Stethoscope,
  FlaskConical,
  Activity,
  Building2,
];

function QuickTile({
  title,
  description,
  href,
  cta,
  icon: Icon,
  wide = false,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <div>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>

        <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {cta}

        <ArrowUpRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function PublicHomepage() {
  return (
    <>
      <div className="space-y-14 pb-6 md:space-y-20" id="home">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto w-full max-w-7xl px-4 pt-8 md:px-6 md:pt-14 lg:px-8"
        >
          <div className="hero-card beeline-card p-6 md:p-10 lg:p-12">
            <div className="beeline-card-content grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
              <div>
                <div className="flex items-center gap-2">
                  <HeartPulse aria-hidden="true" className="h-5 w-5 text-foreground" />

                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Medic1905 · Nigeria
                  </span>
                </div>

                <h1
                  id="hero-heading"
                  className="beeline-glow mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl xl:text-6xl"
                >
                  Quality healthcare,
                  <br />
                  wherever you are.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  Consult verified doctors, book laboratory tests, access diagnostic centres, and
                  manage your health records securely on Medic1905.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/doctors"
                    className="pill-btn pill-btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
                  >
                    <Search aria-hidden="true" className="h-4 w-4" />
                    Find a doctor
                  </Link>

                  <Link
                    href="/doctors"
                    className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
                  >
                    <Video aria-hidden="true" className="h-4 w-4" />
                    Book a consultation
                  </Link>

                  <Link
                    href="/laboratories"
                    className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
                  >
                    <FlaskConical aria-hidden="true" className="h-4 w-4" />
                    Find a laboratory
                  </Link>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/auth/signup"
                    className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm sm:w-auto"
                  >
                    Register as a doctor
                  </Link>

                  <Link
                    href="/auth/signup"
                    className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm sm:w-auto"
                  >
                    Register a facility
                  </Link>
                </div>

                <ul
                  className="mt-6 flex flex-wrap gap-2"
                  aria-label="Why you can trust Medic1905"
                >
                  {HERO_TRUST_BADGES.map((badge) => (
                    <li
                      key={badge}
                      className="pill-btn pill-btn-outline px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {badge}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative hidden aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border lg:block">
                <div className="flex h-full w-full flex-col justify-between bg-accent p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                    Secure health records
                  </div>

                  <div className="space-y-3">
                    <p className="text-2xl font-bold leading-tight">
                      Doctors, hospitals, laboratories and pharmacies in one place.
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Find care, book appointments and follow your results securely.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
                      Get started
                    </span>

                    <span className="text-xs text-muted-foreground">No clinical data in ads</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick-access tiles */}
        <section
          aria-labelledby="quick-links-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <h2 id="quick-links-heading" className="sr-only">
            Quick links
          </h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickTile
              title="For patients"
              description="Find trusted doctors, hospitals, laboratories, diagnostic centres and pharmacies."
              href="/facilities"
              cta="Explore care"
              icon={HeartPulse}
              wide
            />

            <QuickTile
              title="Book an appointment"
              description="Choose a verified doctor and book a consultation at a convenient time."
              href="/doctors"
              cta="Book now"
              icon={Stethoscope}
            />

            <QuickTile
              title="Laboratory tests"
              description="Browse laboratory and diagnostic services, preparation guidance and results."
              href="/laboratories"
              cta="Find a laboratory"
              icon={FlaskConical}
            />

            <QuickTile
              title="Health records"
              description="Keep prescriptions, results and case information organised in one secure place."
              href="/dashboard"
              cta="Open records"
              icon={FileText}
            />
          </div>
        </section>

        {/* Services */}
        <section
          aria-labelledby="services-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="services-heading"
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                Care for every step of your health journey
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                Four services, one secure health record.
              </p>
            </div>

            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              See all services
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {SERVICE_CARDS.map((service, index) => {
              const Icon = SERVICE_ICONS[index];

              return (
                <article
                  key={service.title}
                  className="module-card group flex h-full flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="icon-badge" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-4 text-base font-semibold">{service.title}</h3>

                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>

                  <Link
                    href={service.href}
                    className="pill-btn pill-btn-primary mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
                  >
                    {service.cta}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section
          aria-labelledby="how-heading"
          id="how-it-works"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
            How it works
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            From account creation to results and follow-up, in six steps.
          </p>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <li
                key={step}
                className="module-card flex items-start gap-4 p-5 transition-colors hover:border-foreground/40"
              >
                <span
                  className="pill-btn pill-btn-primary shrink-0 px-3 py-1.5 text-xs font-bold"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <p className="text-sm font-medium leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Featured specialties */}
        <section
          aria-labelledby="specialties-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="specialties-heading"
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                Featured specialties
              </h2>

              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Find verified doctors by specialty.
              </p>
            </div>

            <Link
              href="/doctors"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Browse all doctors
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6">
            <SpecialtyGrid />
          </div>
        </section>

        {/* Trust and safety */}
        <section
          aria-labelledby="trust-heading"
          id="trust-safety"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="module-card p-6 md:p-10">
            <h2
              id="trust-heading"
              className="text-2xl font-bold tracking-tight md:text-3xl"
            >
              Trust and safety
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Your health data is protected at every step.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {TRUST_ITEMS.map((item, index) => {
                const Icon = TRUST_ICONS[index] ?? ShieldCheck;

                return (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className="icon-badge shrink-0" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="text-sm font-medium leading-relaxed">{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* For providers */}
        <section
          aria-labelledby="providers-heading"
          id="providers"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="module-card p-6 md:p-10">
            <div className="flex items-center gap-3">
              <TrendingUp aria-hidden="true" className="h-6 w-6 text-foreground" />

              <h2
                id="providers-heading"
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                Grow your practice with Medic1905.
              </h2>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Join verified doctors, hospitals, laboratories, diagnostic centres and pharmacies on
              the platform.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {PROVIDER_BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <BadgeCheck
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                  />

                  <span className="text-sm leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/auth/signup"
                className="pill-btn pill-btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                <Stethoscope aria-hidden="true" className="h-4 w-4" />
                Register as a doctor
              </Link>

              <Link
                href="/auth/signup"
                className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                <Building2 aria-hidden="true" className="h-4 w-4" />
                Register a facility
              </Link>

              <Link
                href="/pricing"
                className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                <CreditCard aria-hidden="true" className="h-4 w-4" />
                View subscription plans
              </Link>
            </div>
          </div>
        </section>

        {/* Suggestions */}
        <section
          aria-labelledby="suggestions-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <h2
            id="suggestions-heading"
            className="text-2xl font-bold tracking-tight md:text-3xl"
          >
            Get started with Medic1905
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            A few ways to begin, whether you are seeking care or providing it.
          </p>

          <div className="mt-6">
            <SuggestionsCard
              items={HOMEPAGE_SUGGESTIONS}
              title="Suggested for you"
            />
          </div>
        </section>

        {/* App callout */}
        <section
          aria-labelledby="app-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="module-card grid items-center gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:p-10">
            <div>
              <h2
                id="app-heading"
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                Everything under control in the app
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Book appointments, follow results, manage prescriptions and keep your health records
                organised wherever you are.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/app"
                className="pill-btn pill-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold"
              >
                <Smartphone aria-hidden="true" className="h-4 w-4" />
                Download app
              </Link>

              <Link
                href="/help"
                className="pill-btn pill-btn-outline inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold"
              >
                Learn more
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <FaqSection
          items={FAQS.GENERAL}
          intro="Common questions about Medic1905. Signed-in users can find answers tailored to their account type on their dashboard."
        />

        {/* Closing CTA */}
        <section
          aria-labelledby="cta-heading"
          className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8"
        >
          <div className="module-card flex flex-col items-start gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="space-y-2">
              <h2
                id="cta-heading"
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                Ready to take charge of your health?
              </h2>

              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Create a free account and book your first consultation in minutes.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link
                href="/auth/signup"
                className="pill-btn pill-btn-primary inline-flex items-center justify-center px-6 py-3 text-sm font-semibold"
              >
                Get started free
              </Link>

              <Link
                href="/auth/login"
                className="pill-btn pill-btn-outline inline-flex items-center justify-center px-6 py-3 text-sm font-semibold"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <PublicFooter />
    </>
  );
}
