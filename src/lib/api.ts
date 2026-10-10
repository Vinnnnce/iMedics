import type { NextRequest } from "next/server";
import type { Role, User } from "@prisma/client";
import { z } from "zod";
import { requireRole, requireUser } from "./auth";
import { badRequest, toErrorResponse } from "./errors";

export type RouteParams<P> = { params: Promise<P> };

/** Wrap a route handler so every thrown error becomes a safe JSON response. */
export function apiHandler<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: RouteParams<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteParams<P>): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * Wrap a route handler with authentication and (optionally) role checks.
 * Pass `null` to allow any signed-in, active user.
 */
export function withAuth<P = Record<string, never>>(
  roles: readonly Role[] | null,
  handler: (req: NextRequest, ctx: RouteParams<P> & { user: User }) => Promise<Response>,
) {
  return apiHandler<P>(async (req, ctx) => {
    const user = roles ? await requireRole(...roles) : await requireUser();
    return handler(req, { ...ctx, user });
  });
}

/** Parse and validate a JSON request body. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

/** Validate a route-param id. */
export function parseId(value: string): string {
  return z.string().uuid("Invalid id").parse(value);
}

/** Parse and validate URL search params. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}
