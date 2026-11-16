import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import {
  createStaffInvitation,
  sendStaffInvitationEmail,
} from "@/lib/facility-invitations";
import { controlAudit } from "@/lib/organization/security";
import type { FacilityStaffRole } from "@prisma/client";

const FACILITY_STAFF_ROLES: FacilityStaffRole[] = [
  "OWNER",
  "FACILITY_MANAGER",
  "DOCTOR",
  "LAB_SCIENTIST",
  "LAB_TECHNICIAN",
  "LAB_ASSISTANT",
  "PHLEBOTOMIST",
  "NURSE",
  "RADIOGRAPHER",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "COMPLIANCE_OFFICER",
];

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
    const user = await requirePageRole("LAB_SCIENTIST");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const data = addTeamMemberSchema.parse(body);

    const facilityRole = FACILITY_STAFF_ROLES.includes(
      data.role as FacilityStaffRole,
    )
      ? (data.role as FacilityStaffRole)
      : "LAB_TECHNICIAN";

    // Check if email already exists on this lab's staff list
    const existingStaff = await prisma.facilityStaff.findFirst({
      where: { facilityId: lab.id, email: data.email.trim().toLowerCase() },
      select: { id: true, status: true },
    });
    if (existingStaff && existingStaff.status !== "TERMINATED") {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // Create the invited staff member with a real, single-use invite token
    const invitation = await createStaffInvitation({
      facilityId: lab.id,
      email: data.email,
      fullName: data.fullName,
      facilityRole,
      invitedById: user.id,
      specialty: data.specialization ?? null,
      personalMessage: data.welcomeMessage ?? null,
    });

    // Set permissions based on template
    const permissionMap: Record<string, string[]> = {
      limited: ["view_samples", "view_tests"],
      technician: ["view_samples", "create_sample", "view_tests", "conduct_test", "upload_results"],
      senior: ["view_samples", "create_sample", "modify_sample", "view_tests", "conduct_test", "upload_results", "approve_results", "quality_check"],
      admin: ["view_samples", "create_sample", "modify_sample", "archive_sample", "view_tests", "conduct_test", "upload_results", "approve_results", "quality_check", "view_reports", "generate_report", "export_data"],
    };

    const permissions = permissionMap[data.permissionTemplate] || [];

    await prisma.facilityStaff.update({
      where: { id: invitation.staffId },
      data: {
        permissionOverrides: permissions,
        phoneNumber: data.phoneNumber ?? null,
        accessStartsAt: new Date(data.startDate),
        accessExpiresAt: data.endDate ? new Date(data.endDate) : null,
      },
    });

    // Send invitation email
    await sendStaffInvitationEmail({
      to: data.email,
      facilityName: lab.laboratoryName || "Laboratory",
      facilityId: lab.id,
      staffId: invitation.staffId,
      redeemUrl: invitation.redeemUrl,
      inviterName: user.name || user.email,
      inviterEmail: user.email,
      personalMessage: data.welcomeMessage ?? null,
      expiresAt: invitation.expiresAt,
    });

    // Audit log
    await controlAudit(
      prisma,
      user.id,
      lab.id,
      "STAFF_INVITED",
      invitation.staffId,
      { staffName: data.fullName, staffEmail: data.email, role: facilityRole },
    );

    return NextResponse.json({
      success: true,
      staffId: invitation.staffId,
      message: "Team member invited successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Add team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
