"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface PayoutSettings {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  status: string;
  subaccountCode: string | null;
  lastError: string | null;
}

/** Providers submit the bank account their earnings are settled to. */
export function PayoutSettingsForm() {
  const [initial, setInitial] = useState<PayoutSettings | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [settlementBank, setSettlementBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ settings: PayoutSettings | null }>("/me/payout-settings");
      if (data.settings) {
        setInitial(data.settings);
        setBusinessName(data.settings.businessName);
        setSettlementBank(data.settings.settlementBank);
        setAccountNumber(data.settings.accountNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your payout settings");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await apiClient.put("/me/payout-settings", { businessName, settlementBank, accountNumber });
      setMessage("Saved. Your earnings will be settled to this account.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your payout settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Payout account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {initial?.status && (
          <p className="text-xs text-muted-foreground">
            Payout status: {initial.status.toLowerCase()}
            {initial.status === "FAILED" && initial.lastError ? ` — ${initial.lastError}` : ""}
          </p>
        )}
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Account name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="The name your bank account is registered to"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settlementBank">Bank</Label>
            <Input
              id="settlementBank"
              value={settlementBank}
              onChange={(e) => setSettlementBank(e.target.value)}
              placeholder="e.g. Guaranty Trust Bank"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account number</Label>
            <Input
              id="accountNumber"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="10-digit account number"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save payout account"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Your earnings from paid bookings are settled directly to this account. The platform&#39;s commission is deducted
          first.
        </p>
      </CardContent>
    </Card>
  );
}
