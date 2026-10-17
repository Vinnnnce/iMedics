import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { csvResponse } from "@/lib/admin/csv";
import { firstValues } from "@/lib/admin/params";
import { listUsers, userFilterSchema } from "@/lib/admin/users";
import { listPayments, paymentFilterSchema } from "@/lib/admin/payments";
import { listAudit, auditFilterSchema } from "@/lib/admin/audit-log";
import { describeAction } from "@/lib/admin/audit-labels";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/export/{users|payments|audit}?<same filters as the list page> — CSV of everything the filters match
// (up to 5,000 rows). Exports are themselves audited.
export const GET = withAuth<{ kind: string }>(["ADMIN"], async (req, { user, params }) => {
  const { kind } = await params;
  const query = firstValues(Object.fromEntries(new URL(req.url).searchParams));
  const stamp = new Date().toISOString().slice(0, 10);
  let response: Response;
  let rowCount = 0;

  if (kind === "users") {
    const { rows } = await listUsers(userFilterSchema.parse(query), { all: true });
    rowCount = rows.length;
    response = csvResponse(`users-${stamp}.csv`, [
      ["Name", "Email", "Phone", "Role", "Account type", "Status", "Verification", "Registered", "Last sign-in"],
      ...rows.map((u) => [u.name, u.email, u.phone, u.role, u.accountType, u.status, u.verificationStatus, u.createdAt, u.lastLoginAt]),
    ]);
  } else if (kind === "payments") {
    const { rows } = await listPayments(paymentFilterSchema.parse(query), { all: true });
    rowCount = rows.length;
    response = csvResponse(`payments-${stamp}.csv`, [
      ["Receipt", "Reference", "Date", "Type", "Description", "Payer", "Payee", "Amount", "Currency", "Method", "Status", "Paid at"],
      ...rows.map((p) => [p.receiptNumber, p.providerReference, p.createdAt, p.kind, p.description, p.payer.name, p.payee.name, p.amount, p.currency, p.method, p.status, p.paidAt]),
    ]);
  } else if (kind === "audit") {
    const { rows } = await listAudit(auditFilterSchema.parse(query), { all: true });
    rowCount = rows.length;
    response = csvResponse(`audit-log-${stamp}.csv`, [
      ["Time", "Actor", "Role", "Action", "Resource", "Resource ID", "IP address"],
      ...rows.map((a) => [a.createdAt, a.user?.name ?? "System", a.actorRole, describeAction(a.action), a.resourceType, a.resourceId, a.ipAddress]),
    ]);
  } else {
    throw badRequest("Unknown export");
  }

  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_EXPORT", resourceType: "Export", details: { kind, rows: rowCount }, req });
  return response ?? NextResponse.json({ error: "Export failed" }, { status: 500 });
});
