"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";

interface CommissionRule {
  id: string;
  providerType: string;
  facilityId: string | null;
  facilityName: string | null;
  kind: "PERCENT" | "FIXED";
  value: number;
  currency: string | null;
  active: boolean;
  note: string | null;
}

const PROVIDER_TYPES = [
  { value: "DOCTOR", label: "Doctors" },
  { value: "HOSPITAL", label: "Hospitals" },
  { value: "LABORATORY", label: "Laboratories" },
  { value: "DIAGNOSTIC_CENTRE", label: "Diagnostic centres" },
];

/** Admins configure how Medic1905's commission on provider charges is computed. */
export function CommissionManager() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // New default rule form
  const [providerType, setProviderType] = useState("DOCTOR");
  const [kind, setKind] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ rules: CommissionRule[] }>("/admin/commission-rules");
      setRules(data.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load commission rules");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiClient.post("/admin/commission-rules", {
        providerType,
        kind,
        value: Number(value),
      });
      setValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rule");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rule: CommissionRule) => {
    setBusy(true);
    try {
      await apiClient.patch(`/admin/commission-rules/${rule.id}`, { active: !rule.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the rule");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rule: CommissionRule) => {
    setBusy(true);
    try {
      await apiClient.delete(`/admin/commission-rules/${rule.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the rule");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Default commission per provider type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="rule-type">Provider type</Label>
              <select
                id="rule-type"
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
              >
                {PROVIDER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-kind">Kind</Label>
              <select
                id="rule-kind"
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as "PERCENT" | "FIXED")}
              >
                <option value="PERCENT">Percent of the charge</option>
                <option value="FIXED">Flat amount (NGN)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-value">{kind === "PERCENT" ? "Percent (0–100)" : "Amount"}</Label>
              <Input
                id="rule-value"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-32"
                required
              />
            </div>
            <Button type="submit" disabled={busy || value.trim() === ""}>
              Save rule
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Saving a default replaces the previous default for that provider type. Facility-specific overrides win over the
            default.
          </p>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">All rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commission rules yet. Medic1905 takes no commission until you add one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider type</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{PROVIDER_TYPES.find((t) => t.value === rule.providerType)?.label ?? rule.providerType}</TableCell>
                    <TableCell>{rule.facilityName ?? "Default"}</TableCell>
                    <TableCell>
                      {rule.kind === "PERCENT" ? `${rule.value}%` : `₦${rule.value}`}
                    </TableCell>
                    <TableCell>{rule.active ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => toggle(rule)} disabled={busy}>
                        {rule.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => remove(rule)} disabled={busy}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
