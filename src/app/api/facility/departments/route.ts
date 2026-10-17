import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { slugifyFacility } from "@/lib/public-facilities";
import { badRequest } from "@/lib/errors";

const select = {
  id: true, name: true, slug: true, description: true, openingHours: true, equipment: true,
  leadStaffId: true, staff: { select: { id: true, fullName: true, professionalTitle: true, status: true } },
} as const;

// GET /api/facility/departments
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, null, req, { requireVerified: false });
  const departments = await prisma.facilityDepartment.findMany({
    where: { facilityId: facility.id },
    orderBy: [{ name: "asc" }],
    select,
  });
  return NextResponse.json({ departments });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullish(),
  openingHours: z.string().trim().max(200).nullish(),
  equipment: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  leadStaffId: z.string().uuid().nullish(),
});

// POST /api/facility/departments
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const input = await parseBody(req, createSchema);

  const slug = slugifyFacility(input.name);
  if (!slug) throw badRequest("Choose a department name with letters or numbers");

  if (input.leadStaffId) {
    const lead = await prisma.facilityStaff.findFirst({ where: { id: input.leadStaffId, facilityId: access.facility.id }, select: { id: true } });
    if (!lead) throw badRequest("Lead staff member not found for this facility");
  }

  const department = await prisma.facilityDepartment.create({
    data: {
      facilityId: access.facility.id,
      name: input.name,
      slug,
      description: input.description ?? null,
      openingHours: input.openingHours ?? null,
      equipment: input.equipment,
      leadStaffId: input.leadStaffId ?? null,
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_DEPARTMENT_CREATED",
    resourceType: "FacilityDepartment", resourceId: department.id,
    details: { name: input.name }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ department }, { status: 201 });
});
