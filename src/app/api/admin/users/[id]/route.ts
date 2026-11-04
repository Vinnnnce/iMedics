import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { changeAccountStatus, setAdministrator } from "@/lib/admin/account-controls";
import { requireSuperAdmin, confirmSensitive } from "@/lib/platform/access";

const schema = z.union([
  z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]), reason: z.string().trim().min(15).max(500), confirmation: z.string() }),
  z.object({ administrator: z.boolean(), reason: z.string().trim().min(15).max(500), confirmation: z.string() }),
]);

// PATCH /api/admin/users/[id] — suspend, ban or restore an account (a reason is required to restrict),
// or grant/remove administrator access. Professional roles are granted only through verification.
export const PATCH = withAuth<{ id: string }>(["ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const body = await parseBody(req, schema);
  await requireSuperAdmin(user);
  confirmSensitive(body, "CONFIRM ACCOUNT CHANGE");
  const admin = { id: user.id, role: "ADMIN" as const };
  const result = "status" in body ? await changeAccountStatus(admin, id, body.status, body.reason, req) : await setAdministrator(admin, id, body.administrator, req, body.reason);
  return NextResponse.json({ success: true, ...result });
});
