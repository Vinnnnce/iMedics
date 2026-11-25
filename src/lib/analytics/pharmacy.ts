import { Prisma } from "@prisma/client";
import { db, bucketedCounts, minutesDiff, ts } from "./sql";
import { attachTargets, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { num, round, summariseDurations } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }

export async function pharmacyFigures(ctx: Ctx, p: P): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const [o] = await db.$queryRaw<{ total: number; reviewed: number; dispensed: number; eligible: number; fulfilled: number; hours: number[] | null }[]>`
    SELECT count(*) FILTER (WHERE m.created_at >= ${ts(p.start)} AND m.created_at < ${ts(p.end)})::int AS total,
      count(*) FILTER (WHERE m.created_at >= ${ts(p.start)} AND m.created_at < ${ts(p.end)} AND m.reviewed_by_id IS NOT NULL)::int AS reviewed,
      count(*) FILTER (WHERE m.dispensed_at >= ${ts(p.start)} AND m.dispensed_at < ${ts(p.end)})::int AS dispensed,
      count(*) FILTER (WHERE m.created_at >= ${ts(p.start)} AND m.created_at < ${ts(p.end)} AND m.status NOT IN ('DRAFT','CANCELLED'))::int AS eligible,
      count(*) FILTER (WHERE m.created_at >= ${ts(p.start)} AND m.created_at < ${ts(p.end)} AND m.status IN ('DISPENSED','COMPLETED'))::int AS fulfilled,
      array_agg(${minutesDiff(Prisma.sql`m.dispensed_at`, Prisma.sql`m.created_at`)} / 60.0) FILTER (WHERE m.dispensed_at >= ${ts(p.start)} AND m.dispensed_at < ${ts(p.end)} AND m.dispensed_at >= m.created_at) AS hours
    FROM medication_order m WHERE m.facility_id = ${f}::uuid`;
  const [po] = await db.$queryRaw<{ orders: number; ordered: number; received: number; spend: number | null }[]>`
    SELECT count(DISTINCT po.id)::int AS orders,
      coalesce(sum(i.quantity) FILTER (WHERE po.status NOT IN ('DRAFT','CANCELLED')), 0)::int AS ordered,
      coalesce(sum(i.received_quantity) FILTER (WHERE po.status NOT IN ('DRAFT','CANCELLED')), 0)::int AS received,
      sum(i.quantity * i.unit_cost) FILTER (WHERE po.status NOT IN ('DRAFT','CANCELLED') AND i.unit_cost IS NOT NULL)::float AS spend
    FROM pharmacy_purchase_orders po LEFT JOIN pharmacy_purchase_order_items i ON i.order_id = po.id
    WHERE po.facility_id = ${f}::uuid AND po.created_at >= ${ts(p.start)} AND po.created_at < ${ts(p.end)}`;
  const [rec] = await db.$queryRaw<{ units: number }[]>`SELECT coalesce(sum(b.quantity), 0)::int AS units FROM pharmacy_stock_batches b WHERE b.facility_id = ${f}::uuid AND b.received_at >= ${ts(p.start)} AND b.received_at < ${ts(p.end)}`;
  const t = summariseDurations((o.hours ?? []).map(Number));
  const figs: Figures = {
    rx_orders: fig(o.total), rx_reviewed: fig(o.reviewed), rx_dispensed: fig(o.dispensed),
    rx_fulfilment_rate: figRatio(o.fulfilled, o.eligible),
    rx_processing_time: fig(t.mean === null ? null : round(t.mean, 1), { sampleSize: t.count, note: t.median !== null ? `Median ${round(t.median, 1)} h.` : undefined }),
    po_total: fig(po.orders), po_fill_rate: figRatio(po.received, po.ordered), stock_received: fig(rec.units),
  };
  if (ctx.scope.canViewFinancial) figs.po_spend = fig(po.spend === null ? null : round(po.spend, 2), { note: "Lines without a unit cost are excluded." });
  return figs;
}

export async function pharmacyDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const granularity = chooseGranularity(cur);
  const [current, previous] = await Promise.all([pharmacyFigures(ctx, cur), ctx.range.previous ? pharmacyFigures(ctx, ctx.range.previous) : null]);
  const in90 = new Date(ctx.now.getTime() + 90 * 86_400_000);
  const [trend, stock, pending, topMeds, status, outOfStock, suppliers, controlled, highAlert] = await Promise.all([
    bucketedCounts(Prisma.sql`FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.status <> 'DRAFT'`, Prisma.sql`m.created_at`, cur, granularity, ctx.scope.calendar),
    db.$queryRaw<{ products: number; units: number; value: number | null; uncosted: number; expiring: number; expired: number }[]>`
      SELECT count(DISTINCT lower(b.medication_name)) FILTER (WHERE b.quantity > 0)::int AS products, coalesce(sum(b.quantity), 0)::int AS units,
        sum(b.quantity * b.unit_cost) FILTER (WHERE b.unit_cost IS NOT NULL)::float AS value,
        coalesce(sum(b.quantity) FILTER (WHERE b.unit_cost IS NULL), 0)::int AS uncosted,
        count(*) FILTER (WHERE b.quantity > 0 AND b.expires_at >= ${ts(ctx.now)} AND b.expires_at <= ${ts(in90)})::int AS expiring,
        count(*) FILTER (WHERE b.quantity > 0 AND b.expires_at < ${ts(ctx.now)})::int AS expired
      FROM pharmacy_stock_batches b WHERE b.facility_id = ${f}::uuid`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.status IN ('SUBMITTED','REVIEWED')`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT m.medication_name AS label, count(*)::int AS n FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.status <> 'DRAFT' AND m.created_at >= ${ts(cur.start)} AND m.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT m.status AS label, count(*)::int AS n FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.created_at >= ${ts(cur.start)} AND m.created_at < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM formulary_item fi WHERE fi.facility_id = ${f}::uuid AND fi.active AND NOT EXISTS (SELECT 1 FROM pharmacy_stock_batches b WHERE b.facility_id = fi.facility_id AND lower(b.medication_name) = lower(fi.medication_name) AND b.quantity > 0 AND b.expires_at >= ${ts(ctx.now)})`,
    db.$queryRaw<{ label: string; orders: number; ordered: number; received: number }[]>`
      SELECT coalesce(s.name, 'No supplier') AS label, count(DISTINCT po.id)::int AS orders, coalesce(sum(i.quantity), 0)::int AS ordered, coalesce(sum(i.received_quantity), 0)::int AS received
      FROM pharmacy_purchase_orders po LEFT JOIN pharmacy_suppliers s ON s.id = po.supplier_id LEFT JOIN pharmacy_purchase_order_items i ON i.order_id = po.id
      WHERE po.facility_id = ${f}::uuid AND po.status NOT IN ('DRAFT','CANCELLED') AND po.created_at >= ${ts(cur.start)} AND po.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT c."eventType"::text AS label, count(*)::int AS n FROM controlled_substance_events c WHERE c.facility_id = ${f}::uuid AND c.created_at >= ${ts(cur.start)} AND c.created_at < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM medication_order m JOIN formulary_item fi ON fi.facility_id = m.facility_id AND lower(fi.medication_name) = lower(m.medication_name) WHERE m.facility_id = ${f}::uuid AND fi.high_alert AND m.status <> 'DRAFT' AND m.created_at >= ${ts(cur.start)} AND m.created_at < ${ts(cur.end)}`,
  ]);
  const st = stock[0];
  const costNote = st.uncosted > 0 ? `${st.uncosted} unit(s) have no unit cost and are excluded from the value.` : undefined;
  let kpis: KpiValue[] = [
    makeKpi("rx_orders", current.rx_orders, previous?.rx_orders ?? null, { drill: "pharmacy.orders", spark: trend.map((x) => x.y) }),
    makeKpi("rx_reviewed", current.rx_reviewed, previous?.rx_reviewed ?? null),
    makeKpi("rx_dispensed", current.rx_dispensed, previous?.rx_dispensed ?? null, { drill: "pharmacy.orders" }),
    makeKpi("rx_fulfilment_rate", current.rx_fulfilment_rate, previous?.rx_fulfilment_rate ?? null),
    makeKpi("rx_processing_time", current.rx_processing_time, previous?.rx_processing_time ?? null),
    makeKpi("rx_pending", fig(pending[0].n), null, { drill: "pharmacy.pending" }),
    makeKpi("stock_products", fig(st.products), null, { drill: "pharmacy.stock" }),
    makeKpi("stock_units", fig(st.units), null),
    makeKpi("stock_expiring", fig(st.expiring), null, { drill: "pharmacy.expiring" }),
    makeKpi("stock_expired", fig(st.expired), null, { drill: "pharmacy.expired" }),
    makeKpi("stock_received", current.stock_received, previous?.stock_received ?? null),
    makeKpi("po_total", current.po_total, previous?.po_total ?? null),
    makeKpi("po_fill_rate", current.po_fill_rate, previous?.po_fill_rate ?? null),
    { key: "stock_out_formulary", label: "Formulary items out of stock", value: outOfStock[0].n, unit: "count", betterWhen: "LOWER", note: "Active formulary items with no unexpired stock on hand.", drill: "pharmacy.stockout" },
    { key: "rx_high_alert", label: "High-alert medication orders", value: highAlert[0].n, unit: "count", betterWhen: "NEUTRAL", note: "Orders for formulary items flagged high-alert, for independent double-check review." },
  ];
  if (ctx.scope.canViewFinancial) {
    kpis.push(makeKpi("stock_value", fig(st.value === null ? null : round(st.value, 2)), null, { note: costNote }));
    if (current.po_spend) kpis.push(makeKpi("po_spend", current.po_spend, previous?.po_spend ?? null));
  }
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "orders-trend", title: "Medication orders received", question: "Is dispensing demand rising?", visual: { type: "line", unit: "count", series: [{ name: "Orders", points: trend }] } },
    { id: "status", title: "Order status", question: "How many orders are stuck before dispensing?", visual: { type: "donut", unit: "count", items: status.map((r) => ({ label: r.label.toLowerCase(), value: r.n })) } },
    { id: "top-meds", title: "Most-ordered medicines", question: "Which medicines drive demand and must never run out?", visual: { type: "bars", unit: "count", items: topMeds.map((r) => ({ label: r.label, value: r.n })) } },
    { id: "suppliers", title: "Supplier fill rate", question: "Which suppliers deliver what we order?", visual: { type: "table", columns: [{ key: "label", label: "Supplier" }, { key: "orders", label: "Orders", align: "right" }, { key: "ordered", label: "Ordered", align: "right" }, { key: "received", label: "Received", align: "right" }, { key: "fill", label: "Fill %", align: "right" }], rows: suppliers.map((r) => ({ label: r.label, orders: r.orders, ordered: r.ordered, received: r.received, fill: r.ordered > 0 ? round((r.received / r.ordered) * 100, 1) : null })), footnote: "Fill rate = units received ÷ units ordered, per supplier, for orders created in the period." } },
  ];
  if (controlled.length) sections.push({ id: "controlled", title: "Controlled-substance register activity", question: "Is controlled-substance movement consistent?", visual: { type: "bars", unit: "count", items: controlled.map((r) => ({ label: r.label.toLowerCase(), value: r.n })) } });
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  void num;
  return {
    kpis, sections,
    gaps: [
      gap("Low-stock products and stockout rate by reorder level", "Products have no reorder level; stock is listed by batch. 'Formulary items out of stock' is reported instead."),
      gap("Stock dispensed, transferred, adjusted, damaged, returned and wasted; inventory turnover", "Dispensing does not decrement stock through a transaction ledger, so stock movements are not traceable."),
      gap("Medication safety alerts (allergy, interaction, duplicate, dose), interventions, adverse drug reactions, medication and dispensing errors, near misses", "Alerts are computed at order time but not stored, and no incident register exists."),
      gap("Pharmacy sales, revenue by medicine/category/branch, gross margin, discounts, refunds, outstanding balances", "Pharmacy dispensing is not priced or invoiced in Medic1905."),
      gap("Supplier delivery time, delayed deliveries and replenishment time", "Purchase orders carry no expected or actual delivery dates."),
      gap("Stock-shortage and demand forecasts at product level", "Demand can be forecast from orders; stock consumption cannot (see above). Order-based forecasts appear under Forecasting."),
    ],
  };
}
