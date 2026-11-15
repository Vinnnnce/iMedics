import type { Instrumentation } from "next";

/** Next.js calls this for every unhandled server error (pages, route handlers, server actions). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { reportServerError } = await import("./lib/monitoring");
  reportServerError(context.routeType === "route" ? "api" : "page", error, request.path);
};
