/**
 * Prisma returns rows with the database's snake_case columns and model-named relations
 * (`investigation_order_items`, `lab_staff_profiles`, ...). The investigation API, and the
 * client components built on it, speak camelCase with short relation names (`items`,
 * `performingFacility`, ...). This is the single place where one is translated into the other,
 * so route handlers can query with the native schema and still return the public contract.
 *
 * Only keys the schema knows about are renamed. JSON columns (`custom_details`, `report_data`, ...)
 * are passed through untouched: their contents are user data, not columns.
 */
export type Dto = Record<string, unknown>;

type Entity =
  | "order" | "item" | "result" | "observation" | "alert" | "alertEvent" | "media" | "specimen"
  | "referral" | "interpretation" | "catalogueItem" | "category" | "analyte" | "offering" | "statusHistory";

/** `external` targets (Patient, User, LabStaffProfile, ...) already use camelCase fields. */
type Relation = { as: string; entity: Entity | "external"; list?: boolean };

const RELATIONS: Record<Entity, Record<string, Relation>> = {
  order: {
    investigation_order_items: { as: "items", entity: "item" },
    patients: { as: "patient", entity: "external" },
    users: { as: "requestedBy", entity: "external" },
    lab_staff_profiles: { as: "requestingFacility", entity: "external" },
  },
  item: {
    investigation_orders: { as: "order", entity: "order" },
    investigation_catalogue_items: { as: "catalogueItem", entity: "catalogueItem" },
    lab_staff_profiles: { as: "performingFacility", entity: "external" },
    investigation_media: { as: "media", entity: "media" },
    investigation_referrals: { as: "referrals", entity: "referral" },
    investigation_results: { as: "results", entity: "result", list: true },
    investigation_specimens: { as: "specimens", entity: "specimen" },
    investigation_status_history: { as: "history", entity: "statusHistory" },
  },
  result: {
    investigation_observations: { as: "observations", entity: "observation" },
    investigation_media: { as: "media", entity: "media" },
    investigation_interpretations: { as: "interpretations", entity: "interpretation" },
    investigation_critical_alerts: { as: "alerts", entity: "alert", list: true },
    investigation_order_items: { as: "item", entity: "item" },
  },
  alert: {
    investigation_alert_events: { as: "events", entity: "alertEvent" },
    investigation_results: { as: "result", entity: "result" },
  },
  alertEvent: {},
  media: {
    investigation_order_items: { as: "item", entity: "item" },
    investigation_results: { as: "result", entity: "result" },
  },
  observation: { investigation_results: { as: "result", entity: "result" } },
  specimen: {
    lab_staff_profiles: { as: "facility", entity: "external" },
    investigation_order_items: { as: "item", entity: "item" },
    investigation_specimens: { as: "parent", entity: "specimen" },
    other_investigation_specimens: { as: "children", entity: "specimen" },
  },
  referral: { investigation_order_items: { as: "item", entity: "item" } },
  interpretation: { investigation_results: { as: "result", entity: "result" } },
  statusHistory: {},
  catalogueItem: {
    investigation_categories: { as: "category", entity: "category" },
    investigation_analytes: { as: "analytes", entity: "analyte" },
    facility_investigations: { as: "facilityOfferings", entity: "offering" },
    investigation_order_items: { as: "orderItems", entity: "item" },
  },
  category: { investigation_catalogue_items: { as: "items", entity: "catalogueItem" } },
  analyte: { investigation_catalogue_items: { as: "catalogueItem", entity: "catalogueItem" } },
  offering: {
    investigation_catalogue_items: { as: "item", entity: "catalogueItem" },
    lab_staff_profiles: { as: "facility", entity: "external" },
  },
};

/** `created_at` -> `createdAt`; leaves `_count`, already-camelCase keys and Prisma helpers alone. */
const camel = (key: string) => key.replace(/(?<=[a-z0-9])_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const isPlainObject = (v: unknown): v is Dto => typeof v === "object" && v !== null && (v as object).constructor === Object;

function convert(entity: Entity, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => convert(entity, v));
  if (!isPlainObject(value)) return value; // null, Date, primitives
  const relations = RELATIONS[entity];
  const out: Dto = {};
  for (const [key, v] of Object.entries(value)) {
    const rel = relations[key];
    if (!rel) {
      out[camel(key)] = v;
      continue;
    }
    let next = rel.entity === "external" ? v : convert(rel.entity, v);
    if (rel.list && !Array.isArray(next)) next = next == null ? [] : [next];
    out[rel.as] = next;
  }
  return out;
}

/** One Prisma row of `entity` (with any included relations) as the public camelCase shape. */
export const toDto = (entity: Entity, row: object): Dto => convert(entity, row) as Dto;

export const toDtos = (entity: Entity, rows: readonly object[]): Dto[] => convert(entity, rows) as Dto[];

/** The catalogue row as the camelCase shape `scoreMatch` ranks. */
export const searchableFromRow = (c: {
  name: string; common_name?: string | null; abbreviation?: string | null; synonyms?: string[]; code: string; loinc_code?: string | null; snomed_code?: string | null; search_text: string;
}) => ({
  name: c.name, commonName: c.common_name, abbreviation: c.abbreviation, synonyms: c.synonyms, code: c.code, loincCode: c.loinc_code, snomedCode: c.snomed_code, searchText: c.search_text,
});
