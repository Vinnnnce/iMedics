"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { CheckoutForm } from "@/components/shared/checkout-form";
import { formatClinicDateTime, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

interface Slot {
  startsAt: string;
  durationMinutes: number;
}

interface Fee {
  configured: boolean;
  kind: "STANDARD" | "FOLLOW_UP";
  amount: number;
  currency: string;
  standardAmount: number;
  followUpAmount: number | null;
  followUpWindowDays: number;
  qualifiesUntil: string | null;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Pick a free slot from a doctor's published availability and request a booking. */
export function BookingPanel({
  doctorId,
  today,
  services = [],
}: {
  doctorId: string;
  today: string;
  services?: { id: string; name: string; price: number; currency: string; durationMinutes: number; modes: string[] }[];
}) {
  const [date, setDate] = useState(today);
  const [loaded, setLoaded] = useState<{ date: string; slots: Slot[] } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [mode, setMode] = useState<"CHAT" | "IN_PERSON">("CHAT");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fee, setFee] = useState<{ slot: string; fee: Fee } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  // Remember the booking once created, so a failed payment start can be retried without booking twice.
  const createdPaymentId = useRef<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  // The price for the chosen slot, as this patient would be charged (the server repeats this when booking).
  const currentFee = slot && fee?.slot === slot ? fee.fee : null;
  useEffect(() => {
    if (!slot) return;
    let cancelled = false;
    apiClient
      .get<{ fee: Fee }>(`/doctors/${doctorId}/pricing?scheduledAt=${encodeURIComponent(slot)}${serviceId ? `&serviceId=${serviceId}` : ""}`)
      .then((data) => {
        if (!cancelled) setFee({ slot, fee: data.fee });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the price");
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, slot, serviceId]);

  // Slots for the chosen date. "Loading" is derived: we have not loaded this date yet.
  const loading = loaded?.date !== date;
  const slots = loaded?.date === date ? loaded.slots : [];

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ slots: Slot[] }>(`/doctors/${doctorId}/availability?date=${date}`)
      .then((data) => {
        if (!cancelled) setLoaded({ date, slots: data.slots });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load availability");
        setLoaded({ date, slots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, date]);

  const createBooking = async () => {
    if (createdPaymentId.current) return { paymentId: createdPaymentId.current };
    const res = await apiClient.post<{ payment: { id: string } | null }>("/appointments", { doctorId, scheduledAt: slot, mode, reason: reason || undefined, serviceId: serviceId || undefined });
    if (!res.payment) throw new Error("This booking does not need a payment");
    createdPaymentId.current = res.payment.id;
    return { paymentId: res.payment.id };
  };

  const bookFree = async () => {
    if (!slot) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/appointments", { doctorId, scheduledAt: slot, mode, reason: reason || undefined, serviceId: serviceId || undefined });
      setBooked(slot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book this slot");
    } finally {
      setSubmitting(false);
    }
  };

  // A service may restrict which modes it supports; the panel keeps the standard choice otherwise.
  const serviceModes = service && service.modes.length > 0 ? service.modes.filter((m) => m === "CHAT" || m === "IN_PERSON") : [];
  const modeOptions = serviceModes.length > 0 ? serviceModes : ["CHAT", "IN_PERSON"];

  if (booked) {
    return (
      <Card className="beeline-card">
        <CardContent className="space-y-2 p-5">
          <p className="font-semibold">Request sent</p>
          <p className="text-sm text-muted-foreground">
            You asked for {formatClinicDateTime(booked)}. The doctor will confirm your booking, and you will see it under{" "}
            <Link href="/patient/appointments" className="underline">
              Appointments
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Book an appointment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-xs text-muted-foreground">
          Date
          <input type="date" min={today} value={date} onChange={(e) => {
              setDate(e.target.value);
              setSlot(null);
              setReviewing(false);
            }} className={`${field} mt-1`} />
        </label>

        {services.length > 0 && (
          <label className="block text-xs text-muted-foreground">
            Service
            <select
              className={`${field} mt-1`}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlot(null);
                setReviewing(false);
              }}
            >
              <option value="">General consultation</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.price > 0 ? formatMoney(s.price, s.currency) : "Free"} · {s.durationMinutes} min
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Available times (West Africa Time)</p>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && slots.length === 0 && <p className="text-sm text-muted-foreground">No free slots on this date.</p>}
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Button
                key={s.startsAt}
                type="button"
                size="sm"
                variant={slot === s.startsAt ? "default" : "outline"}
                className={slot === s.startsAt ? "bg-foreground text-background rounded-lg" : "rounded-lg"}
                onClick={() => setSlot(s.startsAt)}
              >
                {timeOf(s.startsAt)}
              </Button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-muted-foreground">
          Type of consultation
          <select className={`${field} mt-1`} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            {modeOptions.map((m) => (
              <option key={m} value={m}>
                {m === "CHAT" ? "Chat" : "In person"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted-foreground">
          Reason (optional)
          <textarea className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background p-2 text-sm" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {slot && currentFee && <FeeSummary fee={currentFee} />}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {reviewing && currentFee && currentFee.amount > 0 ? (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-sm">
              <p className="font-medium">{slot && formatClinicDateTime(slot)}</p>
              <p className="text-xs text-muted-foreground">
                {(currentFee && currentFee.serviceName) || (currentFee && currentFee.kind === "FOLLOW_UP" ? "Follow-up consultation" : "Consultation")} · {mode === "CHAT" ? "Chat" : "In person"}
              </p>
            </div>
            <CheckoutForm amount={currentFee.amount} currency={currentFee.currency} prepare={createBooking} label="Pay" />
            <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={() => setReviewing(false)}>
              Change time or details
            </button>
          </div>
        ) : (
          <Button
            className="w-full bg-foreground text-background rounded-lg"
            disabled={!slot || submitting || !currentFee || !currentFee.configured}
            onClick={() => (currentFee && currentFee.amount > 0 ? setReviewing(true) : bookFree())}
          >
            {submitting ? "Sending…" : currentFee && currentFee.amount > 0 ? `Continue to payment · ${formatMoney(currentFee.amount, currentFee.currency)}` : "Request this time"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FeeSummary({ fee }: { fee: Fee }) {
  if (!fee.configured) {
    return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This doctor has not published a consultation fee yet, so booking is not available.</p>;
  }
  return (
    <div className="space-y-1 rounded-lg bg-muted p-3 text-sm" data-testid="fee-summary">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{fee.kind === "FOLLOW_UP" ? "Follow-up consultation" : "Consultation fee"}</span>
        <span className="font-semibold">{fee.amount > 0 ? formatMoney(fee.amount, fee.currency) : "Free"}</span>
      </div>
      {fee.kind === "FOLLOW_UP" && (
        <p className="text-xs text-muted-foreground">
          Reduced rate applies because you saw this doctor recently (standard fee {formatMoney(fee.standardAmount, fee.currency)}).
          {fee.qualifiesUntil ? ` Available until ${formatDate(fee.qualifiesUntil)}.` : ""}
        </p>
      )}
      {fee.kind === "STANDARD" && fee.followUpAmount !== null && fee.followUpAmount < fee.standardAmount && (
        <p className="text-xs text-muted-foreground">
          Book again within {fee.followUpWindowDays} days of a completed consultation and pay only {formatMoney(fee.followUpAmount, fee.currency)}.
        </p>
      )}
    </div>
  );
}
