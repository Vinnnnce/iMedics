"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

interface Slot {
  startsAt: string;
  durationMinutes: number;
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** Move an appointment to another free slot of the same doctor. The price and payment stay as they were. */
export function ReschedulePanel({ appointmentId, doctorId, today }: { appointmentId: string; doctorId: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [loaded, setLoaded] = useState<{ date: string; slots: Slot[] } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loading = open && loaded?.date !== date;
  const slots = loaded?.date === date ? loaded.slots : [];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .get<{ slots: Slot[] }>(`/doctors/${doctorId}/availability?date=${date}`)
      .then((d) => !cancelled && setLoaded({ date, slots: d.slots }))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load availability");
        setLoaded({ date, slots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, doctorId, date]);

  const submit = async () => {
    if (!slot) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/appointments/${appointmentId}/reschedule`, { scheduledAt: slot });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1 h-4 w-4" /> Reschedule
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border p-3 sm:w-72">
      <label className="block text-xs text-muted-foreground">
        New date
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSlot(null);
          }}
          className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        />
      </label>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && slots.length === 0 && <p className="text-xs text-muted-foreground">No free slots on this date.</p>}
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <Button key={s.startsAt} type="button" size="sm" variant={slot === s.startsAt ? "default" : "outline"} className={slot === s.startsAt ? "rounded-lg bg-foreground text-background" : "rounded-lg"} onClick={() => setSlot(s.startsAt)}>
            {timeOf(s.startsAt)}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="rounded-lg bg-foreground text-background" disabled={!slot || busy} onClick={submit}>
          {busy ? "Moving…" : "Move appointment"}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
