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
  specialty: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
});

const statusMessage: Record<string, string> = {
  ACTIVE: "Your access has been restored",
  ON_LEAVE: "You have been marked as on leave",
  SUSPENDED: "Your access has been suspended",
  TERMINATED: "Your employment has been terminated",
};

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
    const data = updateTeamMemberSchema.parse(body);

    const oldStatus = staff.status;
    const updated = await prisma.facilityStaff.update({
      where: { id: staffId },
      data,
    });

    // Send status change email if applicable
    if (data.status && data.status !== oldStatus) {
      const message = statusMessage[data.status];
      await sendEmail({
        to: staff.email,
        subject: "Your laboratory access status changed",
        text: `Hello ${staff.fullName},\n\n${message}.\n\n${lab.laboratoryName || "Laboratory"}`,
        html: `<p>Hello ${staff.fullName},</p><p>${message}.</p><p>${lab.laboratoryName || "Laboratory"}</p>`,
      });
    }

    // Audit log
    await controlAudit(
      prisma,
      user.id,
      lab.id,
      "STAFF_UPDATED",
      staffId,
      { staffName: staff.fullName, changes: data },
    );

    return NextResponse.json({ success: true, staff: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Update team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Soft delete - mark as terminated
    await prisma.facilityStaff.update({
      where: { id: staffId },
      data: { status: "TERMINATED" },
    });

    // Send termination email
    await sendEmail({
      to: staff.email,
      subject: "Your laboratory access has ended",
      text: `Hello ${staff.fullName},\n\nYour access to ${lab.laboratoryName || "Laboratory"} has been terminated.`,
      html: `<p>Hello ${staff.fullName},</p><p>Your access to ${lab.laboratoryName || "Laboratory"} has been terminated.</p>`,
    });

    // Audit log
    await controlAudit(
      prisma,
      user.id,
      lab.id,
      "STAFF_TERMINATED",
      staffId,
      { staffName: staff.fullName, staffId },
    );

    return NextResponse.json({ success: true, message: "Team member removed" });
  } catch (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
