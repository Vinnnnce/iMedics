import { withAuth } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace/data";
export const dynamic = "force-dynamic";
export const GET = withAuth(null, async (_req, { user }) =>
  Response.json(await loadWorkspace(user), { headers: { "Cache-Control": "private, no-store" } }));
