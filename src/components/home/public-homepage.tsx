import Link from "next/link";
import {
  Activity, BadgeCheck, Bell, Building2, CreditCard, FileText, FlaskConical,
  HeartPulse, Lock, Receipt, Search, ShieldCheck, Stethoscope, TrendingUp, Video,
  type LucideIcon,
} from "lucide-react";
import {
  HERO_TRUST_BADGES, HOW_IT_WORKS_STEPS, PROVIDER_BENEFITS, SERVICE_CARDS, TRUST_ITEMS,
} from "@/lib/home/content";
import { FAQS } from "@/lib/faqs";
import { FaqSection } from "@/components/shared/faq-section";
import { SpecialtyGrid } from "./specialty-grid";
import { PublicFooter } from "./public-footer";

const TRUST_ICONS = [BadgeCheck, Lock, Receipt, FileText, ShieldCheck, Bell];
const SERVICE_ICONS: readonly LucideIcon[] = [Stethoscope, FlaskConical, Activity, Building2];

export function PublicHomepage() {
  return (
    <>
      <div className="space-y-16 pb-4 md:space-y-20" id="home">
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-14">
          <div className="hero-card beeline-card p-6 md:p-10">
            <div className="beeline-card-content">
              <div className="flex items-center gap-2">
                <HeartPulse aria-hidden="true" className="h-5 w-5 text-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Medic1905 · Nigeria
                </span>
              </div>
              <h1 id="hero-heading" className="beeline-glow text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                Quality healthcare, wherever you are.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Consult verified doctors, book laboratory tests, access diagnostic centres, and manage your health
                records securely on Medic1905.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/doctors" className="pill-btn pill-btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                  <Search aria-hidden="true" className="h-4 w-4" /> Find a doctor
                </Link>
                <Link href="/doctors" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                  <Video aria-hidden="true" className="h-4 w-4" /> Book a consultation
                </Link>
                <Link href="/laboratories" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                  <FlaskConical aria-hidden="true" className="h-4 w-4" /> Find a laboratory or diagnostic centre
                </Link>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link href="/auth/signup" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm sm:w-auto">
                  Register as a doctor
                </Link>
                <Link href="/auth/signup" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm sm:w-auto">
                  Register a hospital or diagnostic centre
                </Link>
              </div>
              <ul className="flex flex-wrap gap-2 pt-2" aria-label="Why you can trust Medic1905">
                {HERO_TRUST_BADGES.map(badge => (
                  <li key={badge} className="pill-btn pill-btn-outline px-3 py-1 text-xs font-medium text-muted-foreground">
                    {badge}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Quick-access services */}
        <section aria-labelledby="services-heading" className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 id="services-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
            Care for every step of your health journey
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Four services, one secure health record.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_CARDS.map((service, index) => {
              const Icon = SERVICE_ICONS[index];
              return (
                <article key={service.title} className="module-card flex flex-col">
                  <div className="icon-badge" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{service.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{service.description}</p>
                  <Link
                    href={service.href}
                    className="pill-btn pill-btn-primary mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
                  >
                    {service.cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading" id="how-it-works" className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            From account creation to results and follow-up, in six steps.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <li key={step} className="module-card flex items-start gap-4">
                <span className="pill-btn pill-btn-primary shrink-0 px-2.5 py-1 text-xs font-bold" aria-hidden="true">
                  {index + 1}
                </span>
                <p className="text-sm font-medium">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Featured specialties */}
        <section aria-labelledby="specialties-heading" className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 id="specialties-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
            Featured specialties
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Find verified doctors by specialty.
          </p>
          <div className="mt-6">
            <SpecialtyGrid />
          </div>
        </section>

        {/* Trust and safety */}
        <section aria-labelledby="trust-heading" id="trust-safety" className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="module-card p-6 md:p-10">
            <h2 id="trust-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
              Trust and safety
            </h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Your health data is protected at every step.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TRUST_ITEMS.map((item, index) => {
                const Icon = TRUST_ICONS[index] ?? ShieldCheck;
                return (
                  <li key={item} className="flex items-start gap-3">
                    <span className="icon-badge shrink-0" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* For providers */}
        <section aria-labelledby="providers-heading" id="providers" className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="module-card p-6 md:p-10">
            <div className="flex items-center gap-2">
              <TrendingUp aria-hidden="true" className="h-5 w-5 text-foreground" />
              <h2 id="providers-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
                Grow your practice with Medic1905.
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Join verified doctors, hospitals, laboratories, and diagnostic centres on the platform.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {PROVIDER_BENEFITS.map(benefit => (
                <li key={benefit} className="flex items-start gap-2">
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span className="text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/auth/signup" className="pill-btn pill-btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                <Stethoscope aria-hidden="true" className="h-4 w-4" /> Register as a doctor
              </Link>
              <Link href="/auth/signup" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                <Building2 aria-hidden="true" className="h-4 w-4" /> Register a facility
              </Link>
              <Link href="/pricing" className="pill-btn pill-btn-outline inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                <CreditCard aria-hidden="true" className="h-4 w-4" /> View subscription plans
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
        <section aria-labelledby="cta-heading" className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="module-card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="space-y-1">
              <h2 id="cta-heading" className="text-lg font-bold md:text-xl">
                Ready to take charge of your health?
              </h2>
              <p className="text-sm text-muted-foreground">
                Create a free account and book your first consultation in minutes.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link href="/auth/signup" className="pill-btn pill-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
                Get started free
              </Link>
              <Link href="/auth/login" className="pill-btn pill-btn-outline inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
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