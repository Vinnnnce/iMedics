import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";

const verified = withAuth(null, async (req, { user }) => {
  if (!user.testAccountExpiresAt || user.testAccountExpiresAt <= new Date()) throw forbidden("An unexpired synthetic account is required");
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const facility = await prisma.labStaffProfile.findFirst({
    where: { id: access.facility.id, isPublished: false, laboratoryName: { startsWith: "SYNTHETIC ACCEPTANCE " } },
    select: { id: true },
  });
  if (!facility) throw forbidden("An unpublished synthetic facility is required");
  return NextResponse.json({ mode: "isolated-test", userId: user.id, facilityId: facility.id, expiresAt: user.testAccountExpiresAt.toISOString() });
});

/** Never authenticate/provision a user before refusing a production request.
 * This endpoint grants no permissions and contains no authentication bypass. */
export async function GET(req: NextRequest) {
  if (process.env.HIS_ACCEPTANCE_ENABLED !== "true" || process.env.HIS_ACCEPTANCE_ENVIRONMENT !== "staging" || process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return verified(req, { params: Promise.resolve({}) });
}
