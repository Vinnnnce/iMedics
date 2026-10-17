import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getRecommendations } from "@/lib/data/recommendations";

// GET /api/recommendations — personalized suggestions for the dashboard.
//
// The optional `context` query parameter only selects which dashboard's
// perspective to build for (patient | doctor | facility); the caller's identity
// and every authorization decision are resolved server-side from the signed-in
// user, never from client input. `withAuth`/`apiHandler` already set
// Cache-Control: private, no-store on the response.
export const GET = withAuth(null, async (req, { user }) => {
  const context = new URL(req.url).searchParams.get("context");
  const categories = await getRecommendations(user, context);
  return NextResponse.json({ categories });
});
