"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { SUPPORTED_CURRENCIES, formatMoney } from "@/lib/money";

interface Fees {
  consultationFee: number | null;
  followUpFee: number | null;
  followUpWindowDays: number;
  currency: string;
}

/** Doctors set a standard consultation fee and an optional, lower follow-up fee. */
export function FeeForm({ initial }: { initial: Fees }) {
  const [currency, setCurrency] = useState(initial.currency);
  const [standard, setStandard] = useState(initial.consultationFee?.toString() ?? "");
  const [hasFollowUp, setHasFollowUp] = useState(initial.followUpFee !== null);
  const [followUp, setFollowUp] = useState(initial.followUpFee?.toString() ?? "");
  const [days, setDays] = useState(initial.followUpWindowDays.toString());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (standard.trim() === "" || Number.isNaN(Number(standard))) {
      setError("Enter your standard consultation fee (0 for free).");
      return;
    }
    setSaving(true);
    try {
      await apiClient.put("/doctors/me/fees", {
        consultationFee: Number(standard),
        followUpFee: hasFollowUp && followUp.trim() !== "" ? Number(followUp) : null,
        followUpWindowDays: Number(days) || 14,
        currency,
      });
      setMessage("Fees saved. They apply to new bookings; existing bookings keep their price.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your fees");
    } finally {
      setSaving(false);
    }
  };

  const preview = (value: string) => (value.trim() !== "" && !Number.isNaN(Number(value)) ? formatMoney(Number(value), currency) : "—");

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Consultation fees</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select id="currency" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="standard">Standard consultation fee</Label>
            <Input id="standard" inputMode="decimal" value={standard} onChange={(e) => setStandard(e.target.value)} placeholder="e.g. 10000" className="rounded-lg" />
            <p className="text-xs text-muted-foreground">Patients see {preview(standard)} before they book. Enter 0 to offer free consultations.</p>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="accent-foreground" checked={hasFollowUp} onChange={(e) => setHasFollowUp(e.target.checked)} />
              Offer a reduced follow-up fee
            </label>
            {hasFollowUp && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="followUp">Follow-up fee</Label>
                  <Input id="followUp" inputMode="decimal" value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. 5000" className="rounded-lg" />
                  <p className="text-xs text-muted-foreground">{preview(followUp)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Valid for (days)</Label>
                  <Input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="rounded-lg" />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  A patient pays the follow-up fee when they book again within {Number(days) || 14} days of a completed standard consultation with you.
                </p>
              </div>
            )}
            {!hasFollowUp && <p className="text-xs text-muted-foreground">Without one, follow-up visits are charged the standard fee.</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-success">{message}</p>}
          <Button type="submit" disabled={saving} className="rounded-lg bg-foreground text-background">
            {saving ? "Saving…" : "Save fees"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
