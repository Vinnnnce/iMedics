import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";

const select = { id: true, name: true, addressLine: true, city: true, state: true, phone: true, email: true, openingHours: true, isPrimary: true } as const;

// GET /api/facility/branches
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, null, req, { requireVerified: false });
  const branches = await prisma.facilityBranch.findMany({ where: { facilityId: facility.id }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select });
  return NextResponse.json({ branches });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(100).nullish(),
  state: z.string().trim().max(100).nullish(),
  phone: z.string().trim().max(40).nullish(),
  email: z.string().trim().email().max(120).nullish(),
  openingHours: z.string().trim().max(200).nullish(),
  isPrimary: z.boolean().default(false),
});

// POST /api/facility/branches
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const input = await parseBody(req, createSchema);

  const branch = await prisma.facilityBranch.create({
    data: {
      facilityId: access.facility.id,
      name: input.name,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      openingHours: input.openingHours ?? null,
      isPrimary: input.isPrimary,
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_BRANCH_CREATED",
    resourceType: "FacilityBranch", resourceId: branch.id,
    details: { name: input.name }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ branch }, { status: 201 });
});
