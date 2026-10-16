"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { SERVICE_KINDS, SERVICE_KIND_LABELS, type ServiceKind } from "@/lib/doctor-profile";

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

/** Search-as-you-type picker for ICD-10 codes, validated against the platform's code set. */
function Icd10Picker({ codes, onChange }: { codes: string[]; onChange: (codes: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ code: string; display: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        if (!cancelled) {
          setResults([]);
          setOpen(false);
        }
        return;
      }
      apiClient
        .get<{ codes: { code: string; display: string }[] }>(`/icd10?search=${encodeURIComponent(query.trim())}`)
        .then((data) => {
          if (!cancelled) {
            setResults(data.codes.slice(0, 8));
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const add = (code: string) => {
    if (!codes.includes(code)) onChange([...codes, code]);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search ICD-10 codes by code or condition"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search ICD-10 codes"
          />
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-input bg-background shadow-sm">
            {results.map((result) => (
              <li key={result.code}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => add(result.code)}
                >
                  <span className="font-medium">{result.code}</span> · {result.display}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {codes.map((code) => (
            <Badge key={code} variant="outline" className="rounded-lg text-xs">
              {code}
              <button type="button" aria-label={`Remove ${code}`} className="ml-1" onClick={() => onChange(codes.filter((c) => c !== code))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyDraft = {
  kind: "NEW_PATIENT",
  name: "",
  description: "",
  modes: [] as string[],
  duration: "30",
  price: "",
  followUpPrice: "",
  followUpWindow: "14",
  icd10Codes: [] as string[],
  cancellation: "",
  refund: "",
  includes: "",
  addOns: "",
};

/** The doctor's bookable service catalogue: prices, duration, ICD-10 links, terms. */
export function ServiceManager({ currency }: { currency?: string }) {
  const router = useRouter();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [kind, setKind] = useState(emptyDraft.kind);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modes, setModes] = useState<string[]>([]);
  const [duration, setDuration] = useState(emptyDraft.duration);
  const [price, setPrice] = useState("");
  const [followUpPrice, setFollowUpPrice] = useState("");
  const [followUpWindow, setFollowUpWindow] = useState(emptyDraft.followUpWindow);
  const [icd10, setIcd10] = useState<string[]>([]);
  const [cancellation, setCancellation] = useState("");
  const [refund, setRefund] = useState("");
  const [includes, setIncludes] = useState("");
  const [addOns, setAddOns] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ services: Service[] }>("/doctors/me/services")
      .then((data) => {
        if (!cancelled) setServices(data.services);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your services");
          setServices([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const split = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setKind(service.kind);
    setName(service.name);
    setDescription(service.description ?? "");
    setModes(service.modes);
    setDuration(String(service.durationMinutes));
    setPrice(String(service.price));
    setFollowUpPrice(service.followUpPrice === null ? "" : String(service.followUpPrice));
    setFollowUpWindow(String(service.followUpWindowDays ?? 14));
    setIcd10(service.icd10Codes);
    setCancellation(service.cancellationTerms ?? "");
    setRefund(service.refundTerms ?? "");
    setIncludes(service.includes.join(", "));
    setAddOns(service.addOns.join(", "));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setKind(emptyDraft.kind);
    setName("");
    setDescription("");
    setModes([]);
    setDuration(emptyDraft.duration);
    setPrice("");
    setFollowUpPrice("");
    setIcd10([]);
    setCancellation("");
    setRefund("");
    setIncludes("");
    setAddOns("");
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const body = {
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
      icd10Codes: icd10,
      cancellationTerms: cancellation || null,
      refundTerms: refund || null,
      includes: split(includes),
      addOns: split(addOns),
    };
    try {
      if (editingId) {
        await apiClient.put(`/doctors/me/services/${editingId}`, { ...body, isActive: services?.find((s) => s.id === editingId)?.isActive ?? true });
        toast.success("Service updated");
      } else {
        await apiClient.post("/doctors/me/services", body);
        toast.success("Service added");
      }
      resetForm();
      setServices(null);
      router.refresh();
      const refreshed = await apiClient.get<{ services: Service[] }>("/doctors/me/services");
      setServices(refreshed.services);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the service");
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
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => startEdit(service)}>
                  Edit
                </Button>
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
          <p className="font-medium">{editingId ? "Edit service" : "Add a service"}</p>
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
          <div className="space-y-1 text-xs text-muted-foreground">
            ICD-10 codes (validated against the platform&rsquo;s code set)
            <Icd10Picker codes={icd10} onChange={setIcd10} />
          </div>
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
          <div className="flex gap-2">
            <Button type="button" className="bg-foreground text-background rounded-lg" disabled={busy || name.length < 3 || price === ""} onClick={save}>
              <Plus className="mr-1 h-4 w-4" /> {editingId ? "Save changes" : "Add service"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" className="rounded-lg" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sample prices in any documentation are illustrative; you set your own.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
