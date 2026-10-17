import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CreditCard, Stethoscope, UserRound } from "lucide-react";
import { EMERGENCY_NUMBERS } from "@/lib/home/content";

export const metadata: Metadata = {
  title: "Pricing — Medic1905",
  description:
    "How pricing works on Medic1905: free patient accounts, per-consultation fees set by doctors, facility-published service prices, and administrator-managed doctor subscription plans.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-0">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Pricing</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        How patients and providers are charged on Medic1905.
      </p>
      <Card className="border-border bg-card">
        <CardContent className="space-y-6 p-4 text-sm leading-relaxed text-muted-foreground md:p-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="h-4 w-4 text-foreground" />
              <h2 className="text-base font-semibold text-foreground">For patients — free to join</h2>
            </div>
            <p>
              Creating a Medic1905 account, managing your health record, and messaging your care team are free.
              You pay only for the services you use:
            </p>
            <ul className="ml-2 list-inside list-disc space-y-1">
              <li>Doctor consultations are priced by each doctor, and the fee is shown before you book.</li>
              <li>Laboratory tests, imaging, and hospital services are published by each facility.</li>
              <li>Payments are processed through the platform, and receipts are stored in your account.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope aria-hidden="true" className="h-4 w-4 text-foreground" />
              <h2 className="text-base font-semibold text-foreground">For doctors — subscription plans</h2>
            </div>
            <p>
              Doctors choose a subscription plan that is activated after credential verification. Your plan controls
              access to premium features such as AI-enabled documentation and triage support. Plan prices are not yet
              published on this page — the platform administrator configures plans and can share current pricing
              during onboarding. From your subscription page you can pause or cancel your subscription record; note
              that this does not change any external recurring billing, which the administrator handles.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="h-4 w-4 text-foreground" />
              <h2 className="text-base font-semibold text-foreground">For hospitals, laboratories, and diagnostic centres</h2>
            </div>
            <p>
              Facilities publish their own service catalogue with prices and availability. Platform terms,
              including commission on bookings, are agreed during facility verification and onboarding.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard aria-hidden="true" className="h-4 w-4 text-foreground" />
              <h2 className="text-base font-semibold text-foreground">Payments and refunds</h2>
            </div>
            <p>
              Consultation fees are paid through the platform. If a consultation cannot go ahead, refunds follow the
              policy shown at checkout, and refund requests are reviewed before approval.
            </p>
          </section>

          <p className="disclaimer-box p-3">
            Emergencies: call {EMERGENCY_NUMBERS.national} (national) or {EMERGENCY_NUMBERS.lagos} (Lagos), or go to the
            nearest hospital. Medic1905 is a platform, not an emergency service.
          </p>
        </CardContent>
      </Card>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/auth/signup" className="pill-btn pill-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
          Create a free account
        </Link>
        <Link href="/#providers" className="pill-btn pill-btn-outline inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
          For providers
        </Link>
      </div>
    </div>
  );
}