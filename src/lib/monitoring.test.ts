import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEvent, isDuplicate, monitoredCron, reportServerError, resetMonitoringDedupe, routeLabel } from "./monitoring";

beforeEach(() => { resetMonitoringDedupe(); vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("monitoring events are free of identifying detail", () => {
  it("labels routes without ids or query strings", () => {
    expect(routeLabel("/api/patients/3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10/results?token=abc#x")).toBe("/api/patients/:id/results");
    expect(routeLabel("/api/orders/123456/items")).toBe("/api/orders/:n/items");
    expect(routeLabel(undefined)).toBeUndefined();
  });
  it("keeps the failure kind but never the message, stack or SQL", () => {
    const error = Object.assign(new Error("duplicate key for patient Jane Doe, phone 0803"), { stack: "at secret.ts:1" });
    const event = buildEvent("api", error, "/api/x");
    expect(JSON.stringify(event)).not.toMatch(/Jane|0803|secret/);
    expect(event.kind).toBe("Error");
    const prismaLike = Object.assign(new Error("boom with data"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    expect(buildEvent("api", prismaLike)).toMatchObject({ kind: "PrismaClientKnownRequestError", code: "P2002" });
    expect(buildEvent("api", "a thrown string with PHI").kind).toBe("UnknownError");
  });
});

describe("alert delivery", () => {
  it("posts once per failure inside the de-duplication window", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example/alert");
    reportServerError("api", new Error("a"), "/api/x");
    reportServerError("api", new Error("b"), "/api/x");
    reportServerError("api", new Error("c"), "/api/y");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.text).toContain("/api/x");
    expect(JSON.stringify(sent)).not.toContain("a\"");
  });
  it("does nothing beyond logging when no webhook is configured", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    reportServerError("api", new Error("x"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it("never throws if the webhook is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example/alert");
    expect(() => reportServerError("api", new Error("x"), "/api/z")).not.toThrow();
  });
  it("expires de-duplication after five minutes", () => {
    const event = buildEvent("api", new Error("x"), "/api/x");
    expect(isDuplicate(event, 0)).toBe(false);
    expect(isDuplicate(event, 60_000)).toBe(true);
    expect(isDuplicate(event, 6 * 60_000)).toBe(false);
  });
});

describe("monitoredCron", () => {
  it("passes successful runs through", async () => {
    const res = await monitoredCron("ok", async () => Response.json({ done: true }))();
    expect(res.status).toBe(200);
  });
  it("turns a thrown error into a generic 500 and reports it", async () => {
    const res = await monitoredCron("broken", async () => { throw new Error("secret detail"); })();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(console.error).toHaveBeenCalled();
  });
});
