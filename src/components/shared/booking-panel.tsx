"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { formatClinicDateTime } from "@/lib/format";

interface Slot {
  startsAt: string;
  durationMinutes: number;
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Pick a free slot from a doctor's published availability and request a booking. */
export function BookingPanel({ doctorId, today }: { doctorId: string; today: string }) {
  const [date, setDate] = useState(today);
  const [loaded, setLoaded] = useState<{ date: string; slots: Slot[] } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<"CHAT" | "IN_PERSON">("CHAT");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const book = async () => {
    if (!slot) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/appointments", { doctorId, scheduledAt: slot, mode, reason: reason || undefined });
      setBooked(slot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book this slot");
    } finally {
      setSubmitting(false);
    }
  };

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
            }} className={`${field} mt-1`} />
        </label>

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
            <option value="CHAT">Chat</option>
            <option value="IN_PERSON">In person</option>
          </select>
        </label>

        <label className="block text-xs text-muted-foreground">
          Reason (optional)
          <textarea className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background p-2 text-sm" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full bg-foreground text-background rounded-lg" disabled={!slot || submitting} onClick={book}>
          {submitting ? "Sending…" : "Request this time"}
        </Button>
      </CardContent>
    </Card>
  );
}
