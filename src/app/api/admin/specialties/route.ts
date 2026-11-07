import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { notFound, conflict } from "@/lib/errors";

/**
 * Global medical department & specialty catalogue. These are the standard
 * departments facilities can adopt; each facility keeps its own department
 * records, permissions and templates separate.
 */

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "DEPARTMENTS", "VIEW");
  const [specialties, facilityDepartments] = await Promise.all([
    prisma.globalSpecialty.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true, description: true, active: true } }),
    prisma.facilityDepartment.groupBy({ by: ["name"], _count: { _all: true } }),
  ]);
  return NextResponse.json({ specialties, facilityDepartments });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), name: z.string().trim().min(2).max(120), category: z.enum(["CLINICAL", "LABORATORY", "DIAGNOSTIC", "NURSING", "PHARMACY", "ADMINISTRATIVE"]), description: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("UPDATE"), id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), category: z.enum(["CLINICAL", "LABORATORY", "DIAGNOSTIC", "NURSING", "PHARMACY", "ADMINISTRATIVE"]).optional(), description: z.string().trim().max(500).optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("DELETE"), id: z.string().uuid() }),
]);

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  await requireAdminPermission(user, "DEPARTMENTS", body.action === "CREATE" ? "CREATE" : body.action === "DELETE" ? "DELETE" : "EDIT");
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "CREATE": {
        if (await tx.globalSpecialty.findUnique({ where: { name: body.name } })) throw conflict("A specialty with this name already exists");
        const s = await tx.globalSpecialty.create({ data: { name: body.name, category: body.category, description: body.description } });
        await controlAudit(tx, user.id, null, "GLOBAL_SPECIALTY_CREATED", s.id, { name: s.name, category: s.category });
        return s;
      }
      case "UPDATE": {
        const before = await tx.globalSpecialty.findUnique({ where: { id: body.id } });
        if (!before) throw notFound("Specialty not found");
        const s = await tx.globalSpecialty.update({ where: { id: body.id }, data: { name: body.name, category: body.category, description: body.description, active: body.active } });
        await controlAudit(tx, user.id, null, "GLOBAL_SPECIALTY_UPDATED", s.id, { before: { name: before.name, active: before.active }, after: { name: s.name, active: s.active } });
        return s;
      }
      case "DELETE": {
        const s = await tx.globalSpecialty.findUnique({ where: { id: body.id } });
        if (!s) throw notFound("Specialty not found");
        const inUse = await tx.facilityDepartment.count({ where: { name: s.name } });
        if (inUse > 0) throw conflict("Facilities still use this specialty. Deactivate it instead of deleting.");
        await tx.globalSpecialty.delete({ where: { id: body.id } });
        await controlAudit(tx, user.id, null, "GLOBAL_SPECIALTY_DELETED", s.id, { name: s.name });
        return { deleted: true };
      }
    }
  }) }, { status: 201 });
});
