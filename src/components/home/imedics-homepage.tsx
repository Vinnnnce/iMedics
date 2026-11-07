"use client";

import { useState } from "react";
import Image from "next/image";
import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import {
ArrowRight, ArrowUpRight, Building2, Calendar, ChevronDown, FileText, FlaskConical,
FolderOpen, HeartPulse, Mail, Menu, MessageCircle, Mic, Moon, Newspaper, Pill,
ShieldCheck, Smartphone, Sparkles, Star, Stethoscope, Sun, X, type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { HomeAdsCarousel } from "@/components/home/home-ads-carousel";
import { HomeSingleAdBanner } from "@/components/home/home-single-ad-banner";
import {
IMEDICS_AUDIENCES, IMEDICS_BENEFITS, IMEDICS_CONTACT, IMEDICS_FAQS,
IMEDICS_FEATURED_PANEL, IMEDICS_FOOTER_LINKS, IMEDICS_HOW_IT_WORKS_STEPS,
IMEDICS_IMAGE_CREDITS, IMEDICS_NAV_LINKS, IMEDICS_SERVICE_CARDS,
type ImedicsServiceCard, type ImedicsHomeSlide,
} from "@/lib/home/imedics-home-content";

export interface ImedicsHomeAd {
title: string;
content: string;
imageUrl?: string | null;
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

export interface TopRatedDoctor {
id: string;
name: string;
specialty: string | null;
ratingAvg: number;
ratingCount: number;
}

export type TopRatedFacilityType =
| "HOSPITAL"
| "LABORATORY"
| "DIAGNOSTIC_CENTRE"
| "PHARMACY";

export interface TopRatedFacility {
id: string;
name: string;
type: TopRatedFacilityType;
slug: string | null;
ratingAvg: number;
ratingCount: number;
}

const FACILITY_TYPE_ROUTES: Record<
TopRatedFacilityType,
{ directory: string; profile: string; label: string; plural: string }

= {
HOSPITAL: {
directory: "/hospitals",
profile: "/hospitals",
label: "Hospital",
plural: "hospitals",
},
LABORATORY: {
directory: "/laboratories",
profile: "/laboratories",
label: "Laboratory",
plural: "laboratories",
},
DIAGNOSTIC_CENTRE: {
directory: "/diagnostic-centres",
profile: "/diagnostic-centres",
label: "Diagnostic centre",
plural: "diagnostic centres",
},
PHARMACY: {
directory: "/pharmacies",
profile: "/pharmacies",
label: "Pharmacy",
plural: "pharmacies",
},
};

interface RatingCardData {
id: string;
href: string;
name: string;
subtitle: string;
ratingAvg: number;
ratingCount: number;
}

function RatingGroup({
heading,
browseHref,
browseLabel,
emptyText,
cards,
}: {
heading: string;
browseHref: string;
browseLabel: string;
emptyText: string;
cards: RatingCardData[];
}) {
return (
<div className="mt-8">
<div className="flex items-end justify-between gap-4">
<h3 className="text-xl font-bold tracking-tight md:text-2xl">{heading}</h3>

        <Link
href={browseHref}
className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
>
{browseLabel}
<ArrowRight className="h-4 w-4" aria-hidden="true" />
</Link>
</div>

      {cards.length > 0 ? (
<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
{cards.map((card) => (
<Link
key={card.id}
href={card.href}
data-testid={link-top-rated-${card.id}}
className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
<span
className="flex items-center gap-1"
aria-label={Rated ${card.ratingAvg.toFixed(1)} out of 5 from ${card.ratingCount} reviews}
>
{Array.from({ length: 5 }, (_, index) => (
<Star
key={index}
aria-hidden="true"
className={`h-4 w-4 ${
index < Math.round(card.ratingAvg)
? "fill-foreground text-foreground"
: "text-muted-foreground/40"
}`}
/>
))}

                <span className="ml-1 text-sm font-bold">{card.ratingAvg.toFixed(1)}</span>
</span>

              <span className="mt-3 truncate text-base font-semibold">{card.name}</span>
<span className="mt-1 text-sm text-muted-foreground">{card.subtitle}</span>

              <span className="mt-auto pt-4 text-xs text-muted-foreground">
{card.ratingCount} patient {card.ratingCount === 1 ? "review" : "reviews"}
</span>

              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
View profile
<ArrowUpRight
className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
aria-hidden="true"
/>
</span>
</Link>
))}
</div>
) : (
<p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
)}
</div>
);
}

function BrandMark({ className }: { className?: string }) {
return (
<Image
src="/medic1905-logo.png"
alt="Medic1905"
width={465}
height={180}
priority
className={w-auto dark:rounded-lg dark:bg-white dark:p-1.5 dark:shadow-sm ${className ?? "h-9"}}
/>
);
}

function ServiceCard({ card }: { card: ImedicsServiceCard }) {
const Icon = SERVICE_ICONS[card.icon];

  return (
<Link
href={card.href}
data-testid={link-service-${card.icon}}
className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
<span
className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background"
aria-hidden="true"
>
<Icon className="h-6 w-6" />
</span>

      <span className="mt-4 text-base font-semibold">{card.title}</span>
<span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
{card.description}
</span>

      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
{card.access === "public" ? "View more" : "Get started"}
<ArrowRight
className="h-4 w-4 transition-transform group-hover:translate-x-1"
aria-hidden="true"
/>
</span>
</Link>
);
}

function PromoTile({
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
className={`group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
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

export function ImedicsHomepage({
topDoctors,
topFacilities,
carouselAds,
bannerAd,
}: {
topDoctors: TopRatedDoctor[];
topFacilities: TopRatedFacility[];
carouselAds?: ImedicsHomeAd[];
bannerAd?: ImedicsHomeAd | null;
}) {
const { theme, toggleTheme } = useTheme();
const [menuOpen, setMenuOpen] = useState(false);

  const adSlides: ImedicsHomeSlide[] | undefined = carouselAds
? carouselAds.map((ad, index) => ({
id: ad-${index},
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
<header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
<Link
href="/"
className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
aria-label="Medic1905 home"
>
<BrandMark className="h-10" />
</Link>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-6" aria-label="Primary">
{IMEDICS_NAV_LINKS.map((link) => (
<Link
key={link.href + link.label}
href={link.href}
className={`text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${
link.compactOnly ? "hidden xl:inline" : ""
}`}
>
{link.label}
</Link>
))}
</nav>

          <div className="flex items-center gap-2">
<button
type="button"
onClick={toggleTheme}
aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
data-testid="button-home-theme-toggle"
className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
{theme === "dark" ? (
<Sun className="h-5 w-5" aria-hidden="true" />
) : (
<Moon className="h-5 w-5" aria-hidden="true" />
)}
</button>

            <Link
href="/auth/login"
data-testid="link-home-login"
className="hidden rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline"
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
onClick={() => setMenuOpen((open) => !open)}
aria-expanded={menuOpen}
aria-controls="im-mobile-menu"
aria-label={menuOpen ? "Close menu" : "Open menu"}
data-testid="button-home-mobile-menu"
className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
>
{menuOpen ? (
<X className="h-5 w-5" aria-hidden="true" />
) : (
<Menu className="h-5 w-5" aria-hidden="true" />
)}
</button>
</div>
</div>

        {menuOpen && (
<nav
id="im-mobile-menu"
aria-label="Mobile"
className="border-t border-border bg-background px-4 py-3 lg:hidden"
>
<ul className="flex flex-col">
{IMEDICS_NAV_LINKS.map((link) => (
<li key={link.href + link.label}>
<Link
href={link.href}
onClick={() => setMenuOpen(false)}
className="block rounded-lg px-2 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
{link.label}
</Link>
</li>
))}
</ul>

            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
<Link
href="/auth/login"
onClick={() => setMenuOpen(false)}
className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Log in
</Link>

              <Link
href="/auth/signup"
onClick={() => setMenuOpen(false)}
className="rounded-full bg-foreground px-4 py-2.5 text-center text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Sign up
</Link>
</div>
</nav>
)}
</header>

      <main className="flex-1 pb-20">
{/* Beeline-style hero: large headline, concise value proposition, two actions */}
<section
aria-labelledby="welcome-heading"
className="mx-auto w-full max-w-7xl px-4 pb-10 pt-10 lg:px-8 lg:pt-16"
>
<div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
<div>
<span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
Healthcare, organised in one place
</span>

              <h1
id="welcome-heading"
className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl xl:text-6xl"
>
Find care.


Book visits.


Manage health.
</h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
Medic1905 connects you with verified doctors, hospitals, laboratories, diagnostic
centres and pharmacies. Discover providers, book appointments, and follow results,
prescriptions and your case file in one secure place.
</p>

              <div className="mt-7 flex flex-wrap gap-3">
<Link
href="/doctors"
data-testid="link-hero-find-doctor"
className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Find a doctor
</Link>

                <Link
href="/facilities"
className="rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Explore facilities
</Link>

                <Link
href="/auth/signup"
className="rounded-full px-6 py-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Create a free account
</Link>
</div>
</div>

            <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-3xl border border-border lg:aspect-[4/5]">
<Image
src="/home/hero-consultation.jpg"
alt="A doctor speaking with a patient during a video consultation"
fill
priority
sizes="(max-width: 1024px) 90vw, 45vw"
className="object-cover"
/>
</div>
</div>
</section>

        {/* Quick category tiles — similar to the reference page's grouped entry points */}
<section
aria-labelledby="quick-links-heading"
className="mx-auto w-full max-w-7xl px-4 lg:px-8"
>
<h2 id="quick-links-heading" className="sr-only">
Quick links
</h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<PromoTile
title="For patients"
description="Find trusted doctors, hospitals, laboratories and pharmacies near you."
href="/facilities"
cta="Explore care"
icon={HeartPulse}
wide
/>

            <PromoTile
title="Book an appointment"
description="Choose a doctor, select a convenient time and manage your visit online."
href="/doctors"
cta="Book now"
icon={Calendar}
/>

            <PromoTile
title="Laboratory tests"
description="Browse laboratory and diagnostic services, preparation guidance and results."
href="/laboratories"
cta="Find a laboratory"
icon={FlaskConical}
/>

            <PromoTile
title="Pharmacies"
description="Locate pharmacies and explore available medicines and wellness products."
href="/pharmacies"
cta="Find a pharmacy"
icon={Pill}
/>
</div>
</section>

        {/* Carousel and sponsored banner */}
<div className="mx-auto w-full max-w-7xl px-4 pt-8 lg:px-8">
<HomeAdsCarousel slides={adSlides} />
</div>

        <div className="mx-auto w-full max-w-7xl px-4 pt-4 lg:px-8">
<HomeSingleAdBanner ad={bannerAd} />
</div>

        {/* Services */}
<section
id="services"
aria-labelledby="services-heading"
className="mx-auto w-full max-w-7xl px-4 pt-14 lg:px-8"
>
<div className="flex flex-wrap items-end justify-between gap-4">
<div>
<h2
id="services-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
Explore services
</h2>
<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
Everything you need to organise care, communicate with providers and manage your
health records.
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
{IMEDICS_SERVICE_CARDS.map((card) => (
<ServiceCard key={card.href} card={card} />
))}
</div>
</section>

        {/* Audiences */}
<section
id="for-patients"
aria-labelledby="audiences-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2
id="audiences-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
For every part of your care
</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
{IMEDICS_AUDIENCES.map((audience) => (
<div
key={audience.key}
data-testid={card-audience-${audience.key}}
className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
>
{audience.image ? (
<div className="relative aspect-[16/10] w-full">
<Image
src={audience.image}
alt={audience.imageAlt ?? audience.title}
fill
sizes="(max-width: 640px) 90vw, (max-width: 1280px) 45vw, 30vw"
className="object-cover"
/>
</div>
) : (
<div
className="flex aspect-[16/10] w-full items-center justify-center bg-accent"
aria-hidden="true"
>
{audience.key === "pharmacies" ? (
<Pill className="h-12 w-12 text-muted-foreground" />
) : (
<Building2 className="h-12 w-12 text-muted-foreground" />
)}
</div>
)}

                <div className="flex flex-1 flex-col p-5">
<h3 className="text-lg font-semibold">{audience.title}</h3>
<p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
{audience.description}
</p>

                  <Link
href={audience.href}
className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
>
{audience.cta}
<ArrowRight className="h-4 w-4" aria-hidden="true" />
</Link>
</div>
</div>
))}
</div>
</section>

        {/* Benefits */}
<section
id="features"
aria-labelledby="features-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2
id="features-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
Benefits and key features
</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
{IMEDICS_BENEFITS.map((benefit) => (
<div
key={benefit.title}
className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
>
<h3 className="text-base font-semibold">{benefit.title}</h3>
<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
{benefit.description}
</p>
</div>
))}
</div>
</section>

        {/* Featured panel */}
<section
aria-labelledby="featured-heading"
className="mx-auto w-full max-w-7xl px-4 pt-14 lg:px-8"
>
<div className="rounded-3xl bg-foreground p-6 text-background md:flex md:items-center md:justify-between md:p-10">
<div className="max-w-2xl">
<h2
id="featured-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
{IMEDICS_FEATURED_PANEL.heading}
</h2>

              <p className="mt-3 text-sm leading-relaxed opacity-80 md:text-base">
{IMEDICS_FEATURED_PANEL.description}
</p>
</div>

            <div className="mt-6 flex flex-col gap-3 md:mt-0 md:flex-row md:items-center">
<Link
href={IMEDICS_FEATURED_PANEL.ctaHref}
data-testid="link-featured-open"
className="rounded-full bg-background px-6 py-3 text-center text-sm font-semibold text-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
>
{IMEDICS_FEATURED_PANEL.cta}
</Link>

              <Link
href={IMEDICS_FEATURED_PANEL.secondaryCtaHref}
className="rounded-full border border-background/40 px-6 py-3 text-center text-sm font-semibold text-background transition-colors hover:border-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
>
{IMEDICS_FEATURED_PANEL.secondaryCta}
</Link>
</div>
</div>
</section>

        {/* Ratings */}
<section
id="ratings"
aria-labelledby="ratings-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2
id="ratings-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
Patient ratings
</h2>

          <RatingGroup
heading="Top-rated doctors"
browseHref="/doctors"
browseLabel="Browse doctors"
emptyText="No published doctor ratings yet."
cards={topDoctors.map((doctor) => ({
id: doctor.id,
href: /doctors/${doctor.id},
name: doctor.name,
subtitle: doctor.specialty ?? "Doctor",
ratingAvg: doctor.ratingAvg,
ratingCount: doctor.ratingCount,
}))}
/>

          {(Object.keys(FACILITY_TYPE_ROUTES) as TopRatedFacilityType[]).map((type) => {
const route = FACILITY_TYPE_ROUTES[type];

            return (
<RatingGroup
key={type}
heading={Top-rated ${route.plural}}
browseHref={route.directory}
browseLabel={Browse ${route.plural}}
emptyText={No published ${route.plural} ratings yet.}
cards={topFacilities
.filter((facility) => facility.type === type)
.map((facility) => ({
id: facility.id,
href: facility.slug
? ${route.profile}/${facility.slug}
: route.directory,
name: facility.name,
subtitle: route.label,
ratingAvg: facility.ratingAvg,
ratingCount: facility.ratingCount,
}))}
/>
);
})}
</section>

        {/* News and podcasts */}
<section
aria-labelledby="media-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2
id="media-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
News and podcasts
</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
{[
{
href: "/news",
title: "Health news",
text: "Updates and guidance from the Medic1905 team.",
icon: Newspaper,
},
{
href: "/podcasts",
title: "Podcasts",
text: "Conversations with doctors and care teams.",
icon: Mic,
},
].map(({ href, title, text, icon: Icon }) => (
<Link
key={href}
href={href}
className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
<span
aria-hidden="true"
className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted"
>
<Icon className="h-6 w-6" />
</span>

                <span>
<span className="block text-base font-semibold">{title}</span>
<span className="mt-1 block text-sm text-muted-foreground">{text}</span>
</span>

                <ArrowUpRight
className="ml-auto h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
aria-hidden="true"
/>
</Link>
))}
</div>
</section>

        {/* How it works */}
<section
id="how-it-works"
aria-labelledby="how-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2 id="how-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
How it works
</h2>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
{IMEDICS_HOW_IT_WORKS_STEPS.map((step, index) => (
<li
key={step}
className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5"
>
<span
aria-hidden="true"
className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background"
>
{index + 1}
</span>

                <p className="text-sm leading-relaxed">{step}</p>
</li>
))}
</ol>
</section>

        {/* FAQ */}
<section
id="faq"
aria-labelledby="faq-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<h2 id="faq-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
Frequently asked questions
</h2>

          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
{IMEDICS_FAQS.map((faq) => (
<details key={faq.question} className="group px-5">
<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
{faq.question}

                  <ChevronDown
aria-hidden="true"
className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
/>
</summary>

                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
{faq.answer}
</p>
</details>
))}
</div>
</section>

        {/* App download — reference-style callout */}
<section
aria-labelledby="app-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<div className="grid items-center gap-6 rounded-3xl border border-border bg-card p-6 md:grid-cols-[minmax(0,1fr)_auto] md:p-10">
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
className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
<Smartphone className="h-4 w-4" aria-hidden="true" />
Download app
</Link>

              <Link
href="/help"
className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
Learn more
</Link>
</div>
</div>
</section>

        {/* Contact */}
<section
id="contact"
aria-labelledby="contact-heading"
className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-8"
>
<div className="rounded-3xl border border-border bg-card p-6 md:flex md:items-center md:justify-between md:p-10">
<div className="max-w-2xl">
<h2
id="contact-heading"
className="text-2xl font-bold tracking-tight md:text-3xl"
>
{IMEDICS_CONTACT.heading}
</h2>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
{IMEDICS_CONTACT.description}
</p>

              <a
href={mailto:${IMEDICS_CONTACT.email}}
className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
>
<Mail className="h-4 w-4" aria-hidden="true" />
{IMEDICS_CONTACT.email}
</a>
</div>

            <div className="mt-6 flex flex-col items-start gap-3 md:mt-0 md:items-end">
<p className="text-xs text-muted-foreground">
{IMEDICS_CONTACT.emergency.text}
</p>

              <Link
href={IMEDICS_CONTACT.emergency.href}
className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
<HeartPulse className="h-4 w-4 text-destructive" aria-hidden="true" />
{IMEDICS_CONTACT.emergency.cta}
</Link>
</div>
</div>
</section>
</main>

      <footer className="border-t border-border bg-card">
<div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 lg:px-8">
<div>
<div className="flex items-center gap-2">
<BrandMark className="h-9" />
</div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
A healthcare platform, not a medical provider. Doctors and facilities are responsible
for clinical decisions; AI content is informational only.
</p>

            <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
<ShieldCheck className="h-4 w-4" aria-hidden="true" />
Secure records · role-based access · full audit trail
</p>
</div>

          {IMEDICS_FOOTER_LINKS.map((group) => (
<nav key={group.heading} aria-label={group.heading}>
<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
{group.heading}
</h3>

              <ul className="mt-4 space-y-2.5">
{group.links.map((link) => (
<li key={link.href}>
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

        <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground lg:px-8">
© 2026 Medic1905. All rights reserved.
</div>

        <div className="px-4 pb-5 text-center text-[11px] leading-relaxed text-muted-foreground/70 lg:px-8">
{IMEDICS_IMAGE_CREDITS.join(" · ")}
</div>
</footer>
</div>
);
}
