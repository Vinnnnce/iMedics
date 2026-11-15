import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { safeErrorMetadata } from "./safe-error";
import { reportServerError } from "./monitoring";

/** An error that is safe to show to the client (status + message only). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 429 with a Retry-After hint, thrown by the rate limiter. */
export class RateLimitError extends ApiError {
  constructor(public readonly retryAfterSeconds: number, message = "Too many requests. Please wait a moment and try again.") {
    super(429, message);
    this.name = "RateLimitError";
  }
}

export const badRequest = (message = "Invalid request") => new ApiError(400, message);
export const unauthorized = (message = "Authentication required") => new ApiError(401, message);
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message = "Conflict") => new ApiError(409, message);

/**
 * Convert any thrown value into a JSON response.
 * Unknown errors are logged server-side and never leak details to the client.
 */
export function toErrorResponse(error: unknown, route?: string): NextResponse {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(error.retryAfterSeconds))) } },
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Older code throws `Object.assign(new Error("..."), { status: 404 })`. Those messages are
  // written for the client, so honour a 4xx status instead of reporting a server failure.
  const legacyStatus = error instanceof Error ? (error as { status?: unknown }).status : undefined;
  if (error instanceof Error && typeof legacyStatus === "number" && Number.isInteger(legacyStatus) && legacyStatus >= 400 && legacyStatus < 500) {
    return NextResponse.json({ error: error.message }, { status: legacyStatus });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      case "P2002":
        return NextResponse.json({ error: "A record with these details already exists" }, { status: 409 });
      case "P2034":
        return NextResponse.json({ error: "The request conflicted with another one. Please try again." }, { status: 409 });
      case "P2003":
        return NextResponse.json({ error: "Referenced record does not exist or is in use" }, { status: 409 });
    }
  }

  console.error("Unhandled API error:", safeErrorMetadata(error));
  reportServerError("api", error, route);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
