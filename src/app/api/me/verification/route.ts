import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { DOCUMENT_KINDS, REQUIRED_KINDS, findApplication, kindLabel } from "@/lib/verification";

// GET /api/me/verification — the applicant's own verification status, the reviewer's reason if it needs changes,
// and their uploaded documents.
export const GET = withAuth(null, async (_req, { user }) => {
  const application = await findApplication(user.id);
  if (!application) return NextResponse.json({ application: null });

  const [documents, latestReview] = await Promise.all([
    prisma.verificationDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, fileName: true, sizeBytes: true, createdAt: true },
    }),
    prisma.verificationReview.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { decision: true, reason: true, createdAt: true } }),
  ]);

  const uploaded = new Set(documents.map((d) => d.kind));
  return NextResponse.json({
    application: {
      type: application.type,
      status: application.verificationStatus,
      // Only shown while it is the reason the application is waiting on the applicant.
      feedback: application.verificationStatus === "REJECTED" && latestReview?.decision === "REJECTED" ? { reason: latestReview.reason, at: latestReview.createdAt } : null,
      documents: documents.map((d) => ({ ...d, kindLabel: kindLabel(d.kind) })),
      missingRequired: REQUIRED_KINDS[application.type].filter((k) => !uploaded.has(k)).map((k) => ({ kind: k, label: DOCUMENT_KINDS[k].label })),
      kinds: Object.entries(DOCUMENT_KINDS)
        .filter(([, v]) => v.appliesTo === "ANY" || v.appliesTo === application.type)
        .map(([kind, v]) => ({ kind, label: v.label })),
    },
  });
});
