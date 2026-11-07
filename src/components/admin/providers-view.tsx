"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface ProviderRecord {
  userId: string;
  name: string;
  email: string;
  accountStatus: string;
  providerType: string;
  verificationStatus: string | null;
  missingRequirements: string[];
  subaccount: {
    status: string;
    subaccountCode: string | null;
    lastError: string | null;
    settlementBank: string;
    accountNumber: string;
    businessName: string;
  } | null;
}

const TYPE_LABELS: Record<string, string> = {
  DOCTOR: "Doctor",
  HOSPITAL: "Hospital",
  LABORATORY: "Laboratory",
  DIAGNOSTIC_CENTRE: "Diagnostic centre",
  PHARMACY: "Pharmacy",
};

/** The provider verification workflow: onboarding checklist, verification state and settlement subaccount. */
export function ProvidersView() {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ providers: ProviderRecord[] }>("/admin/providers");
      setProviders(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load providers");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const retry = async (provider: ProviderRecord) => {
    setBusy(provider.userId);
    setError("");
    try {
      await apiClient.post("/admin/subaccounts", { userId: provider.userId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry provisioning");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {providers.map((provider) => (
        <Card key={provider.userId} className="beeline-card">
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {provider.name} <span className="text-xs text-muted-foreground">({TYPE_LABELS[provider.providerType] ?? provider.providerType})</span>
                </p>
                <p className="text-xs text-muted-foreground">{provider.email}</p>
              </div>
              <div className="text-right text-xs">
                <p>
                  Verification:{" "}
                  <span className={provider.verificationStatus === "VERIFIED" ? "font-medium text-green-600" : "text-muted-foreground"}>
                    {(provider.verificationStatus ?? "pending").toLowerCase()}
                  </span>
                </p>
                <p>
                  Payout:{" "}
                  <span className="text-muted-foreground">
                    {provider.subaccount ? provider.subaccount.status.toLowerCase() : "not set up"}
                  </span>
                </p>
              </div>
            </div>

            {provider.missingRequirements.length > 0 && (
              <p className="text-xs text-muted-foreground">Missing: {provider.missingRequirements.join(", ")}</p>
            )}

            {provider.subaccount?.status === "FAILED" && provider.subaccount.lastError && (
              <p className="text-xs text-destructive">Subaccount error: {provider.subaccount.lastError}</p>
            )}

            {provider.subaccount && provider.subaccount.status !== "CREATED" && (
              <Button variant="outline" size="sm" onClick={() => retry(provider)} disabled={busy === provider.userId}>
                {busy === provider.userId ? "Retrying…" : "Retry payout setup"}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {providers.length === 0 && <p className="text-sm text-muted-foreground">No providers yet.</p>}
    </div>
  );
}
