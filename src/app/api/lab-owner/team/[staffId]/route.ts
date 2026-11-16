import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { sendEmail } from "@/lib/notifications/email";
import { controlAudit } from "@/lib/organization/security";

const updateTeamMemberSchema = z.object({
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  specialization: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
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
    const data = updateTeamMemberSchema.parse(body);

    const oldStatus = staff.status;
    const updated = await prisma.laboratoryStaff.update({
      where: { id: params.staffId },
      data,
    });

    // Send status change email if applicable
    if (data.status && data.status !== oldStatus) {
      const statusMessage: Record<string, string> = {
        ACTIVE: "Your access has been restored",
        ON_LEAVE: "You have been marked as on leave",
        SUSPENDED: "Your access has been suspended",
        TERMINATED: "Your employment has been terminated",
      };

      await sendEmail({
        to: staff.email,
        template: "staff-status-change",
        data: {
          name: staff.fullName,
          status: data.status,
          message: statusMessage[data.status],
        },
      });
    }

    // Audit log
    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: "STAFF_UPDATED",
      details: { staffName: staff.fullName, changes: data },
    });

    return NextResponse.json({ success: true, staff: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Soft delete - mark as terminated
    await prisma.laboratoryStaff.update({
      where: { id: params.staffId },
      data: { status: "TERMINATED" },
    });

    // Send termination email
    await sendEmail({
      to: staff.email,
      template: "staff-terminated",
      data: {
        name: staff.fullName,
        laboratoryName: lab.laboratoryName || "Laboratory",
      },
    });

    // Audit log
    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: "STAFF_TERMINATED",
      details: { staffName: staff.fullName, staffId: params.staffId },
    });

    return NextResponse.json({ success: true, message: "Team member removed" });
  } catch (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
