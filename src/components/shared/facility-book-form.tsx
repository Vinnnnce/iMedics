"use client";

import { useRef, useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/shared/checkout-form";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";

interface Props {
  service: { id: string; name: string; description: string | null; price: number; currency: string; availability: string | null };
  facility: { name: string; addressLine: string | null; city: string | null; state: string | null; operatingHours: string | null };
}

/** Review a service (provider, description, price, location, availability) and book it. */
export function FacilityBookForm({ service, facility }: Props) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const createdPaymentId = useRef<string | null>(null);

  // Clinic time is West Africa Time (UTC+1, no daylight saving).
  const preferredAt = when ? new Date(`${when}:00+01:00`).toISOString() : null;
  const address = [facility.addressLine, facility.city, facility.state].filter(Boolean).join(", ");
  const free = service.price <= 0;

  const create = async () => {
    const res = await apiClient.post<{ payment: { id: string } | null }>("/facility-bookings", { serviceId: service.id, preferredAt });
    return res;
  };

  const prepare = async () => {
    if (createdPaymentId.current) return { paymentId: createdPaymentId.current };
    const res = await create();
    if (!res.payment) throw new Error("This booking does not need a payment");
    createdPaymentId.current = res.payment.id;
    return { paymentId: res.payment.id };
  };

  const bookFree = async () => {
    setBusy(true);
    setError("");
    try {
      await create();
      setDone(preferredAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book this service");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-sm">Booked for {formatClinicDateTime(done)}. The facility will confirm it.</p>;
  if (!open) {
    return (
      <Button size="sm" className="rounded-lg bg-foreground text-background" onClick={() => setOpen(true)}>
        Book
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border p-4 text-sm">
      <div className="space-y-1">
        <p className="font-semibold">{service.name}</p>
        <p className="text-muted-foreground">{facility.name}</p>
        {service.description && <p className="text-xs text-muted-foreground">{service.description}</p>}
        {address && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {address}
          </p>
        )}
        {(service.availability || facility.operatingHours) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {[service.availability, facility.operatingHours].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="pt-1 font-semibold">{free ? "Free" : formatMoney(service.price, service.currency)}</p>
      </div>

      <label className="block text-xs text-muted-foreground">
        Preferred date and time (West Africa Time)
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
      </label>

      {error && <p className="text-destructive">{error}</p>}

      {free ? (
        <Button className="w-full rounded-lg bg-foreground text-background" disabled={!preferredAt || busy} onClick={bookFree}>
          {busy ? "Booking…" : "Request booking"}
        </Button>
      ) : preferredAt ? (
        <CheckoutForm amount={service.price} currency={service.currency} prepare={prepare} label="Pay" />
      ) : (
        <p className="text-xs text-muted-foreground">Choose a date and time to continue to payment.</p>
      )}
      <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  );
}
