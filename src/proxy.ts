import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is private by default. Only the pages needed to sign in are public.
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/login(.*)",
  "/auth/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/legal/(.*)",
  "/pricing",
  // Called by the payment gateway and the scheduler; both authenticate themselves (signature / bearer secret).
  "/api/payments/webhook/(.*)",
  "/api/cron/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();
  if (userId) return;

  // API callers get a JSON 401; page visitors are redirected to sign in.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};