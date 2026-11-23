import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { acknowledgeAlert } from "@/lib/investigations/alerts";
import { auditInvestigation } from "@/lib/investigations/service";

type Params = { id: string };

// POST /api/investigations/alerts/[id]/acknowledge — only the notified doctor can acknowledge; time and actor are recorded.
export const POST = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { note } = await parseBody(req, z.object({ note: z.string().trim().max(500).optional() }));
  const alert = await acknowledgeAlert(user.id, id, note);
  await auditInvestigation(user, "INVESTIGATION_CRITICAL_ACKNOWLEDGED", alert.item_id, { patientId: alert.patient_id, req });
  return NextResponse.json({ success: true });
});
