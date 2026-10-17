"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  slug: string | null;
  isPublished: boolean;
  tagline: string | null;
  mission: string | null;
  vision: string | null;
  ownershipType: string | null;
  establishedYear: number | null;
  languagesSpoken: string[];
  paymentMethods: string[];
  emergencyContact: string | null;
  phone: string | null;
  email: string | null;
}

const OWNERSHIP = [
  { value: "PRIVATE", label: "Private" },
  { value: "PUBLIC", label: "Public" },
  { value: "FAITH_BASED", label: "Faith-based" },
  { value: "GROUP_PRACTICE", label: "Group practice" },
];

/**
 * Location, opening hours and the public portfolio content shown to patients
 * before they book. The slug and the publish switch control the public page:
 * /hospitals/[slug], /laboratories/[slug] or /diagnostic-centres/[slug].
 */
export function FacilityProfileForm({ initial, publicDirectory }: { initial: Profile; publicDirectory: string }) {
  const router = useRouter();
  const [v, setV] = useState({
    addressLine: initial.addressLine ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    operatingHours: initial.operatingHours ?? "",
    about: initial.about ?? "",
    tagline: initial.tagline ?? "",
    mission: initial.mission ?? "",
    vision: initial.vision ?? "",
    ownershipType: initial.ownershipType ?? "",
    establishedYear: initial.establishedYear?.toString() ?? "",
    languagesSpoken: initial.languagesSpoken.join(", "),
    paymentMethods: initial.paymentMethods.join(", "),
    emergencyContact: initial.emergencyContact ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    slug: initial.slug ?? "",
    isPublished: initial.isPublished,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put("/facility/profile", {
        addressLine: v.addressLine || null,
        city: v.city || null,
        state: v.state || null,
        operatingHours: v.operatingHours || null,
        about: v.about || null,
        tagline: v.tagline || null,
        mission: v.mission || null,
        vision: v.vision || null,
        ownershipType: v.ownershipType || null,
        establishedYear: v.establishedYear.trim() ? Number(v.establishedYear) : null,
        languagesSpoken: v.languagesSpoken.split(",").map((l) => l.trim()).filter(Boolean),
        paymentMethods: v.paymentMethods.split(",").map((l) => l.trim()).filter(Boolean),
        emergencyContact: v.emergencyContact || null,
        phone: v.phone || null,
        email: v.email || null,
        slug: v.slug || null,
        isPublished: v.isPublished,
      });
      setMessage("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Facility profile and public page</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fp-address">Address</Label>
            <Input id="fp-address" value={v.addressLine} onChange={set("addressLine")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-hours">Opening hours</Label>
            <Input id="fp-hours" value={v.operatingHours} onChange={set("operatingHours")} placeholder="e.g. Mon–Fri 8am–5pm, Sat 9am–1pm" className="rounded-lg" />
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
            <Label htmlFor="fp-tagline">Tagline</Label>
            <Input id="fp-tagline" value={v.tagline} onChange={set("tagline")} placeholder="e.g. Accurate diagnostics. Faster answers." className="rounded-lg" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fp-about">About</Label>
            <Input id="fp-about" value={v.about} onChange={set("about")} placeholder="A short description for patients" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-mission">Mission</Label>
            <Input id="fp-mission" value={v.mission} onChange={set("mission")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-vision">Vision</Label>
            <Input id="fp-vision" value={v.vision} onChange={set("vision")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-ownership">Ownership</Label>
            <select id="fp-ownership" className={select} value={v.ownershipType} onChange={set("ownershipType")}>
              <option value="">—</option>
              {OWNERSHIP.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-established">Established year</Label>
            <Input id="fp-established" inputMode="numeric" value={v.establishedYear} onChange={set("establishedYear")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-phone">Contact phone</Label>
            <Input id="fp-phone" value={v.phone} onChange={set("phone")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-email">Contact email</Label>
            <Input id="fp-email" type="email" value={v.email} onChange={set("email")} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-languages">Languages spoken (comma-separated)</Label>
            <Input id="fp-languages" value={v.languagesSpoken} onChange={set("languagesSpoken")} placeholder="English, Yoruba, Hausa" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-payments">Payment methods (comma-separated)</Label>
            <Input id="fp-payments" value={v.paymentMethods} onChange={set("paymentMethods")} placeholder="Card, Bank transfer, Cash" className="rounded-lg" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fp-emergency">Emergency contact</Label>
            <Input id="fp-emergency" value={v.emergencyContact} onChange={set("emergencyContact")} className="rounded-lg" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fp-slug">Web address (slug)</Label>
            <Input id="fp-slug" value={v.slug} onChange={set("slug")} placeholder="e.g. medlab-diagnostics" className="rounded-lg" />
            {v.slug && <p className="text-xs text-muted-foreground">Public page: /{publicDirectory}/{v.slug}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-publish">Public page</Label>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                id="fp-publish"
                type="checkbox"
                className="h-4 w-4"
                checked={v.isPublished}
                onChange={(e) => setV((s) => ({ ...s, isPublished: e.target.checked }))}
              />
              Publish the facility page
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-600 sm:col-span-2">{message}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="rounded-lg bg-foreground text-background">
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
