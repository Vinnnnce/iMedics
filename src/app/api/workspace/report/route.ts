import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace/data";
import { extensionAudit } from "@/lib/workspace/extensions";
import { csvCell } from "@/lib/workspace/intelligence";
import { forbidden } from "@/lib/errors";
import { dashboardFilterSchema, filterWorkspaceItems } from "@/lib/workspace/filters";
const schema = dashboardFilterSchema.safeExtend({
  section: z.enum(["appointments", "results", "payments", "timeline", "operations"]),
});
export const GET = withAuth(null, async (req, { user }) => {
  const query = parseQuery(req, schema);
  if (user.role === "ADMIN" && query.section === "results") throw forbidden();
  const data = await loadWorkspace(user);
  const rows = filterWorkspaceItems(data[query.section], query);
  await extensionAudit(user, "DASHBOARD_RECORDS_EXPORTED");
  const csv = [["Title", "Details", "Status", "UTC date", "Case number"], ...rows.map(row => [row.title, row.subtitle, row.status, row.at, row.caseNumber])].map(row => row.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="imedics-${query.section}.csv"`, "X-Content-Type-Options": "nosniff" } });
});
