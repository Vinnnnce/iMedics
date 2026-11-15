import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, forbidden, toErrorResponse } from "./errors";

afterEach(() => vi.restoreAllMocks());

describe("toErrorResponse", () => {
  it("returns ApiError status and message", async () => {
    const res = toErrorResponse(forbidden("No"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No" });
  });
  it("honours a 4xx status on a plain Error instead of reporting a server failure", async () => {
    const error = Object.assign(new Error("Document not found"), { status: 404 });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toErrorResponse(error, "/api/x");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Document not found" });
    expect(log).not.toHaveBeenCalled();
  });
  it("never treats a 5xx or odd status field as a client error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [500, 302, 99, "404", 404.5, NaN]) {
      const res = toErrorResponse(Object.assign(new Error("internal detail"), { status }));
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain("internal detail");
    }
  });
  it("hides the message of unknown errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toErrorResponse(new Error("SELECT * FROM patients"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
  it("keeps ApiError an instance check target", () => {
    expect(new ApiError(404, "x")).toBeInstanceOf(Error);
  });
});
