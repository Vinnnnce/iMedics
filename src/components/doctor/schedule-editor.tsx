"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { apiClient } from "@/lib/api-client";
import { DAY_NAMES } from "@/lib/format";

export interface ScheduleWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

const field = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

/** Edit and publish the weekly availability (clinic time, WAT). */
export function ScheduleEditor({ initial }: { initial: ScheduleWindow[] }) {
  const [windows, setWindows] = useState<ScheduleWindow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const update = (index: number, patch: Partial<ScheduleWindow>) =>
    setWindows((current) => current.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        await apiClient.put("/doctors/me/schedule", { slots: windows });
        setMessage({ type: "ok", text: "Availability published." });
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "Could not save your schedule" });
      }
    });
  };

  // Calendar preview: days of the week covered by at least one window.
  const coveredWeekdays = useMemo(
    () => new Set(windows.map((w) => w.dayOfWeek)),
    [windows],
  );
  const windowsForSelected = selectedDate
    ? windows.filter((w) => w.dayOfWeek === selectedDate.getDay())
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {windows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have no published availability. Patients cannot book you until you add at least one window.
          </p>
        )}

        {windows.map((w, index) => (
          <Card key={index} className="beeline-card">
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <label className="text-xs text-muted-foreground">
                Day
                <select className={`${field} mt-1 block`} value={w.dayOfWeek} onChange={(e) => update(index, { dayOfWeek: Number(e.target.value) })}>
                  {DAY_NAMES.map((name, day) => (
                    <option key={name} value={day}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                From
                <input type="time" className={`${field} mt-1 block`} value={w.startTime} onChange={(e) => update(index, { startTime: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                To
                <input type="time" className={`${field} mt-1 block`} value={w.endTime} onChange={(e) => update(index, { endTime: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Slot length
                <select className={`${field} mt-1 block`} value={w.slotMinutes} onChange={(e) => update(index, { slotMinutes: Number(e.target.value) })}>
                  {[15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="outline" size="sm" className="ml-auto rounded-lg" onClick={() => setWindows((c) => c.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            </CardContent>
          </Card>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => setWindows((c) => [...c, { dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotMinutes: 30 }])}
          >
            <Plus className="h-4 w-4 mr-1" /> Add window
          </Button>
          <Button type="button" className="bg-foreground text-background rounded-lg" disabled={pending} onClick={save}>
            {pending ? "Publishing…" : "Publish availability"}
          </Button>
          {message && <p className={`text-sm ${message.type === "ok" ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}
        </div>
        <p className="text-xs text-muted-foreground">Times are in West Africa Time (WAT). Appointments that are already booked are not affected.</p>
      </div>

      <Card className="beeline-card h-fit">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Calendar preview</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Highlighted days match your published weekly windows. Select a day to preview its times.
            </p>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-lg border p-2"
            modifiers={{
              covered: (date) => coveredWeekdays.has(date.getDay()),
            }}
            modifiersClassNames={{
              covered:
                "bg-primary/10 font-semibold text-foreground rounded-md",
            }}
          />
          {selectedDate ? (
            windowsForSelected.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {windowsForSelected.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {w.startTime} – {w.endTime} · {w.slotMinutes}-minute slots
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} is not part of your availability.
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">No day selected.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
