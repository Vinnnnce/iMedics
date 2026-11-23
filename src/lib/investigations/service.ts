import type { InvestigationDomain, InvestigationItemStatus, InvestigationPriority, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications/service";
import type { NotificationEvent } from "@/lib/notifications/events";
import { permissionsForRole } from "@/lib/facility-staff";
import { badRequest, conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_TURNAROUND_MINUTES, PRIORITY_TURNAROUND_FACTOR } from "./constants";
import { allowedTransitions, canTransition } from "./workflow";
import { buildSearchText } from "./search";
import { newId, touch } from "./db";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

async function nextValue(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO investigation_counters ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = investigation_counters."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

export async function nextOrderNumber(tx: Tx, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const n = await nextValue(tx, `order:${year}`);
  return `INV-${year}-${String(n).padStart(6, "0")}`;
}

/** Facility-scoped accession number and its barcode payload (Code 128 / QR content). */
export async function nextAccession(tx: Tx, facilityId: string, now = new Date()): Promise<{ accessionNumber: string; barcode: string }> {
  const year = now.getUTCFullYear();
  const n = await nextValue(tx, `accession:${facilityId}:${year}`);
  const accessionNumber = `SPC-${year}-${String(n).padStart(6, "0")}`;
  return { accessionNumber, barcode: accessionNumber.replace(/-/g, "") };
}

// ---------------------------------------------------------------------------
// Facility discovery and routing
// ---------------------------------------------------------------------------

export interface FacilityOption {
  facilityId: string;
  name: string;
  kind: string | null;
  city: string | null;
  state: string | null;
  priceMinor: number | null;
  turnaroundMinutes: number | null;
  departmentKey: string | null;
  preparation: string | null;
}

const FACILITY_KINDS: Record<InvestigationDomain, ("LABORATORY" | "DIAGNOSTIC_CENTRE" | "HOSPITAL")[]> = {
  LABORATORY: ["LABORATORY", "HOSPITAL"],
  DIAGNOSTIC: ["DIAGNOSTIC_CENTRE", "HOSPITAL"],
};

/** Verified facilities that actively offer each catalogue item. */
export async function facilitiesOffering(itemIds: string[], domain: InvestigationDomain): Promise<Map<string, FacilityOption[]>> {
  const rows = await prisma.facility_investigations.findMany({
    where: {
      catalogue_item_id: { in: itemIds },
      is_active: true,
      investigation_catalogue_items: { is_active: true },
      lab_staff_profiles: { verificationStatus: "VERIFIED", kind: { in: FACILITY_KINDS[domain] } },
    },
    select: {
      catalogue_item_id: true,
      facility_id: true,
      price_minor: true,
      turnaround_minutes: true,
      department_key: true,
      preparation: true,
      lab_staff_profiles: { select: { laboratoryName: true, kind: true, city: true, state: true } },
    },
    orderBy: { lab_staff_profiles: { ratingAvg: "desc" } },
  });
  const map = new Map<string, FacilityOption[]>();
  for (const r of rows) {
    const list = map.get(r.catalogue_item_id) ?? [];
    list.push({
      facilityId: r.facility_id,
      name: r.lab_staff_profiles.laboratoryName ?? "Facility",
      kind: r.lab_staff_profiles.kind,
      city: r.lab_staff_profiles.city,
      state: r.lab_staff_profiles.state,
      priceMinor: r.price_minor,
      turnaroundMinutes: r.turnaround_minutes,
      departmentKey: r.department_key,
      preparation: r.preparation,
    });
    map.set(r.catalogue_item_id, list);
  }
  return map;
}

/** Users who should be told about work arriving at a facility: owner plus active staff who can process orders. */
export async function facilityRecipients(facilityId: string, permission: "PROCESS_ORDERS" | "VERIFY_RESULTS" | "RELEASE_RESULTS" = "PROCESS_ORDERS"): Promise<string[]> {
  const facility = await prisma.labStaffProfile.findUnique({
    where: { id: facilityId },
    select: { userId: true, staffMembers: { where: { status: "ACTIVE", userId: { not: null } }, select: { userId: true, facilityRole: true } } },
  });
  if (!facility) return [];
  const ids = new Set<string>([facility.userId]);
  for (const s of facility.staffMembers) {
    if (s.userId && permissionsForRole(s.facilityRole).includes(permission)) ids.add(s.userId);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

export interface Actor {
  userId: string;
  label?: string;
}

export async function recordStatus(
  tx: Tx,
  itemId: string,
  from: InvestigationItemStatus | null,
  to: InvestigationItemStatus,
  actor: Actor | null,
  note?: string | null,
) {
  await tx.investigation_status_history.create({
    data: { id: newId(), item_id: itemId, from_status: from, to_status: to, actor_user_id: actor?.userId ?? null, actor_label: actor?.label ?? null, note: note ?? null },
  });
}

/** Recompute the order's roll-up status from its items. */
export async function refreshOrderStatus(tx: Tx, orderId: string) {
  const items = await tx.investigation_order_items.findMany({ where: { order_id: orderId }, select: { status: true } });
  if (items.length === 0) return;
  const active = items.filter((i) => i.status !== "CANCELLED");
  let status: "SUBMITTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  if (active.length === 0) status = "CANCELLED";
  else if (active.every((i) => i.status === "RELEASED" || i.status === "DELIVERED")) status = "COMPLETED";
  else if (active.some((i) => !["NEW_REQUEST", "REFERRAL_PENDING", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT"].includes(i.status))) status = "IN_PROGRESS";
  else status = "SUBMITTED";
  await tx.investigation_orders.update({ where: { id: orderId }, data: { status, ...touch(), ...(status === "CANCELLED" ? { cancelled_at: new Date() } : {}) } });
}

/**
 * Move an item along its domain workflow. Validates the transition, writes the
 * history row and keeps the order roll-up in step. Returns the updated item.
 */
export async function transitionItem(
  tx: Tx,
  item: { id: string; order_id: string; domain: InvestigationDomain; status: InvestigationItemStatus },
  to: InvestigationItemStatus,
  actor: Actor | null,
  options: { note?: string | null; data?: Prisma.investigation_order_itemsUncheckedUpdateInput } = {},
) {
  if (!canTransition(item.domain, item.status, to)) {
    throw conflict(`An investigation in "${item.status}" cannot move to "${to}"`);
  }
  const updated = await tx.investigation_order_items.update({
    where: { id: item.id },
    data: { ...options.data, status: to, status_changed_at: new Date(), ...touch() },
  });
  await recordStatus(tx, item.id, item.status, to, actor, options.note);
  await refreshOrderStatus(tx, item.order_id);
  return updated;
}

export function validNextStatuses(domain: InvestigationDomain, status: InvestigationItemStatus) {
  return allowedTransitions(domain, status);
}

export function computeDueAt(
  domain: InvestigationDomain,
  priority: InvestigationPriority,
  facilityMinutes: number | null | undefined,
  catalogueMinutes: number | null | undefined,
  from = new Date(),
): Date {
  const base = facilityMinutes ?? catalogueMinutes ?? DEFAULT_TURNAROUND_MINUTES[domain];
  return new Date(from.getTime() + Math.max(5, Math.round(base * PRIORITY_TURNAROUND_FACTOR[priority])) * 60_000);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Days within which an equivalent investigation is treated as a likely duplicate. */
export function duplicateWindowDays(domain: InvestigationDomain): number {
  const raw = Number(domain === "LABORATORY" ? process.env.INVESTIGATION_DUPLICATE_WINDOW_DAYS_LAB : process.env.INVESTIGATION_DUPLICATE_WINDOW_DAYS_DIAGNOSTIC);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return domain === "LABORATORY" ? 3 : 14;
}

export interface DuplicateHit {
  catalogueItemId: string;
  name: string;
  matchedOrderNumber: string;
  matchedOrderId: string;
  matchedName: string;
  requestedAt: Date;
  status: InvestigationItemStatus;
  reason: "SAME_INVESTIGATION" | "COVERED_BY_PANEL";
}

/**
 * An investigation is a probable duplicate when the same catalogue item was
 * requested recently for the patient (and not cancelled), or when every
 * analyte it measures is already covered by a recent panel (e.g. Haemoglobin
 * after a Full Blood Count).
 */
export async function findDuplicates(patientId: string, catalogueItemIds: string[], domain: InvestigationDomain, options: { excludeOrderId?: string } = {}): Promise<DuplicateHit[]> {
  if (catalogueItemIds.length === 0) return [];
  const since = new Date(Date.now() - duplicateWindowDays(domain) * 86_400_000);
  const recent = await prisma.investigation_order_items.findMany({
    where: {
      domain,
      catalogue_item_id: { not: null },
      status: { notIn: ["CANCELLED", "SAMPLE_REJECTED"] },
      created_at: { gte: since },
      investigation_orders: { patient_id: patientId, status: { not: "DRAFT" }, ...(options.excludeOrderId ? { id: { not: options.excludeOrderId } } : {}) },
    },
    select: { catalogue_item_id: true, name_snapshot: true, status: true, created_at: true, investigation_orders: { select: { id: true, order_number: true } } },
    orderBy: { created_at: "desc" },
    take: 200,
  });
  if (recent.length === 0) return [];

  const wanted = await prisma.investigation_catalogue_items.findMany({
    where: { id: { in: catalogueItemIds } },
    select: { id: true, name: true, investigation_analytes: { select: { code: true } } },
  });
  const recentIds = [...new Set(recent.map((r) => r.catalogue_item_id as string))];
  const recentItems = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: recentIds } }, select: { id: true, investigation_analytes: { select: { code: true } } } });
  const analytesById = new Map(recentItems.map((r) => [r.id, new Set(r.investigation_analytes.map((a) => a.code))]));

  const hits: DuplicateHit[] = [];
  for (const w of wanted) {
    const same = recent.find((r) => r.catalogue_item_id === w.id);
    if (same) {
      hits.push({ catalogueItemId: w.id, name: w.name, matchedOrderNumber: same.investigation_orders.order_number, matchedOrderId: same.investigation_orders.id, matchedName: same.name_snapshot, requestedAt: same.created_at, status: same.status, reason: "SAME_INVESTIGATION" });
      continue;
    }
    const mine = new Set(w.investigation_analytes.map((a) => a.code));
    if (mine.size === 0) continue;
    const covering = recent.find((r) => {
      const theirs = analytesById.get(r.catalogue_item_id as string);
      return !!theirs && theirs.size > mine.size && [...mine].every((c) => theirs.has(c));
    });
    if (covering) {
      hits.push({ catalogueItemId: w.id, name: w.name, matchedOrderNumber: covering.investigation_orders.order_number, matchedOrderId: covering.investigation_orders.id, matchedName: covering.name_snapshot, requestedAt: covering.created_at, status: covering.status, reason: "COVERED_BY_PANEL" });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Catalogue maintenance helpers
// ---------------------------------------------------------------------------

export function catalogueSearchText(input: { name: string; commonName?: string | null; abbreviation?: string | null; synonyms?: string[]; code: string; loincCode?: string | null; snomedCode?: string | null; subcategory?: string | null; clinicalDiscipline?: string | null; specimenType?: string | null; modality?: string | null; dicomModality?: string | null; categoryName?: string | null }) {
  return buildSearchText([input.name, input.commonName, input.abbreviation, input.synonyms, input.code, input.loincCode, input.snomedCode, input.subcategory, input.clinicalDiscipline, input.specimenType, input.modality, input.dicomModality, input.categoryName]);
}

/** A facility's own terms for a catalogue item, as accepted by the facility catalogue endpoints. */
export interface OfferingInput {
  isActive?: boolean;
  priceMinor?: number | null;
  turnaroundMinutes?: number | null;
  departmentKey?: string | null;
  preparation?: string | null;
  specimenRequirements?: string | null;
  reportTemplate?: string | null;
  responsibleStaffId?: string | null;
  localCode?: string | null;
  localAliases?: string[];
}

/** Maps an offering payload to `facility_investigations` columns; `undefined` fields are left untouched by Prisma. */
export function offeringColumns(o: OfferingInput) {
  return {
    is_active: o.isActive,
    price_minor: o.priceMinor,
    turnaround_minutes: o.turnaroundMinutes,
    department_key: o.departmentKey,
    preparation: o.preparation,
    specimen_requirements: o.specimenRequirements,
    report_template: o.reportTemplate,
    responsible_staff_id: o.responsibleStaffId,
    local_code: o.localCode,
    local_aliases: o.localAliases,
  };
}

// ---------------------------------------------------------------------------
// Notifications (ids only; clinical detail never leaves the app)
// ---------------------------------------------------------------------------

export async function notifySafely(userIds: (string | null | undefined)[], event: NotificationEvent): Promise<void> {
  const unique = [...new Set(userIds.filter((x): x is string => !!x))];
  if (unique.length === 0) return;
  await notifyUsers(unique, event).catch((error) => console.error("Investigation notification failed:", error));
}

export async function auditInvestigation(user: Pick<User, "id" | "role">, action: string, resourceId: string, options: { patientId?: string | null; facilityId?: string | null; details?: Prisma.InputJsonValue; req?: Request } = {}) {
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    patientId: options.patientId ?? null,
    facilityId: options.facilityId ?? null,
    action,
    resourceType: "investigation_order_items",
    resourceId,
    details: options.details,
    req: options.req,
  });
}

export { badRequest };
