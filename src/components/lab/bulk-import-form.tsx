"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

const EXAMPLE = `Full Blood Count, LAB_TEST, 5000
Chest X-ray (Ikeja branch), IMAGING, 12000, NGN, , 24, Walk-in, Ikeja`;

interface BulkResult {
  created: number;
  updated: number;
  skipped: number;
  results: Array<{ row: number; name: string; action: string; error?: string }>;
}

const CATEGORIES = ["LAB_TEST", "IMAGING", "PROCEDURE", "CONSULTATION", "OTHER"];

/**
 * Bulk service import for large facilities: paste CSV (name, category, price, currency,
 * description, turnaroundHours, availability, branch) and every row is created or updated.
 */
export function BulkImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const services = csv
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const [name, category, price, currency, description, turnaroundHours, availability, branch] = line.split(",").map((cell) => cell.trim());
          return {
            name,
            category: CATEGORIES.includes(category) ? category : "OTHER",
            price: Number(price),
            currency: currency || "NGN",
            description: description || null,
            turnaroundHours: turnaroundHours ? Number(turnaroundHours) : null,
            availability: availability || null,
            branch: branch || null,
          };
        })
        .filter((service) => service.name && !Number.isNaN(service.price));

      if (services.length === 0) {
        setError("No valid rows found. Each row needs at least a name and a price.");
        return;
      }
      const data = await apiClient.post<BulkResult>("/facility/services/bulk", { services });
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import the services");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Bulk import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste one service per line: <code>name, category, price, currency, description, turnaroundHours, availability, branch</code>.
          Only name, category and price are required. A service with the same name and branch is updated, not duplicated.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bulk-csv">CSV rows</Label>
            <Textarea
              id="bulk-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={EXAMPLE}
              rows={6}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || csv.trim() === ""}>
            {busy ? "Importing…" : `Import ${csv.split("\n").filter((l) => l.trim()).length || ""} rows`}
          </Button>
        </form>
        {result && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              {result.created} created · {result.updated} updated · {result.skipped} skipped
            </p>
            {result.results.filter((r) => r.error).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-destructive">
                {result.results
                  .filter((r) => r.error)
                  .map((r) => (
                    <li key={r.row}>
                      Row {r.row} ({r.name}): {r.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
