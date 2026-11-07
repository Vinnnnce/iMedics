import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

// GET /api/admin/doctors/verification — every doctor with their per-dimension verification state.
// Evidence documents are not included; they stay in the admin document viewer.
export const GET = withAuth(["ADMIN"], async () => {
  const doctors = await prisma.doctorProfile.findMany({ take: 500,
    select: {
      userId: true,
      verificationStatus: true,
      identityVerification: true,
      licenseVerification: true,
      qualificationVerification: true,
      specialty: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    doctors: doctors.map(({ user, ...doctor }) => ({ ...doctor, name: user.name, email: user.email })),
  });
});
