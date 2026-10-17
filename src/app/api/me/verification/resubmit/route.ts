import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { findApplication } from "@/lib/verification";
import { notifyAdminsOfApplication } from "@/lib/admin/notify";
import { writeAudit } from "@/lib/audit";

// POST /api/me/verification/resubmit — after fixing what the reviewer asked for, send the application back for review.
export const POST = withAuth(null, async (req, { user }) => {
  const application = await findApplication(user.id);
  if (!application) throw conflict("Complete your professional registration first");
  if (application.verificationStatus !== "REJECTED") throw conflict("Your application is not waiting for changes");
  if ((await prisma.verificationDocument.count({ where: { userId: user.id } })) === 0) throw conflict("Attach at least one document first");

  const data = { verificationStatus: "PENDING" as const };
  if (application.type === "DOCTOR") await prisma.doctorProfile.update({ where: { id: application.id }, data });
  else await prisma.labStaffProfile.update({ where: { id: application.id }, data });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "VERIFICATION_RESUBMITTED", resourceType: "User", resourceId: user.id, req });
  await notifyAdminsOfApplication(user.id, true);
  return NextResponse.json({ success: true });
});
