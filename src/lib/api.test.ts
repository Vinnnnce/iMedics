import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: { id: "u1", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null as Date | null },
  requireUser: vi.fn(), requireRole: vi.fn(),
}));
vi.mock("./auth", () => ({ requireUser: mocks.requireUser, requireRole: mocks.requireRole }));
import { withAuth } from "./api";

describe("API foundation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.status = "ACTIVE";
    mocks.user.onboardingComplete = true;
    mocks.requireUser.mockResolvedValue(mocks.user);
    mocks.requireRole.mockResolvedValue(mocks.user);
  });
  const handler = vi.fn(async () => Response.json({ ok: true }));
  const invoke = (route: ReturnType<typeof withAuth>, init?: ConstructorParameters<typeof NextRequest>[1]) =>
    route(new NextRequest("https://care.example/api/me", init), { params: Promise.resolve({}) });
  it("blocks cross-site writes before auth or handler execution", async () => {
    const response = await invoke(withAuth(null, handler), { method: "POST", headers: { origin: "https://evil.example" } });
    expect(response.status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects incomplete and pending accounts by default", async () => {
    mocks.user.status = "PENDING";
    expect((await invoke(withAuth(null, handler))).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("explicitly permits onboarding-only endpoints", async () => {
    mocks.user.onboardingComplete = false;
    expect((await invoke(withAuth(null, handler, { allowOnboarding: true }))).status).toBe(200);
  });
  it("marks success and error responses private and non-cacheable", async () => {
    const response = await invoke(withAuth(null, handler));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    mocks.user.status = "PENDING";
    expect((await invoke(withAuth(null, handler))).headers.get("cache-control")).toBe("private, no-store");
  });
});
