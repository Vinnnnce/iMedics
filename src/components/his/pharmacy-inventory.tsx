"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass } from "./use-api";

interface StockBatch {
  id: string;
  medicationName: string;
  strength: string | null;
  form: string | null;
  batchNumber: string;
  quantity: number;
  unitCost: string | null;
  expiresAt: string;
  notes: string | null;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  _count: { orders: number; batches: number };
}

interface PurchaseOrder {
  id: string;
  status: string;
  reference: string | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  items: { id: string; medicationName: string; quantity: number; receivedQuantity: number }[];
}

interface ControlledEvent {
  id: string;
  medicationName: string;
  eventType: string;
  quantity: number;
  unit: string | null;
  reference: string | null;
  createdAt: string;
  staff: { name: string } | null;
  patient: { caseNumber: string } | null;
}

type Tab = "stock" | "suppliers" | "orders" | "controlled";

/** Pharmacy inventory: stock batches, suppliers, purchase orders and the controlled register. */
export function PharmacyInventory() {
  const [tab, setTab] = useState<Tab>("stock");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState("");

  const [batches, setBatches] = useState<StockBatch[] | null>(null);
  const [summary, setSummary] = useState<{ totalBatches: number; totalUnits: number; totalValue: number; expired: number; expiring90Days: number } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [controlled, setControlled] = useState<ControlledEvent[] | null>(null);

  const [receiveForm, setReceiveForm] = useState({ medicationName: "", strength: "", form: "", batchNumber: "", quantity: "", unitCost: "", expiresAt: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", contactName: "", email: "", phone: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [inv, sup, pos, reg] = await Promise.all([
        api<{ batches: StockBatch[]; summary: typeof summary }>(`/api/facility/his/pharmacy/inventory${stockFilter ? `?filter=${stockFilter}` : ""}`),
        api<{ suppliers: Supplier[] }>("/api/facility/his/pharmacy/suppliers"),
        api<{ orders: PurchaseOrder[] }>("/api/facility/his/pharmacy/purchase-orders"),
        api<{ events: ControlledEvent[] }>("/api/facility/his/pharmacy/controlled-register"),
      ]);
      setBatches(inv.batches);
      setSummary(inv.summary);
      setSuppliers(sup.suppliers);
      setOrders(pos.orders);
      setControlled(reg.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [stockFilter]);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      await api("/api/facility/his/pharmacy/inventory", {
        body: {
          ...receiveForm,
          quantity: Number(receiveForm.quantity),
          ...(receiveForm.unitCost ? { unitCost: Number(receiveForm.unitCost) } : {}),
          strength: receiveForm.strength || undefined,
          form: receiveForm.form || undefined,
        },
      });
      setMessage("Stock batch received.");
      setReceiveForm({ medicationName: "", strength: "", form: "", batchNumber: "", quantity: "", unitCost: "", expiresAt: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      await api("/api/facility/his/pharmacy/suppliers", {
        body: { ...supplierForm, contactName: supplierForm.contactName || undefined, email: supplierForm.email || undefined, phone: supplierForm.phone || undefined },
      });
      setMessage("Supplier added.");
      setSupplierForm({ name: "", contactName: "", email: "", phone: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pharmacy inventory">
        {([["stock", "Stock"], ["suppliers", "Suppliers"], ["orders", "Purchase orders"], ["controlled", "Controlled register"]] as const).map(([k, label]) => (
          <Button key={k} size="sm" role="tab" aria-selected={tab === k} variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)} data-testid={`tab-pharmacy-${k}`}>{label}</Button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-testid="text-pharmacy-error">{error}</p>}
      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-pharmacy-message">{message}</p>}

      {tab === "stock" && (
        <div className="space-y-4">
          {summary && (
            <div className="grid gap-3 sm:grid-cols-5">
              <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Batches</div><div className="text-xl font-bold">{summary.totalBatches}</div></CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Units</div><div className="text-xl font-bold">{summary.totalUnits}</div></CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Stock value</div><div className="text-xl font-bold">{summary.totalValue.toFixed(2)}</div></CardContent></Card>
              <Card className="rounded-2xl border-l-4 border-l-red-500"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expired</div><div className="text-xl font-bold">{summary.expired}</div></CardContent></Card>
              <Card className="rounded-2xl border-l-4 border-l-amber-500"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expiring ≤ 90 days</div><div className="text-xl font-bold">{summary.expiring90Days}</div></CardContent></Card>
            </div>
          )}

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Receive stock batch</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-2 sm:grid-cols-4" onSubmit={receive} data-testid="form-receive-stock">
                <label className="text-xs">Medication<input required className={inputClass} value={receiveForm.medicationName} onChange={(e) => setReceiveForm({ ...receiveForm, medicationName: e.target.value })} data-testid="input-stock-medication" /></label>
                <label className="text-xs">Strength<input className={inputClass} value={receiveForm.strength} onChange={(e) => setReceiveForm({ ...receiveForm, strength: e.target.value })} /></label>
                <label className="text-xs">Form<input className={inputClass} value={receiveForm.form} onChange={(e) => setReceiveForm({ ...receiveForm, form: e.target.value })} /></label>
                <label className="text-xs">Batch number<input required className={inputClass} value={receiveForm.batchNumber} onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })} /></label>
                <label className="text-xs">Quantity<input required inputMode="numeric" className={inputClass} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} /></label>
                <label className="text-xs">Unit cost (optional)<input inputMode="decimal" className={inputClass} value={receiveForm.unitCost} onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: e.target.value })} /></label>
                <label className="text-xs">Expiry date<input required type="date" className={inputClass} value={receiveForm.expiresAt} onChange={(e) => setReceiveForm({ ...receiveForm, expiresAt: e.target.value })} /></label>
                <Button type="submit" className="self-end" data-testid="button-receive-stock">Receive</Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <select className={inputClass} style={{ maxWidth: 220 }} value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Stock filter">
              <option value="">All stock</option>
              <option value="low">Low stock</option>
              <option value="expiring">Expiring ≤ 90 days</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {batches === null ? <p className="text-sm text-muted-foreground">Loading stock…</p> : batches.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No stock batches tracked yet. Receive your first batch above.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-stock">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Medication</th><th className="p-3">Batch</th><th className="p-3">Quantity</th><th className="p-3">Expiry</th></tr></thead>
                <tbody>
                  {batches.map((b) => {
                    const expired = new Date(b.expiresAt) < new Date();
                    return (
                      <tr key={b.id} className={`border-t ${expired ? "bg-red-50 dark:bg-red-950/30" : ""}`} data-testid={`row-stock-${b.batchNumber}`}>
                        <td className="p-3">{b.medicationName}{b.strength ? ` (${b.strength})` : ""}</td>
                        <td className="p-3 text-xs">{b.batchNumber}</td>
                        <td className="p-3 tabular-nums">{b.quantity}</td>
                        <td className="p-3 text-xs">{new Date(b.expiresAt).toLocaleDateString()}{expired ? <span className="ml-1 font-semibold text-red-600">expired</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Dispensing consumes batches first-expiry-first-out. Controlled medicines automatically enter the controlled register on receipt and dispense.</p>
        </div>
      )}

      {tab === "suppliers" && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Add supplier</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-2 sm:grid-cols-4" onSubmit={addSupplier} data-testid="form-add-supplier">
                <label className="text-xs">Name<input required className={inputClass} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label>
                <label className="text-xs">Contact<input className={inputClass} value={supplierForm.contactName} onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })} /></label>
                <label className="text-xs">Email<input type="email" className={inputClass} value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></label>
                <label className="text-xs">Phone<input className={inputClass} value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label>
                <Button type="submit" className="sm:col-span-4 self-end" data-testid="button-add-supplier">Add supplier</Button>
              </form>
            </CardContent>
          </Card>
          {suppliers === null ? <p className="text-sm text-muted-foreground">Loading suppliers…</p> : suppliers.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No suppliers yet.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-suppliers">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Supplier</th><th className="p-3">Contact</th><th className="p-3">Orders</th><th className="p-3">Batches</th></tr></thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-3">{s.name}</td>
                      <td className="p-3 text-xs">{[s.contactName, s.email, s.phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="p-3 tabular-nums">{s._count.orders}</td>
                      <td className="p-3 tabular-nums">{s._count.batches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Purchase orders flow draft → submitted → received. Receiving requires batch numbers and expiry dates, and creates the corresponding stock batches.</p>
          {orders === null ? <p className="text-sm text-muted-foreground">Loading purchase orders…</p> : orders.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No purchase orders yet. Create them from the formulary workflow.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-pos">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Order</th><th className="p-3">Supplier</th><th className="p-3">Items</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-3 text-xs">{o.reference ?? o.id.slice(0, 8)}<div className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</div></td>
                      <td className="p-3 text-xs">{o.supplier?.name ?? "—"}</td>
                      <td className="p-3 text-xs">{o.items.map((i) => `${i.medicationName} ×${i.quantity}`).join(", ")}</td>
                      <td className="p-3 text-xs"><span className="rounded-full bg-muted px-2 py-1">{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "controlled" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Legally required register for controlled medicines: every receipt, dispense, return, destruction and adjustment, with the acting staff member and patient.</p>
          {controlled === null ? <p className="text-sm text-muted-foreground">Loading register…</p> : controlled.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No controlled-medicine events recorded.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-controlled">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Medication</th><th className="p-3">Event</th><th className="p-3">Quantity</th><th className="p-3">By</th><th className="p-3">Patient</th></tr></thead>
                <tbody>
                  {controlled.map((ev) => (
                    <tr key={ev.id} className="border-t">
                      <td className="p-3 text-xs">{new Date(ev.createdAt).toLocaleString()}</td>
                      <td className="p-3">{ev.medicationName}</td>
                      <td className="p-3 text-xs">{ev.eventType}</td>
                      <td className="p-3 tabular-nums text-xs">{ev.quantity} {ev.unit ?? ""}</td>
                      <td className="p-3 text-xs">{ev.staff?.name ?? "—"}</td>
                      <td className="p-3 text-xs">{ev.patient?.caseNumber ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
