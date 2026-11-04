import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_KEY, optionalProcessingAllowed, readCookieConsent, saveCookieConsent, type CookieConsent } from "./cookie-consent";
let storage: Map<string, string>;
const choices = (): CookieConsent => ({ version: 1, essential: true, preferences: true, analytics: false, performance: false, marketing: false, savedAt: new Date().toISOString() });
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("document", { cookie: "" });
});
afterEach(() => vi.unstubAllGlobals());
describe("deny-by-default optional storage", () => {
  it("does not allow any optional category before consent", () => {
    for (const category of ["preferences", "analytics", "performance", "marketing"] as const) expect(optionalProcessingAllowed(category)).toBe(false);
  });
  it("saves granular choices, rejecting unrelated categories", () => {
    saveCookieConsent(choices());
    expect(optionalProcessingAllowed("preferences")).toBe(true);
    expect(optionalProcessingAllowed("analytics")).toBe(false);
  });
  it("withdraws saved preference data without touching authentication", () => {
    storage.set("imedics.theme", "dark");
    storage.set("medic1905.sidebar.collapsed", "1");
    storage.set("auth-session", "untouched");
    saveCookieConsent({ ...choices(), preferences: false });
    expect(storage.has("imedics.theme")).toBe(false);
    expect(storage.has("medic1905.sidebar.collapsed")).toBe(false);
    expect(storage.get("auth-session")).toBe("untouched");
  });
  it("denies malformed, expired, future and inaccessible storage", () => {
    for (const value of ["{", JSON.stringify({ ...choices(), savedAt: "bad" }), JSON.stringify({ ...choices(), savedAt: "2000-01-01" }), JSON.stringify({ ...choices(), savedAt: "2099-01-01" })]) {
      storage.set(COOKIE_CONSENT_KEY, value);
      expect(readCookieConsent()).toBeNull();
    }
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readCookieConsent()).toBeNull();
  });
});
