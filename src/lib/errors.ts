import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

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

export const badRequest = (message = "Invalid request") => new ApiError(400, message);
export const unauthorized = (message = "Authentication required") => new ApiError(401, message);
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message = "Conflict") => new ApiError(409, message);

/**
 * Convert any thrown value into a JSON response.
 * Unknown errors are logged server-side and never leak details to the client.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
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

  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
