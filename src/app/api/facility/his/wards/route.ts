import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).optional(),
  departmentId: z.string().uuid().nullish(),
  genderPolicy: z.enum(["MALE", "FEMALE", "MIXED", "PEDIATRIC", "ISOLATION"]).nullish(),
  notes: z.string().trim().max(500).optional(),
});

const GENDER_POLICY_LABEL: Record<string, string> = {
  MALE: "Male only", FEMALE: "Female only", MIXED: "Mixed", PEDIATRIC: "Pediatric", ISOLATION: "Isolation",
};

// GET /api/facility/his/wards — wards with live bed occupancy.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const wards = await prisma.ward.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { name: "asc" },
    include: {
      beds: { select: { id: true, status: true, label: true } },
    },
  });
  const result = wards.map((w) => {
    const beds = w.beds;
    return {
      id: w.id,
      name: w.name,
      code: w.code,
      departmentId: w.departmentId,
      genderPolicy: w.genderPolicy,
      genderPolicyLabel: w.genderPolicy ? GENDER_POLICY_LABEL[w.genderPolicy] ?? w.genderPolicy : null,
      notes: w.notes,
      totalBeds: beds.length,
      available: beds.filter((b) => b.status === "AVAILABLE").length,
      occupied: beds.filter((b) => b.status === "OCCUPIED").length,
      reserved: beds.filter((b) => b.status === "RESERVED").length,
      cleaning: beds.filter((b) => b.status === "CLEANING").length,
      maintenance: beds.filter((b) => b.status === "MAINTENANCE").length,
      isolation: beds.filter((b) => b.status === "ISOLATION").length,
    };
  });
  return NextResponse.json({ wards: result });
});

// POST /api/facility/his/wards — create a ward.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);

  if (body.departmentId) {
    const dept = await prisma.facilityDepartment.findFirst({
      where: { id: body.departmentId, facilityId: access.facility.id },
      select: { id: true },
    });
    if (!dept) throw notFound("Department not found");
  }

  const ward = await prisma.ward.create({
    data: {
      facilityId: access.facility.id,
      name: body.name,
      code: body.code ?? null,
      departmentId: body.departmentId ?? null,
      genderPolicy: body.genderPolicy ?? null,
      notes: body.notes ?? null,
    },
    select: { id: true, name: true },
  });
  await auditHis(access, "WARD_CREATED", "Ward", ward.id, req, { details: { name: ward.name } });
  return NextResponse.json({ ward }, { status: 201 });
});
