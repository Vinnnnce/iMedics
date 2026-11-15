import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/support/contact-form";

export const metadata: Metadata = {
  title: "Contact Medic1905",
  description: "Ask a question, report a problem, or tell us about incorrect information or suspected unauthorised access.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
        <p className="text-muted-foreground">Questions, problems, feedback, or a concern about a record or your account. We acknowledge every message with a reference number.</p>
      </header>
      <section aria-labelledby="urgent" className="rounded-xl border border-destructive/40 bg-card p-4 text-sm">
        <h2 id="urgent" className="font-semibold">Medical emergency?</h2>
        <p className="mt-1 text-muted-foreground">Contact your local emergency services immediately. This form is not monitored for emergencies. See the <Link href="/emergency/cpr" className="underline underline-offset-4">emergency guidance</Link>.</p>
      </section>
      <ContactForm initialType={type} />
      <p className="text-sm text-muted-foreground">Looking for answers first? Visit the <Link href="/help" className="underline underline-offset-4">help centre</Link>.</p>
    </div>
  );
}
