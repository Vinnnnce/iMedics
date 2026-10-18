"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X, Clock, Trash2, BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { SCHEDULE_SLOTS } from "@/lib/prescriptions/validation";

interface Reminder {
  id: string;
  label: string;
  times: string[];
  startDate: string;
  endDate: string | null;
  active: boolean;
}
interface Dose {
  id: string;
  reminderId: string;
  scheduledFor: string;
  status: "SCHEDULED" | "ACKNOWLEDGED" | "TAKEN" | "MISSED" | "SKIPPED";
  notifiedAt: string | null;
}
interface Adherence {
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  acknowledged: number;
  scheduled: number;
}

const STATUS_BADGE: Record<Dose["status"], "outline" | "secondary" | "default" | "destructive"> = {
  SCHEDULED: "outline",
  ACKNOWLEDGED: "secondary",
  TAKEN: "default",
  MISSED: "destructive",
  SKIPPED: "secondary",
};

export function PatientReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [label, setLabel] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [customTime, setCustomTime] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ reminders: Reminder[]; doses: Dose[]; adherence: Adherence }>("/patient/reminders");
      setReminders(data.reminders);
      setDoses(data.doses);
      setAdherence(data.adherence);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load reminders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const createReminder = async () => {
    if (!label.trim()) {
      toast.error("Give the reminder a name (for example the medication)");
      return;
    }
    try {
      await apiClient.post("/patient/reminders", {
        label: label.trim(),
        times,
        startDate: new Date().toISOString(),
      });
      toast.success("Reminder created");
      setShowNew(false);
      setLabel("");
      setTimes(["08:00"]);
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the reminder");
    }
  };

  const recordDose = async (dose: Dose, status: "ACKNOWLEDGED" | "TAKEN" | "SKIPPED") => {
    try {
      await apiClient.post(`/patient/reminders/${dose.reminderId}`, { doseEventId: dose.id, status });
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the dose");
    }
  };

  const removeReminder = async (id: string) => {
    try {
      await apiClient.delete(`/patient/reminders/${id}`);
      toast.success("Reminder stopped");
      void Promise.resolve().then(load);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop the reminder");
    }
  };

  const toggleTime = (time: string) => {
    setTimes((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time].sort()));
  };

  const addCustomTime = () => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime)) {
      toggleTime(customTime);
      setCustomTime("");
    } else {
      toast.error("Use 24-hour HH:mm format, for example 14:30");
    }
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Medication reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reminders are gentle nudges only. Opening a reminder never marks a dose as taken — you confirm each dose yourself.
          </p>
        </div>
        <Button onClick={() => setShowNew((s) => !s)} data-testid="button-new-reminder">
          <Plus className="h-4 w-4" aria-hidden="true" /> {showNew ? "Close" : "New reminder"}
        </Button>
      </div>

      {showNew && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="rem-label">Reminder name</Label>
              <Input id="rem-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Morning medication" />
            </div>
            <div className="space-y-1">
              <Label>Administration times</Label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_SLOTS.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => toggleTime(slot.time)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${times.includes(slot.time) ? "border-foreground bg-foreground/10" : "border-border hover:bg-muted"}`}
                  >
                    {slot.label} ({slot.time})
                  </button>
                ))}
                {times.filter((t) => !SCHEDULE_SLOTS.some((s) => s.time === t)).map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full border border-foreground bg-foreground/10 px-3 py-1.5 text-sm">
                    <Clock className="h-3 w-3" aria-hidden="true" /> {t}
                    <button aria-label={`Remove ${t}`} onClick={() => toggleTime(t)}><X className="h-3 w-3" aria-hidden="true" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="Custom time (HH:mm)" className="max-w-48" aria-label="Custom time" />
                <Button variant="outline" size="sm" onClick={addCustomTime}>Add time</Button>
              </div>
            </div>
            <Button onClick={createReminder} disabled={times.length === 0}>Create reminder</Button>
          </CardContent>
        </Card>
      )}

      {adherence && (
        <Card className="beeline-card">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span className="font-medium">Last 30 days</span>
            <span>Taken: {adherence.taken}</span>
            <span className="text-muted-foreground">Missed: {adherence.missed}</span>
            <span className="text-muted-foreground">Skipped: {adherence.skipped}</span>
            <span className="text-muted-foreground">Upcoming: {adherence.scheduled}</span>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading your reminders…</p>}

      {/* Today&#x27;s doses */}
      {doses.length > 0 && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-medium"><BellRing className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Today&#x27;s doses</p>
            {doses.map((dose) => {
              const reminder = reminders.find((r) => r.id === dose.reminderId);
              return (
                <div key={dose.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{fmtTime(dose.scheduledFor)}</span>
                  <span className="text-sm text-muted-foreground">{reminder?.label}</span>
                  <Badge variant={STATUS_BADGE[dose.status]} className="rounded-lg">{dose.status.toLowerCase()}</Badge>
                  <div className="ml-auto flex gap-1">
                    {dose.status === "SCHEDULED" && (
                      <Button variant="outline" size="sm" onClick={() => recordDose(dose, "ACKNOWLEDGED")}>Acknowledge</Button>
                    )}
                    {dose.status !== "TAKEN" && (
                      <Button size="sm" onClick={() => recordDose(dose, "TAKEN")} data-testid={`button-taken-${dose.id}`}>
                        <Check className="h-4 w-4" aria-hidden="true" /> Taken
                      </Button>
                    )}
                    {dose.status === "SCHEDULED" && (
                      <Button variant="ghost" size="sm" onClick={() => recordDose(dose, "SKIPPED")}>Skip</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Reminder list */}
      <div className="space-y-3">
        {reminders.map((reminder) => (
          <Card key={reminder.id} className="beeline-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{reminder.label}</p>
                <p className="text-xs text-muted-foreground">{reminder.times.join(" · ")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeReminder(reminder.id)} aria-label={`Stop reminder ${reminder.label}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
