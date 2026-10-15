"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface Profile {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  operatingHours: string | null;
  about: string | null;
}

/** Where the facility is and when it is open. Shown to patients before they book. */
export function FacilityProfileForm({ initial }: { initial: Profile }) {
  const [v, setV] = useState({ addressLine: initial.addressLine ?? "", city: initial.city ?? "", state: initial.state ?? "", operatingHours: initial.operatingHours ?? "", about: initial.about ?? "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put("/facility/profile", v);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Location and opening hours</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fp-address">Address</Label>
            <Input id="fp-address" value={v.addressLine} onChange={set("addressLine")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-city">City</Label>
            <Input id="fp-city" value={v.city} onChange={set("city")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-state">State</Label>
            <Input id="fp-state" value={v.state} onChange={set("state")} className="rounded-lg" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fp-hours">Opening hours</Label>
            <Input id="fp-hours" value={v.operatingHours} onChange={set("operatingHours")} placeholder="e.g. Mon–Fri 8am–5pm, Sat 9am–1pm" className="rounded-lg" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fp-about">About</Label>
            <Input id="fp-about" value={v.about} onChange={set("about")} placeholder="A short description for patients" className="rounded-lg" />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {message && <p className="text-sm text-success sm:col-span-2">{message}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="rounded-lg bg-foreground text-background">
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
