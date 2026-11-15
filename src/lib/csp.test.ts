import { describe, expect, it } from "vitest";
import { buildCsp, cspHeader, cspMode } from "./csp";

const prod = { NODE_ENV: "production", S3_BUCKET: "med-files", S3_REGION: "eu-west-1" } as Record<string, string>;

describe("content security policy", () => {
  it("defaults to report-only and supports enforce and off", () => {
    expect(cspMode(undefined)).toBe("report-only");
    expect(cspMode("enforce")).toBe("enforce");
    expect(cspMode("off")).toBe("off");
    expect(cspMode("nonsense")).toBe("report-only");
    expect(cspHeader({ ...prod })?.key).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeader({ ...prod, CSP_MODE: "enforce" })?.key).toBe("Content-Security-Policy");
    expect(cspHeader({ ...prod, CSP_MODE: "off" })).toBeNull();
  });
  it("blocks plugins, framing, base-tag and form hijacking", () => {
    const csp = buildCsp(prod, false);
    for (const part of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) expect(csp).toContain(part);
  });
  it("only allows eval during development", () => {
    expect(buildCsp(prod, false)).not.toContain("'unsafe-eval'");
    expect(buildCsp(prod, true)).toContain("'unsafe-eval'");
  });
  it("allows the configured storage and the services the app depends on", () => {
    const csp = buildCsp(prod, false);
    expect(csp).toContain("https://med-files.s3.eu-west-1.amazonaws.com");
    expect(csp).toContain("https://js.paystack.co");
    expect(csp).toContain("https://*.clerk.accounts.dev");
    expect(csp).not.toMatch(/script-src[^;]*\*(?!\.)/);
  });
});
