"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
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
  );
}
