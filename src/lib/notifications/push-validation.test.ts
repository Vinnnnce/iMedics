import { describe, expect, it } from "vitest";
import { isSafePushEndpoint, pushSubscriptionSchema } from "./push-validation";
import { safeNotificationHref } from "./safe-href";

describe("push endpoint security", () => {
  it.each(["https://fcm.googleapis.com/fcm/send/id", "https://updates.push.services.mozilla.com/wpush/v2/id", "https://web.push.apple.com/Q/id", "https://wns.notify.windows.com/id"])("permits known provider %s", endpoint => {
    expect(isSafePushEndpoint(endpoint)).toBe(true);
  });
  it.each(["http://fcm.googleapis.com/id", "https://127.0.0.1/id", "https://169.254.169.254/latest/meta-data", "https://fcm.googleapis.com.evil.example/id", "https://user:pass@fcm.googleapis.com/id", "https://fcm.googleapis.com:8080/id", "https://evil.example/id", "invalid"])("rejects SSRF target %s", endpoint => {
    expect(isSafePushEndpoint(endpoint)).toBe(false);
  });
  it("validates the browser key lengths and curve encoding", () => {
    const valid = { endpoint: "https://fcm.googleapis.com/id", keys: {
      p256dh: Buffer.from([4, ...Array(64).fill(1)]).toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url"),
    } };
    expect(pushSubscriptionSchema.safeParse(valid).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...valid, keys: { ...valid.keys, auth: "bad" } }).success).toBe(false);
  });
});
describe("notification navigation", () => {
  it.each(["//evil.example", "/\\evil.example", "javascript:alert(1)", "https://evil.example", "/\nevil.example"])("rejects unsafe href %s", href => expect(safeNotificationHref(href)).toBe("/"));
  it("preserves internal deep links", () => expect(safeNotificationHref("/payments/abc?tab=receipt")).toBe("/payments/abc?tab=receipt"));
});
