/**
 * Always-running tests for the conversation list: image-only messages surface a
 * "Photo" placeholder instead of an empty preview.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  requireFacilityAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/access", () => ({
  findAccessiblePatient: vi.fn(),
  getVerifiedDoctorProfile: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DOCTOR_USER = { id: "user-1", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(DOCTOR_USER);
});

describe("GET /api/conversations", () => {
  it("shows a Photo placeholder for image-only last messages, captions otherwise", async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      {
        id: "c1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        patient: { id: "p1", firstName: "Ada", lastName: "Lovelace" },
        doctor: { id: "d1", user: { name: "Dr. House" } },
        messages: [{ body: "", type: "IMAGE", createdAt: new Date("2026-01-02T00:00:00Z"), senderId: "user-1" }],
        _count: { messages: 0 },
      },
      {
        id: "c2",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        patient: { id: "p2", firstName: "Grace", lastName: "Hopper" },
        doctor: { id: "d1", user: { name: "Dr. House" } },
        messages: [{ body: "Look at this", type: "IMAGE", createdAt: new Date("2026-01-03T00:00:00Z"), senderId: "user-1" }],
        _count: { messages: 0 },
      },
      {
        id: "c3",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        patient: { id: "p3", firstName: "Alan", lastName: "Turing" },
        doctor: { id: "d1", user: { name: "Dr. House" } },
        messages: [{ body: "Hello", type: "TEXT", createdAt: new Date("2026-01-04T00:00:00Z"), senderId: "user-1" }],
        _count: { messages: 0 },
      },
    ] as never);

    const response = await GET(new NextRequest("https://care.example/api/conversations"), { user: DOCTOR_USER } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    const byId = Object.fromEntries(body.conversations.map((c: { id: string; lastMessage: { body: string } }) => [c.id, c.lastMessage.body]));
    expect(byId.c1).toBe("Photo");
    expect(byId.c2).toBe("Look at this");
    expect(byId.c3).toBe("Hello");
  });
});
