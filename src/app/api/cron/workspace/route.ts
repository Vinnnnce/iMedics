import { timingSafeEqual } from "node:crypto";
import { processWorkspaceNotifications } from "@/lib/workspace/notifications";
import { apiHandler } from "@/lib/api";
export const GET = apiHandler(async req => {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await processWorkspaceNotifications(), { headers: { "Cache-Control": "no-store" } });
});
