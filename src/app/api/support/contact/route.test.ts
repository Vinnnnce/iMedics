import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupportTicket = vi.fn();
const enforceAnonymousRateLimit = vi.fn();
vi.mock("@/lib/support-service", () => ({ createSupportTicket: (...a: unknown[]) => createSupportTicket(...a) }));
vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), enforceAnonymousRateLimit: (...a: unknown[]) => enforceAnonymousRateLimit(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";
import { RateLimitError } from "@/lib/errors";
import type { NextRequest } from "next/server";

const valid = { name: "Ada Obi", email: "ada@example.com", subject: "Login problem", message: "I cannot sign in on my phone." };
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/support/contact", {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000", ...headers },
  }) as unknown as NextRequest;
}
const call = (req: NextRequest) => POST(req, { params: Promise.resolve({}) });

beforeEach(() => {
  createSupportTicket.mockReset().mockResolvedValue({ reference: "SUP-ABCD2345" });
  enforceAnonymousRateLimit.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/support/contact", () => {
  it("creates an anonymous ticket and returns only the reference", async () => {
    const res = await call(request(valid));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, reference: "SUP-ABCD2345" });
    expect(createSupportTicket.mock.calls[0][0]).toMatchObject({ type: "CONTACT", contactEmail: "ada@example.com" });
    expect(createSupportTicket.mock.calls[0][1]).toBeNull();
  });
  it("silently drops honeypot submissions", async () => {
    const res = await call(request({ ...valid, website: "http://spam.test" }));
    expect(res.status).toBe(201);
    expect(createSupportTicket).not.toHaveBeenCalled();
  });
  it("rejects invalid input and record-related types", async () => {
    expect((await call(request({ ...valid, email: "bad" }))).status).toBe(400);
    expect((await call(request({ ...valid, type: "DATA_CORRECTION" }))).status).toBe(400);
    expect(createSupportTicket).not.toHaveBeenCalled();
  });
  it("returns 429 with Retry-After when rate limited, and creates nothing", async () => {
    enforceAnonymousRateLimit.mockRejectedValueOnce(new RateLimitError(120));
    const res = await call(request(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(createSupportTicket).not.toHaveBeenCalled();
  });
  it("refuses cross-site posts", async () => {
    const res = await call(request(valid, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(createSupportTicket).not.toHaveBeenCalled();
  });
  it("fails closed when the limiter store is down for this public form", async () => {
    await call(request(valid));
    expect(enforceAnonymousRateLimit.mock.calls[0][2]).toEqual({ failOpen: false });
  });
});
