import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "Help centre · Medic1905",
  description: "Answers for patients, doctors, hospitals, laboratories, diagnostic centres and pharmacies.",
};

const SECTIONS = [
  { id: "general", title: "Getting started", items: FAQS.GENERAL },
  { id: "patients", title: "Patients", items: FAQS.PATIENT },
  { id: "doctors", title: "Doctors", items: FAQS.DOCTOR },
  { id: "hospitals", title: "Hospitals", items: FAQS.HOSPITAL },
  { id: "laboratories", title: "Laboratories", items: FAQS.LABORATORY },
  { id: "diagnostics", title: "Diagnostic centres", items: FAQS.DIAGNOSTIC_CENTRE },
  { id: "pharmacies", title: "Pharmacies", items: FAQS.PHARMACY },
].filter((s) => s.items.length > 0);

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help centre</h1>
        <p className="text-muted-foreground">Find an answer, or <Link href="/contact" className="underline underline-offset-4">contact support</Link>. To report incorrect information in a record or suspected unauthorised access, use <Link href="/contact?type=DATA_CORRECTION" className="underline underline-offset-4">Report a problem</Link> while signed in.</p>
        <nav aria-label="Help topics" className="flex flex-wrap gap-2 pt-2">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{s.title}</a>)}
        </nav>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 space-y-3">
          <h2 id={`${section.id}-title`} className="text-xl font-semibold">{section.title}</h2>
          <div className="divide-y rounded-xl border bg-card">
            {section.items.map((item) => (
              <details key={item.question} className="group p-4">
                <summary className="cursor-pointer list-none text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{item.question}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">Medic1905 does not provide emergency care. In an emergency, contact your local emergency services.</p>
    </div>
  );
}
