import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { controlAudit } from "@/lib/organization/security";

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export async function PUT(
  req: Request,
  { params }: { params: { staffId: string } }
) {
  try {
    const user = await requirePageRole("LABORATORY");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const staff = await prisma.laboratoryStaff.findUnique({
      where: { id: params.staffId, laboratoryId: lab.id },
    });
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    const body = await req.json();
    const data = updatePermissionsSchema.parse(body);

    const oldPermissions = staff.customPermissions || [];
    const updated = await prisma.laboratoryStaff.update({
      where: { id: params.staffId },
      data: { customPermissions: data.permissions },
    });

    // Audit log
    const addedPermissions = data.permissions.filter(p => !oldPermissions.includes(p));
    const removedPermissions = oldPermissions.filter(p => !data.permissions.includes(p));

    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: "PERMISSIONS_UPDATED",
      details: {
        staffName: staff.fullName,
        staffId: params.staffId,
        addedPermissions,
        removedPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      staff: updated,
      message: "Permissions updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
