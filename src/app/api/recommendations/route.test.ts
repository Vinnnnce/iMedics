import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
  requireFacilityAccess: vi.fn(),
}));
vi.mock("@/lib/data/recommendations", () => ({
  getRecommendations: vi.fn(),
}));

import { requireUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/data/recommendations";
import { unauthorized } from "@/lib/errors";
import { GET } from "./route";

const readyUser = {
  id: "user-1",
  role: "PATIENT",
  accountType: "PATIENT",
  status: "ACTIVE",
  onboardingComplete: true,
} as never;

function request(url = "http://localhost:3000/api/recommendations") {
  return new Request(url) as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/recommendations", () => {
  it("returns the categories built for the signed-in user", async () => {
    vi.mocked(requireUser).mockResolvedValue(readyUser);
    vi.mocked(getRecommendations).mockResolvedValue([
      { key: "doctors", label: "Doctors", items: [{ id: "d1", name: "Dr. Ada", subtitle: "Cardiology", href: "/doctors/d1" }] },
    ] as never);

    const response = await GET(request(), {} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.categories[0].key).toBe("doctors");
    expect(getRecommendations).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1", role: "PATIENT" }), null);
  });

  it("passes the dashboard context through and never trusts it for authorization", async () => {
    vi.mocked(requireUser).mockResolvedValue(readyUser);
    vi.mocked(getRecommendations).mockResolvedValue([] as never);

    const response = await GET(request("http://localhost:3000/api/recommendations?context=facility"), {} as never);

    expect(response.status).toBe(200);
    expect(getRecommendations).toHaveBeenCalledWith(expect.anything(), "facility");
  });

  it("sets private, no-store caching", async () => {
    vi.mocked(requireUser).mockResolvedValue(readyUser);
    vi.mocked(getRecommendations).mockResolvedValue([] as never);

    const response = await GET(request(), {} as never);

    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("requires a signed-in, ready account", async () => {
    vi.mocked(requireUser).mockRejectedValue(unauthorized() as never);

    const response = await GET(request(), {} as never);

    expect(response.status).toBe(401);
    expect(getRecommendations).not.toHaveBeenCalled();
  });
});
