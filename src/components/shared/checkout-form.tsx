"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, methodsForCurrency } from "@/lib/payments/config";
import { cn } from "@/lib/utils";

type Method = keyof typeof PAYMENT_METHODS;

interface Props {
  amount: number;
  currency: string;
  /** Start checkout for an existing payment. Omit and pass `prepare` to create the booking first. */
  paymentId?: string;
  /** Creates the booking and returns the payment to charge. Used when paying straight from the booking form. */
  prepare?: () => Promise<{ paymentId: string }>;
  label?: string;
}

/** Payment-method step: shows the total and currency, lets the patient choose how to pay, then opens the gateway. */
export function CheckoutForm({ amount, currency, paymentId, prepare, label = "Pay" }: Props) {
  const methods = methodsForCurrency(currency) as Method[];
  const [method, setMethod] = useState<Method | null>(methods[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = formatMoney(amount, currency);

  const pay = async () => {
    if (!method) return;
    setBusy(true);
    setError("");
    try {
      const id = paymentId ?? (await prepare!()).paymentId;
      const { checkoutUrl } = await apiClient.post<{ checkoutUrl: string }>(`/payments/${id}/checkout`, { method });
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="checkout-form">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs text-muted-foreground">Payment method</legend>
        {methods.map((m) => (
          <label
            key={m}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
              method === m ? "border-foreground bg-muted" : "border-border",
            )}
          >
            <input type="radio" name="payment-method" className="accent-foreground" checked={method === m} onChange={() => setMethod(m)} />
            <span className="flex-1">
              <span className="block font-medium">{PAYMENT_METHODS[m].label}</span>
              <span className="block text-xs text-muted-foreground">{PAYMENT_METHODS[m].description}</span>
            </span>
          </label>
        ))}
        {methods.length === 0 && <p className="text-sm text-destructive">No payment method is available in {currency}.</p>}
      </fieldset>

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total ({currency})</span>
        <span className="font-semibold">{total}</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full rounded-lg bg-foreground text-background" disabled={!method || busy} onClick={pay}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        {label} {total}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You will be taken to our secure payment partner to finish paying.</p>
    </div>
  );
}
