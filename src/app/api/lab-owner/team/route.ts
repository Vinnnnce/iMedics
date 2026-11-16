import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { sendEmail } from "@/lib/notifications/email";
import { controlAudit } from "@/lib/organization/security";

const addTeamMemberSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phoneNumber: z.string().optional(),
  role: z.string().min(1, "Role required"),
  specialization: z.string().optional(),
  permissionTemplate: z.enum(["limited", "technician", "senior", "admin"]),
  welcomeMessage: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requirePageRole("LABORATORY");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const data = addTeamMemberSchema.parse(body);

    // Check if email already exists
    const existingStaff = await prisma.laboratoryStaff.findUnique({
      where: { email: data.email },
    });
    if (existingStaff) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // Create staff member
    const staff = await prisma.laboratoryStaff.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: data.role,
        specialization: data.specialization,
        laboratoryId: lab.id,
        status: "ACTIVE",
        accessStartDate: new Date(data.startDate),
        accessEndDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    // Set permissions based on template
    const permissionMap: Record<string, string[]> = {
      limited: ["view_samples", "view_tests"],
      technician: ["view_samples", "create_sample", "view_tests", "conduct_test", "upload_results"],
      senior: ["view_samples", "create_sample", "modify_sample", "view_tests", "conduct_test", "upload_results", "approve_results", "quality_check"],
      admin: ["view_samples", "create_sample", "modify_sample", "archive_sample", "view_tests", "conduct_test", "upload_results", "approve_results", "quality_check", "view_reports", "generate_report", "export_data"],
    };

    const permissions = permissionMap[data.permissionTemplate] || [];

    await prisma.laboratoryStaff.update({
      where: { id: staff.id },
      data: { customPermissions: permissions },
    });

    // Send invitation email
    await sendEmail({
      to: data.email,
      template: "staff-invitation",
      data: {
        name: data.fullName,
        laboratoryName: lab.laboratoryName || "Laboratory",
        role: data.role,
        invitationLink: `${process.env.APP_URL}/auth/staff-join?email=${encodeURIComponent(data.email)}&code=${staff.id}`,
        welcomeMessage: data.welcomeMessage || "",
      },
    });

    // Audit log
    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: "STAFF_INVITED",
      details: { staffName: data.fullName, staffEmail: data.email, role: data.role },
    });

    return NextResponse.json({
      success: true,
      staffId: staff.id,
      message: "Team member invited successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Add team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
