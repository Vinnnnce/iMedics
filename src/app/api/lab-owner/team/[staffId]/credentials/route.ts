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
    const data = verifyCredentialSchema.parse(body);

    const credential = await prisma.staffCredential.findUnique({
      where: { id: data.credentialId },
    });
    if (!credential || credential.staffId !== staffId) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // Update credential status
    const updated = await prisma.staffCredential.update({
      where: { id: data.credentialId },
      data: {
        verificationStatus: data.decision,
        verifiedAt: new Date(),
        restrictions: data.notes ?? null,
      },
    });

    // Send verification email
    const subject =
      data.decision === "VERIFIED"
        ? "Your credential has been verified"
        : "Your credential could not be verified";
    const reason = data.notes || "No reason provided";
    await sendEmail({
      to: staff.email,
      subject,
      text: `Hello ${staff.fullName},\n\nCredential: ${credential.type}\nDecision: ${data.decision}\nReason: ${reason}`,
      html: `<p>Hello ${staff.fullName},</p><p>Credential: ${credential.type}</p><p>Decision: ${data.decision}</p><p>Reason: ${reason}</p>`,
    });

    // Audit log
    await controlAudit(
      prisma,
      user.id,
      lab.id,
      `CREDENTIAL_${data.decision}`,
      data.credentialId,
      { staffName: staff.fullName, credentialType: credential.type },
    );

    return NextResponse.json({ success: true, credential: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Verify credential error:", error);
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

    const credentialId = new URL(req.url).searchParams.get("credentialId");
    if (!credentialId) {
      return NextResponse.json({ error: "credentialId is required" }, { status: 400 });
    }

    const credential = await prisma.staffCredential.findUnique({
      where: { id: credentialId },
    });
    if (!credential || credential.staffId !== staffId) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    await prisma.staffCredential.delete({
      where: { id: credentialId },
    });

    // Audit log
    await controlAudit(
      prisma,
      user.id,
      lab.id,
      "CREDENTIAL_DELETED",
      credentialId,
      { staffId, credentialType: credential.type },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
