// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from "@/lib/api-client";
import { RecommendationsSection } from "./recommendations-section";

const categories = [
  {
    key: "doctors",
    label: "Doctors",
    items: [
      { id: "d1", name: "Dr. Ada", subtitle: "Cardiology", href: "/doctors/d1" },
      { id: "d2", name: "Dr. Bello", subtitle: null, href: "/doctors/d2" },
    ],
  },
  { key: "patients", label: "Patients", items: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("RecommendationsSection", () => {
  it("shows a loading state before the suggestions arrive", async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}) as never);

    render(<RecommendationsSection variant="patient" />);

    expect(screen.getByText("Recommended for you")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    const section = screen.getByRole("region") ?? document.querySelector("section");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading suggestions")).toBeInTheDocument();
  });

  it("renders each category with clickable suggestions", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ categories } as never);

    render(<RecommendationsSection variant="patient" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Doctors", level: 3 })).toBeInTheDocument());
    const ada = screen.getByRole("link", { name: /Dr\. Ada/ });
    expect(ada).toHaveAttribute("href", "/doctors/d1");
    expect(screen.getByRole("link", { name: /Dr\. Bello/ })).toHaveAttribute("href", "/doctors/d2");
    // Categories with no suggestions show a graceful empty note.
    expect(screen.getByText("No patients to suggest yet.")).toBeInTheDocument();
  });

  it("requests the context matching the dashboard it is rendered on", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ categories: [] } as never);

    render(<RecommendationsSection variant="facility" />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/recommendations?context=facility"));
  });

  it("fetches the real /api/recommendations endpoint", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ categories: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await actual.apiClient.get("/recommendations?context=facility");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/recommendations?context=facility",
        expect.objectContaining({ method: "GET" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a friendly message when there is nothing to suggest at all", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ categories: [] } as never);

    render(<RecommendationsSection variant="patient" />);

    await waitFor(() =>
      expect(screen.getByText("Suggestions will appear here once your account is set up.")).toBeInTheDocument(),
    );
  });

  it("shows an error state with a retry that recovers", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ categories } as never);

    render(<RecommendationsSection variant="patient" />);

    await waitFor(() => expect(screen.getByText("Could not load your suggestions right now.")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Dr\. Ada/ })).toBeInTheDocument());
  });
});
