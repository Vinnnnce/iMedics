/**
 * Test-only: build a valid row for any Prisma model from the schema alone.
 *
 * Required scalar fields get generated values; required parents are created recursively unless an
 * "anchor" supplies an existing row for that parent model (for example the facility under test),
 * so a record can be placed inside one facility or one patient's record with one call.
 * Never imported by application code.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

interface SchemaField {
  name: string; type: string; isRequired: boolean; isList: boolean; hasDefault: boolean;
  /** Set on relation fields: the scalar foreign-key fields that point at the parent. */
  fkFields: string[]; isRelation: boolean; isEnum: boolean; isUnique: boolean; isUuid: boolean; maxLength: number | null;
}
interface SchemaModel { name: string; fields: SchemaField[] }

// Prisma 7's runtime model description drops required/default information, so read the schema file.
function parseSchema() {
  const text = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const enumMap = new Map<string, string[]>();
  for (const m of text.matchAll(/^enum (\w+) \{([^}]*)\}/gm)) {
    enumMap.set(m[1], m[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//") && !l.startsWith("@@")).map((l) => l.split(/\s+/)[0]));
  }
  const modelMap = new Map<string, SchemaModel>();
  const modelNames = new Set([...text.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const fields: SchemaField[] = [];
    for (const raw of m[2].split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const f = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!f) continue;
      const [, name, type, list, optional, rest] = f;
      const relation = rest.match(/@relation\([^)]*fields:\s*\[([^\]]*)\]/);
      fields.push({
        name, type, isList: Boolean(list), isRequired: !optional && !list, hasDefault: /@default|@updatedAt/.test(rest),
        fkFields: relation ? relation[1].split(",").map((x) => x.trim()).filter(Boolean) : [], isRelation: modelNames.has(type), isEnum: enumMap.has(type),
        isUnique: /@unique\b/.test(rest), isUuid: /@db\.Uuid/.test(rest),
        maxLength: Number(rest.match(/@db\.VarChar\((\d+)\)/)?.[1]) || null,
      });
    }
    modelMap.set(m[1], { name: m[1], fields });
  }
  return { modelMap, enumMap };
}
const { modelMap: models, enumMap: enums } = parseSchema();
const delegate = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

export interface SeedContext {
  /** Existing rows to use whenever a required parent of this model is needed, keyed by parent model name. */
  anchors?: Record<string, string>;
  /** Field values by "Model.field" or plain "field". */
  values?: Record<string, unknown>;
}

function scalarValue(field: SchemaField): unknown {
  const tag = randomBytes(6).toString("hex");
  switch (field.type) {
    case "String": return `t${tag}`.slice(0, field.maxLength ?? 64);
    case "Int": case "BigInt": return 1;
    case "Float": return 1;
    case "Decimal": return 1;
    case "Boolean": return false;
    case "DateTime": return new Date();
    case "Json": return {};
    case "Bytes": return Buffer.from(tag);
    default: throw new Error(`No default for ${field.type}`);
  }
}

export async function seed(prisma: PrismaClient, modelName: string, ctx: SeedContext = {}, overrides: Record<string, unknown> = {}, depth = 0): Promise<{ id: string } & Record<string, unknown>> {
  if (depth > 6) throw new Error(`Seeding ${modelName}: dependency chain too deep`);
  const model = models.get(modelName);
  if (!model) throw new Error(`Unknown model ${modelName}`);
  const data: Record<string, unknown> = {};
  const fkOwner = new Map<string, SchemaField>();
  for (const f of model.fields) if (f.isRelation) for (const from of f.fkFields) fkOwner.set(from, f);

  for (const field of model.fields) {
    if (field.isRelation || field.isList) continue;
    const given = overrides[field.name] ?? ctx.values?.[`${modelName}.${field.name}`] ?? ctx.values?.[field.name];
    if (given !== undefined) { data[field.name] = given; continue; }
    if (!field.isRequired || field.hasDefault) continue;
    // The HIS acceptance database must stay synthetic-only: its fixture guard
    // refuses to build fixtures while any patient lacks the QA- acceptance
    // marker, so every seeded patient carries it.
    if (modelName === "Patient" && field.name === "caseNumber") {
      data[field.name] = `QA-${randomBytes(6).toString("hex")}`.slice(0, field.maxLength ?? 64);
      continue;
    }
    const relation = fkOwner.get(field.name);
    if (relation) {
      // A unique foreign key means "one per parent": reusing the anchor would collide, so make a new parent.
      const anchored = field.isUnique ? undefined : ctx.anchors?.[relation.type];
      data[field.name] = anchored ?? (await seed(prisma, relation.type, ctx, {}, depth + 1)).id;
    } else if (field.isUuid && field.type === "String") {
      // A plain uuid column with no relation: usually "who did this", so point it at the anchored user.
      const byName: Record<string, string | undefined> = { facilityId: ctx.anchors?.LabStaffProfile, patientId: ctx.anchors?.Patient };
      data[field.name] = byName[field.name] ?? (/(By|User)Id$/.test(field.name) && ctx.anchors?.User ? ctx.anchors.User : randomUUID());
    } else if (field.isEnum) {
      data[field.name] = enums.get(field.type)![0];
    } else {
      data[field.name] = scalarValue(field);
    }
  }
  try {
    const row = await (prisma as unknown as Record<string, { create: (a: unknown) => Promise<Record<string, unknown>> }>)[delegate(modelName)].create({ data });
    return row as { id: string } & Record<string, unknown>;
  } catch (error) {
    throw new Error(`Seeding ${modelName} failed: ${(error as Error).message.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
  }
}

export const newId = randomUUID;
