import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { controlAudit } from "@/lib/organization/security";

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

function readPermissions(overrides: unknown): string[] {
  if (Array.isArray(overrides)) return overrides.filter((v) => typeof v === "string");
  return [];
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ staffId: string }> },
) {
  try {
    const { staffId } = await params;
    const user = await requirePageRole("LAB_SCIENTIST");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const staff = await prisma.facilityStaff.findFirst({
      where: { id: staffId, facilityId: lab.id },
    });
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    const body = await req.json();
    const data = updatePermissionsSchema.parse(body);

    const oldPermissions = readPermissions(staff.permissionOverrides);
    const updated = await prisma.facilityStaff.update({
      where: { id: staffId },
      data: { permissionOverrides: data.permissions },
    });

    // Audit log
    const addedPermissions = data.permissions.filter((p) => !oldPermissions.includes(p));
    const removedPermissions = oldPermissions.filter((p) => !data.permissions.includes(p));

    await controlAudit(
      prisma,
      user.id,
      lab.id,
      "PERMISSIONS_UPDATED",
      staffId,
      {
        staffName: staff.fullName,
        staffId,
        addedPermissions,
        removedPermissions,
      },
    );

    return NextResponse.json({
      success: true,
      staff: updated,
      message: "Permissions updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Update permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
