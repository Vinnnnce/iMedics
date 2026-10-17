"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FacilityBookForm } from "@/components/shared/facility-book-form";
import { formatMoney } from "@/lib/money";

export interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  turnaroundHours: number | null;
  availability: string | null;
  preparationInstructions: string | null;
  referralRequired: boolean;
  homeCollectionAvailable: boolean;
  urgentAvailable: boolean;
  branch: { name: string } | null;
  department: { name: string } | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  LAB_TEST: "Lab test", IMAGING: "Imaging", PROCEDURE: "Procedure", CONSULTATION: "Consultation", OTHER: "Other",
};

/** Searchable, filterable price list for the public facility portfolio. */
export function FacilityServiceCatalog({
  services,
  canBook,
  signInUrl,
  facility,
}: {
  services: CatalogService[];
  canBook: boolean;
  signInUrl: string;
  facility: { name: string; addressLine: string | null; city: string | null; state: string | null; operatingHours: string | null };
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [homeOnly, setHomeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "turnaround">("name");

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(services.map((s) => s.category)))],
    [services],
  );
  const branches = useMemo(
    () => ["ALL", ...Array.from(new Set(services.map((s) => s.branch?.name ?? "Main")))],
    [services],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = services.filter((s) => {
      if (category !== "ALL" && s.category !== category) return false;
      if (branch !== "ALL" && (s.branch?.name ?? "Main") !== branch) return false;
      if (homeOnly && !s.homeCollectionAvailable) return false;
      if (needle && !(`${s.name} ${s.description ?? ""}`.toLowerCase().includes(needle))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "turnaround") return (a.turnaroundHours ?? 1e9) - (b.turnaroundHours ?? 1e9);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [services, q, category, branch, homeOnly, sortBy]);

  const select = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">This facility has not published its price list yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 basis-48">
          <label htmlFor="service-search" className="mb-1 block text-xs text-muted-foreground">Search services</label>
          <input
            id="service-search"
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            placeholder="e.g. Full blood count, MRI"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="service-category" className="mb-1 block text-xs text-muted-foreground">Category</label>
          <select id="service-category" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c === "ALL" ? "All categories" : CATEGORY_LABEL[c] ?? c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="service-branch" className="mb-1 block text-xs text-muted-foreground">Branch</label>
          <select id="service-branch" className={select} value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => <option key={b} value={b}>{b === "ALL" ? "All branches" : b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="service-sort" className="mb-1 block text-xs text-muted-foreground">Sort by</label>
          <select id="service-sort" className={select} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="name">Name</option>
            <option value="price-asc">Price (low first)</option>
            <option value="turnaround">Turnaround (fast first)</option>
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={homeOnly} onChange={(e) => setHomeOnly(e.target.checked)} />
          Home collection
        </label>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No services match your filters.</p>
      )}

      <div className="grid gap-3">
        {filtered.map((s) => (
          <Card key={s.id} className="beeline-card">
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <Badge variant="outline" className="rounded-lg text-xs">{CATEGORY_LABEL[s.category] ?? s.category}</Badge>
                    {s.referralRequired && <Badge variant="secondary" className="rounded-lg text-xs text-amber-700">Referral required</Badge>}
                    {s.homeCollectionAvailable && <Badge variant="outline" className="rounded-lg text-xs">Home collection</Badge>}
                    {s.urgentAvailable && <Badge variant="outline" className="rounded-lg text-xs">Urgent option</Badge>}
                  </div>
                  {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[s.branch?.name ?? facility.name, s.department?.name].filter(Boolean).join(" · ")}
                    {s.availability ? ` · ${s.availability}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{s.price > 0 ? formatMoney(s.price.toString(), s.currency) : "Free"}</p>
                  {s.turnaroundHours != null && <p className="text-xs text-muted-foreground">≈ {s.turnaroundHours} h turnaround</p>}
                </div>
              </div>

              {s.preparationInstructions && (
                <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                  <span className="font-medium">Before you come:</span> {s.preparationInstructions}
                </p>
              )}

              {canBook ? (
                <FacilityBookForm
                  service={{ id: s.id, name: s.name, description: s.description, price: s.price, currency: s.currency, availability: s.availability }}
                  facility={facility}
                />
              ) : (
                <Link href={signInUrl} className="inline-block">
                  <Button size="sm" variant="outline">Sign in to book</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
