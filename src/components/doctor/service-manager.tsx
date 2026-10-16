"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { SERVICE_KINDS, SERVICE_KIND_LABELS, type ServiceKind } from "@/lib/doctor-profile";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

interface Service {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  modes: string[];
  durationMinutes: number;
  currency: string;
  price: number;
  followUpPrice: number | null;
  followUpWindowDays: number | null;
  isActive: boolean;
  icd10Codes: string[];
  cancellationTerms: string | null;
  refundTerms: string | null;
  includes: string[];
  addOns: string[];
}

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const textarea = "min-h-16 w-full rounded-lg border border-input bg-background p-2 text-sm";
const MODES = ["CHAT", "VIDEO", "IN_PERSON"] as const;

/** The doctor's bookable service catalogue: prices, duration, ICD-10 links, terms. */
export function ServiceManager({ currency }: { currency?: string }) {
  const router = useRouter();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // New-service draft
  const [kind, setKind] = useState<string>("NEW_PATIENT");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modes, setModes] = useState<string[]>([]);
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [followUpPrice, setFollowUpPrice] = useState("");
  const [followUpWindow, setFollowUpWindow] = useState("14");
  const [icd10, setIcd10] = useState("");
  const [cancellation, setCancellation] = useState("");
  const [refund, setRefund] = useState("");
  const [includes, setIncludes] = useState("");
  const [addOns, setAddOns] = useState("");

  if (services === null && !busy) {
    setBusy(true);
    apiClient
      .get<{ services: Service[] }>("/doctors/me/services")
      .then((data) => setServices(data.services))
      .catch(() => {
        setError("Could not load your services");
        setServices([]);
      })
      .finally(() => setBusy(false));
  }

  const split = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

  const create = async () => {
    setError("");
    setBusy(true);
    try {
      await apiClient.post("/doctors/me/services", {
        kind,
        name,
        description: description || null,
        modes,
        durationMinutes: Number(duration) || 30,
        currency: currency ?? "NGN",
        price: Number(price),
        followUpPrice: followUpPrice === "" ? null : Number(followUpPrice),
        followUpWindowDays: followUpPrice === "" ? null : Number(followUpWindow) || 14,
        isActive: true,
        icd10Codes: split(icd10).map((c) => c.toUpperCase()),
        cancellationTerms: cancellation || null,
        refundTerms: refund || null,
        includes: split(includes),
        addOns: split(addOns),
      });
      toast.success("Service added");
      setName("");
      setDescription("");
      setPrice("");
      setFollowUpPrice("");
      setIcd10("");
      setCancellation("");
      setRefund("");
      setIncludes("");
      setAddOns("");
      setServices(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the service");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (service: Service) => {
    setBusy(true);
    try {
      await apiClient.put(`/doctors/me/services/${service.id}`, { ...service, isActive: !service.isActive });
      setServices((prev) => (prev ? prev.map((s) => (s.id === service.id ? { ...s, isActive: !s.isActive } : s)) : prev));
      toast.success(service.isActive ? "Service deactivated" : "Service activated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the service");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (service: Service) => {
    setBusy(true);
    try {
      const result = await apiClient.delete<{ deleted: boolean }>(`/doctors/me/services/${service.id}`);
      if (result.deleted) {
        setServices((prev) => (prev ? prev.filter((s) => s.id !== service.id) : prev));
        toast.success("Service deleted");
      } else {
        setServices((prev) => (prev ? prev.map((s) => (s.id === service.id ? { ...s, isActive: false } : s)) : prev));
        toast.success("Service has bookings, so it was deactivated instead");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the service");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {services === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {services?.map((service) => (
        <Card key={service.id} className="beeline-card">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-muted-foreground">
                  {SERVICE_KIND_LABELS[service.kind as ServiceKind] ?? service.kind} · {service.durationMinutes} min · {service.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={service.isActive ? "default" : "outline"} className="rounded-lg">
                  {service.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => toggleActive(service)}>
                  {service.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => remove(service)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="font-medium">
              {service.price > 0 ? `${service.price} ${service.currency}` : "Free"}
              {service.followUpPrice !== null && (
                <span className="font-normal text-muted-foreground">
                  {" "}· follow-up {service.followUpPrice > 0 ? `${service.followUpPrice} ${service.currency}` : "Free"}
                  {service.followUpWindowDays ? ` (within ${service.followUpWindowDays} days)` : ""}
                </span>
              )}
            </p>
            {service.icd10Codes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {service.icd10Codes.map((code) => (
                  <Badge key={code} variant="outline" className="rounded-lg text-xs">{code}</Badge>
                ))}
              </div>
            )}
            {service.description && <p className="text-muted-foreground">{service.description}</p>}
          </CardContent>
        </Card>
      ))}

      <Card className="beeline-card">
        <CardContent className="space-y-4 p-4">
          <p className="font-medium">Add a service</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs text-muted-foreground">
              Type
              <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
                {SERVICE_KINDS.map((k) => (
                  <option key={k} value={k}>{SERVICE_KIND_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Name
              <input className={field} placeholder="e.g. First cardiology consultation" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Duration (minutes)
              <input className={field} type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Price ({currency ?? "your account currency"})
              <input className={field} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Follow-up price (optional)
              <input className={field} type="number" min={0} step="0.01" value={followUpPrice} onChange={(e) => setFollowUpPrice(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Follow-up window (days)
              <input className={field} type="number" min={1} max={90} value={followUpWindow} onChange={(e) => setFollowUpWindow(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Modes (leave empty for any)
            <div className="flex flex-wrap gap-3 pt-1">
              {MODES.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-foreground"
                    checked={modes.includes(m)}
                    onChange={(e) => setModes((prev) => (e.target.checked ? [...prev, m] : prev.filter((v) => v !== m)))}
                  />
                  {m === "CHAT" ? "Chat" : m === "VIDEO" ? "Video" : "In person"}
                </label>
              ))}
            </div>
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            ICD-10 codes (comma-separated, must exist in the platform&rsquo;s code set)
            <input className={field} placeholder="e.g. I10, E11.9" value={icd10} onChange={(e) => setIcd10(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Description
            <textarea className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Cancellation terms (optional)
            <textarea className={textarea} value={cancellation} onChange={(e) => setCancellation(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Refund terms (optional)
            <textarea className={textarea} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs text-muted-foreground">
              Included (comma-separated)
              <input className={field} value={includes} onChange={(e) => setIncludes(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Add-ons (comma-separated)
              <input className={field} value={addOns} onChange={(e) => setAddOns(e.target.value)} />
            </label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" className="bg-foreground text-background rounded-lg" disabled={busy || name.length < 3 || price === ""} onClick={create}>
            <Plus className="mr-1 h-4 w-4" /> Add service
          </Button>
          <p className="text-xs text-muted-foreground">
            Sample prices in any documentation are illustrative; you set your own. {SUPPORTED_CURRENCIES.length > 0 ? `Account currency: ${currency ?? "NGN"}.` : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
