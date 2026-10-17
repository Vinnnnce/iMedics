"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { CATEGORY_LABEL, type ServiceCategoryKey } from "@/lib/facility-services";
import { SUPPORTED_CURRENCIES, formatMoney } from "@/lib/money";

type Category = ServiceCategoryKey;

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  price: number;
  currency: string;
  turnaroundHours: number | null;
  availability: string | null;
  isActive: boolean;
}

const empty = { name: "", description: "", category: "LAB_TEST" as Category, price: "", currency: "NGN", turnaroundHours: "", availability: "" };
const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** A facility's price list: add, reprice, hide and remove the services patients can book. */
export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm(empty);
    setEditingId(null);
    setError("");
  };

  const edit = (s: ServiceRow) => {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description ?? "", category: s.category, price: s.price.toString(), currency: s.currency, turnaroundHours: s.turnaroundHours?.toString() ?? "", availability: s.availability ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.price.trim() === "" || Number.isNaN(Number(form.price))) {
      setError("Enter a price (0 for free).");
      return;
    }
    setBusy(true);
    const body = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      currency: form.currency,
      turnaroundHours: form.turnaroundHours.trim() ? Number(form.turnaroundHours) : null,
      availability: form.availability,
    };
    try {
      if (editingId) await apiClient.patch(`/facility/services/${editingId}`, body);
      else await apiClient.post("/facility/services", body);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the service");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: ServiceRow) => {
    await apiClient.patch(`/facility/services/${s.id}`, { isActive: !s.isActive });
    router.refresh();
  };

  const remove = async (s: ServiceRow) => {
    if (!window.confirm(`Remove "${s.name}"? Services that have been booked are hidden instead.`)) return;
    await apiClient.delete(`/facility/services/${s.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Edit service" : "Add a service"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="svc-name">Service name</Label>
              <Input id="svc-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Full blood count" className="rounded-lg" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-cat">Type</Label>
              <select id="svc-cat" className={select} value={form.category} onChange={(e) => set("category", e.target.value as Category)}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Price</Label>
                <Input id="svc-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="e.g. 5000" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-cur">Currency</Label>
                <select id="svc-cur" className={select} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Input id="svc-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What the service includes, preparation needed…" className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-avail">Availability</Label>
              <Input id="svc-avail" value={form.availability} onChange={(e) => set("availability", e.target.value)} placeholder="e.g. Mon–Sat 8am–4pm" className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-tat">Results ready in (hours)</Label>
              <Input id="svc-tat" inputMode="numeric" value={form.turnaroundHours} onChange={(e) => set("turnaroundHours", e.target.value)} placeholder="optional" className="rounded-lg" />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy} className="rounded-lg bg-foreground text-background">
                <Plus className="mr-1 h-4 w-4" /> {editingId ? "Save changes" : "Add service"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" className="rounded-lg" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Your services ({services.length})</h2>
        {services.length === 0 && <p className="text-sm text-muted-foreground">No services yet. Patients can only book services you add here.</p>}
        {services.map((s) => (
          <Card key={s.id} className="beeline-card">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <Badge variant="outline" className="rounded-lg text-xs">
                    {CATEGORY_LABEL[s.category]}
                  </Badge>
                  {!s.isActive && (
                    <Badge variant="secondary" className="rounded-lg text-xs">
                      Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{s.price > 0 ? formatMoney(s.price, s.currency) : "Free"}</p>
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {[s.availability, s.turnaroundHours ? `Results in ${s.turnaroundHours}h` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => edit(s)}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle(s)}>
                  {s.isActive ? "Hide" : "Show"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
