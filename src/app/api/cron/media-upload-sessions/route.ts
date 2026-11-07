import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload } from "@/lib/storage";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * GET /api/cron/media-upload-sessions — run periodically by a scheduler (Vercel
 * Cron sends CRON_SECRET as a bearer token). Aborts and retires resumable
 * multipart sessions whose lifetime expired, so abandoned large studies leave
 * no orphaned storage parts. Runs are idempotent; overlapping runs are safe.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expired = await prisma.medicalMediaUploadSession.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    select: { id: true, storageKey: true, s3UploadId: true },
    take: 500,
  });
  let aborted = 0;
  for (const session of expired) {
    await abortMultipartUpload(session.storageKey, session.s3UploadId);
    const retired = await prisma.medicalMediaUploadSession.updateMany({ where: { id: session.id, status: "ACTIVE" }, data: { status: "ABANDONED" } });
    aborted += retired.count;
  }
  return NextResponse.json({ expiredFound: expired.length, aborted });
}
