import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("./prisma", () => ({ prisma: {} }));

import { entitlementsForPlan, FREE_ENTITLEMENTS } from "./subscriptions";

describe("subscription entitlements", () => {
  it("gives doctors without a plan the free baseline", () => {
    expect(FREE_ENTITLEMENTS).toMatchObject({ chat: true, listing: true, video: false, audio: false, ai: false, analytics: false });
  });

  it("switches on the features a plan includes", () => {
    const entitlements = entitlementsForPlan({ features: { video: true, ai: true } });
    expect(entitlements.video).toBe(true);
    expect(entitlements.ai).toBe(true);
    expect(entitlements.chat).toBe(true); // free baseline
    expect(entitlements.analytics).toBe(false);
  });

  it("can switch a free feature off", () => {
    const entitlements = entitlementsForPlan({ features: { listing: false } });
    expect(entitlements.listing).toBe(false);
  });
});
