"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Panel, ItemTable, apiClient, useDashboardMutation } from "./common";
import type { WorkspaceData } from "@/lib/workspace/types";
export function PatientPayments({ data }: { data: WorkspaceData }) {
  const [selected, setSelected] = useState("");
  const mutation = useDashboardMutation();
  async function dispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, reason = String(new FormData(form).get("reason"));
    await mutation.run(async () => { await apiClient.post("/workspace/operations", { action: "dispute", paymentId: selected, reason }); form.reset(); setSelected(""); }, "Payment dispute submitted for review");
  }
  return <Panel title="Payments and disputes"><ItemTable items={data.payments} title="Payments" exportSection="payments" actions={payment => <div className="flex flex-wrap gap-2">
    <Link href={`/payments/${payment.id}`} className="rounded-sm text-sm underline">View payment</Link><Button size="sm" variant="outline" disabled={!data.extensionsReady || mutation.busy} onClick={() => setSelected(payment.id)}>Raise dispute</Button>
  </div>} />{mutation.errorUI}<form onSubmit={dispute} className="space-y-3">
    <p className="text-sm">Selected payment: {selected || "Choose a payment above"}</p>
    <FormField label="Dispute reason" required><textarea name="reason" minLength={10} maxLength={2000} required rows={3} className="w-full rounded-lg border border-input bg-background p-3 text-sm" /></FormField>
    <label className="flex gap-2 text-sm"><input type="checkbox" required />I confirm this dispute request. It does not automatically refund or reverse the payment.</label>
    <Button type="submit" variant="outline" disabled={!selected || !data.extensionsReady || mutation.busy}>Submit dispute</Button>
  </form></Panel>;
}
