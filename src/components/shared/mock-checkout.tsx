"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

/** Test checkout used when no payment gateway is configured (development only). */
export function MockCheckout({ reference, paymentId, total }: { reference: string; paymentId: string; total: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finish = async (outcome: "success" | "failed") => {
    setBusy(true);
    try {
      await apiClient.post("/payments/mock/complete", { reference, outcome });
      router.push(`/payments/${paymentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Test checkout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">No payment gateway is configured, so this stands in for one. No money moves.</p>
        <p className="text-lg font-semibold">{total}</p>
        {error && <p className="text-destructive">{error}</p>}
        <Button className="w-full rounded-lg bg-foreground text-background" disabled={busy} onClick={() => finish("success")}>
          Simulate successful payment
        </Button>
        <Button variant="outline" className="w-full rounded-lg" disabled={busy} onClick={() => finish("failed")}>
          Simulate failed payment
        </Button>
      </CardContent>
    </Card>
  );
}
