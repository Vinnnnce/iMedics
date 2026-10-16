import { describe, expect, it } from "vitest";
import { assertSameOriginWrite } from "./request-security";

describe("authenticated write origin checks", () => {
  it("permits same-origin writes", () => {
    expect(() => assertSameOriginWrite(new Request("https://care.example/api/me", { method: "PATCH", headers: { origin: "https://care.example" } }))).not.toThrow();
  });
  it.each(["https://evil.example", "null", "invalid"])("rejects origin %s", origin => {
    expect(() => assertSameOriginWrite(new Request("https://care.example/api/me", { method: "POST", headers: { origin } }))).toThrow("Cross-site");
  });
  it("rejects explicit cross-site browser writes even without Origin", () => {
    expect(() => assertSameOriginWrite(new Request("https://care.example/api/me", { method: "DELETE", headers: { "sec-fetch-site": "cross-site" } }))).toThrow();
  });
  it("allows authenticated non-browser clients and reads", () => {
    expect(() => assertSameOriginWrite(new Request("https://care.example/api/me", { method: "POST" }))).not.toThrow();
    expect(() => assertSameOriginWrite(new Request("https://care.example/api/me", { headers: { origin: "https://other.example" } }))).not.toThrow();
  });
});
