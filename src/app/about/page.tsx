import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity, BadgeCheck, Building2, FileText, FlaskConical, HeartPulse, Lock, ShieldCheck, Stethoscope,
} from "lucide-react";
import { LEGAL_DISCLAIMER, LEGAL_META } from "@/lib/legal/types";
import { LEGAL_NAV_LINKS } from "@/lib/legal/types";

export const metadata: Metadata = {
  title: "About Medic1905",
  description:
    "What Medic1905 is, who it serves, and how it works — a Nigerian telemedicine platform connecting patients with verified doctors, hospitals, laboratories and diagnostic centres.",
};

const ACCOUNT_TYPES = [
  {
    icon: Stethoscope,
    title: "Doctors",
    description:
      "MDCN-registered practitioners offering video, chat and in-person consultations, with their own fees and availability.",
  },
  {
    icon: Building2,
    title: "Hospitals",
    description:
      "Registered healthcare organisations offering departments, branches and clinical services, with staff and referral management.",
  },
  {
    icon: FlaskConical,
    title: "Laboratories",
    description:
      "MLSCN-registered medical laboratories receiving orders, processing samples and releasing verified results.",
  },
  {
    icon: Activity,
    title: "Diagnostic centres",
    description:
      "Imaging and diagnostic facilities performing investigations and releasing reviewed reports.",
  },
  {
    icon: HeartPulse,
    title: "Patients",
    description:
      "People seeking care: one secure case file, booking, secure messaging, results and prescriptions.",
  },
];

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Verified providers",
    description:
      "Doctors, hospitals, laboratories and diagnostic centres are checked against their professional registrations before they are listed — MDCN, MLSCN, RRBN and CAC records as applicable.",
  },
  {
    icon: Lock,
    title: "Confidential by design",
    description:
      "Health records are visible only to the patient and the providers involved in their care, under the National Health Act 2014 and the Nigeria Data Protection Act 2023.",
  },
  {
    icon: FileText,
    title: "One secure health record",
    description:
      "Consultations, laboratory results, diagnostic reports and prescriptions are kept in one case file that the patient controls and can share with their care team.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">About Medic1905</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Medic1905 is a Nigerian telemedicine platform that connects patients with verified doctors,
          hospitals, laboratories and diagnostic centres — from finding a provider and booking a
          consultation, to ordering laboratory tests, receiving diagnostic reports and managing a
          secure health record in one place.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We are a technology platform, not a medical provider. The doctors, hospitals, laboratories
          and diagnostic centres on Medic1905 are independent, licensed professionals and
          organisations, each responsible for the clinical care they deliver. Our role is to make
          quality care in Nigeria easier to find, book, pay for and follow up.
        </p>
      </header>

      <section aria-labelledby="about-accounts" className="space-y-4">
        <h2 id="about-accounts" className="text-lg font-bold text-foreground">Who uses Medic1905</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACCOUNT_TYPES.map((type) => (
            <article key={type.title} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <type.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{type.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{type.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-principles" className="space-y-4">
        <h2 id="about-principles" className="text-lg font-bold text-foreground">How we work</h2>
        <div className="space-y-3">
          {PRINCIPLES.map((principle) => (
            <article key={principle.title} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <principle.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{principle.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{principle.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-contact" className="space-y-3">
        <h2 id="about-contact" className="text-lg font-bold text-foreground">Contact and legal</h2>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p className="flex items-center gap-2">
            <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            Operated by the platform operator, a Nigerian-registered entity (registration details displayed on the platform once confirmed).
          </p>
          <p>
            All questions, including support, legal, privacy and data requests:{" "}
            <a className="underline underline-offset-2" href={`mailto:${LEGAL_META.contactEmail}`}>{LEGAL_META.contactEmail}</a>
          </p>
          <nav aria-label="Legal pages" className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            {LEGAL_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
      </section>
    </div>
  );
}
