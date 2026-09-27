import { NextRequest } from "next/server";

/**
 * Guard for admin API routes.
 * The admin session is issued by /api/admin-auth and stored in the
 * httpOnly `admin_auth` cookie. Returns true when the caller has a
 * valid admin session.
 */
export function isAdminRequest(req: NextRequest): boolean {
  return req.cookies.get("admin_auth")?.value === "true";
}

export function unauthorized() {
  return Response.json(
    { success: false, error: "Unauthorized — admin session required" },
    { status: 401 }
  );
}
