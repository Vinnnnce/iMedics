import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { presignView } from "@/lib/storage";
import { auditInvestigation } from "@/lib/investigations/service";

type Params = { id: string; mediaId: string };

// GET /api/investigations/items/[id]/media/[mediaId] — short-lived view URL, only for media of a RELEASED report.
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const p = await params;
  const itemId = parseId(p.id);
  const mediaId = parseId(p.mediaId);
  const media = await prisma.investigation_media.findFirst({
    where: { id: mediaId, item_id: itemId, investigation_results: { status: "RELEASED", ...(user.role === "PATIENT" ? { patient_visible: true } : {}) } },
    include: { investigation_order_items: { select: { investigation_orders: { select: { patient_id: true, requested_by_id: true } } } } },
  });
  if (!media) throw notFound("Media not found");
  const o = media.investigation_order_items.investigation_orders;
  if (!(user.role === "DOCTOR" && o.requested_by_id === user.id)) await findAccessiblePatient(user, o.patient_id).catch(() => { throw notFound("Media not found"); });
  await auditInvestigation(user, "INVESTIGATION_MEDIA_VIEWED", itemId, { patientId: o.patient_id, req });
  return NextResponse.json({ url: await presignView(media.storage_key, media.file_name), fileName: media.file_name, mimeType: media.mime_type });
});
