import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { sendEmail } from "@/lib/notifications/email";
import { controlAudit } from "@/lib/organization/security";

const verifyCredentialSchema = z.object({
  credentialId: z.string(),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  notes: z.string().optional(),
});

export async function POST(
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
    const data = verifyCredentialSchema.parse(body);

    const credential = await prisma.laboratoryCredential.findUnique({
      where: { id: data.credentialId },
    });
    if (!credential || credential.staffId !== params.staffId) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // Update credential status
    const updated = await prisma.laboratoryCredential.update({
      where: { id: data.credentialId },
      data: {
        verificationStatus: data.decision,
        verifiedBy: user.id,
        verifiedAt: new Date(),
        notes: data.notes,
      },
    });

    // Send verification email
    const emailTemplate = data.decision === "VERIFIED" ? "credential-verified" : "credential-rejected";
    await sendEmail({
      to: staff.email,
      template: emailTemplate,
      data: {
        name: staff.fullName,
        credentialType: credential.type,
        reason: data.notes || "No reason provided",
      },
    });

    // Audit log
    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: `CREDENTIAL_${data.decision}`,
      details: { staffName: staff.fullName, credentialType: credential.type },
    });

    return NextResponse.json({ success: true, credential: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Verify credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { staffId: string; credentialId: string } }
) {
  try {
    const user = await requirePageRole("LABORATORY");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const credential = await prisma.laboratoryCredential.findUnique({
      where: { id: params.credentialId },
    });
    if (!credential || credential.staffId !== params.staffId) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    await prisma.laboratoryCredential.delete({
      where: { id: params.credentialId },
    });

    // Audit log
    await controlAudit({
      facilityId: lab.id,
      userId: user.id,
      action: "CREDENTIAL_DELETED",
      details: { staffId: params.staffId, credentialType: credential.type },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
