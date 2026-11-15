import { describe, expect, it } from "vitest";
import {
  computeTrialEnd, isAlwaysAllowedPath, launchFreeUntil, noticeThreshold, resolveAccessState, trialDays, graceDays,
  type SubscriptionLike,
} from "./facility-subscriptions";

const DAY = 86_400_000;
const now = new Date("2026-12-01T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * DAY);
const trial = (endsInDays: number, status: SubscriptionLike["status"] = "TRIALING"): SubscriptionLike => ({ status, trialEndsAt: at(endsInDays), currentPeriodEnd: null });

describe("trial length and launch promotion", () => {
  it("defaults to 30 days and accepts a configured length", () => {
    expect(trialDays({})).toBe(30);
    expect(trialDays({ FACILITY_TRIAL_DAYS: "14" })).toBe(14);
    expect(trialDays({ FACILITY_TRIAL_DAYS: "abc" })).toBe(30);
    expect(trialDays({ FACILITY_TRIAL_DAYS: "-3" })).toBe(30);
    expect(graceDays({})).toBe(7);
  });
  it("ends 30 days after the start", () => {
    expect(computeTrialEnd(now, {}).getTime()).toBe(now.getTime() + 30 * DAY);
  });
  it("holds every trial open until a launch date when that is later", () => {
    const env = { LAUNCH_FREE_UNTIL: "2027-03-31" };
    expect(launchFreeUntil(env)?.toISOString()).toBe("2027-03-31T23:59:59.999Z");
    expect(computeTrialEnd(now, env).toISOString()).toBe("2027-03-31T23:59:59.999Z");
    // an earlier launch date never shortens a trial
    expect(computeTrialEnd(now, { LAUNCH_FREE_UNTIL: "2026-12-05" }).getTime()).toBe(now.getTime() + 30 * DAY);
    expect(launchFreeUntil({ LAUNCH_FREE_UNTIL: "not a date" })).toBeNull();
    expect(launchFreeUntil({})).toBeNull();
  });
});

describe("what a facility may do", () => {
  it("is unrestricted without a subscription row", () => {
    expect(resolveAccessState(null, true, now)).toMatchObject({ phase: "UNMETERED", canWrite: true });
  });
  it("is fully open during the trial and counts days left", () => {
    expect(resolveAccessState(trial(10), true, now)).toMatchObject({ phase: "TRIAL", canWrite: true, daysLeft: 10 });
    expect(resolveAccessState(trial(0.2), true, now)).toMatchObject({ phase: "TRIAL", daysLeft: 1 });
  });
  it("is open while a paid period runs", () => {
    const paid: SubscriptionLike = { status: "ACTIVE", trialEndsAt: at(-60), currentPeriodEnd: at(12) };
    expect(resolveAccessState(paid, true, now)).toMatchObject({ phase: "PAID", canWrite: true, daysLeft: 12 });
  });
  it("gives a grace period after the trial, then becomes read-only", () => {
    expect(resolveAccessState(trial(-3, "EXPIRED"), true, now)).toMatchObject({ phase: "GRACE", canWrite: true });
    expect(resolveAccessState(trial(-8, "EXPIRED"), true, now)).toMatchObject({ phase: "READ_ONLY", canWrite: false });
    // an unflipped TRIALING row past its end behaves the same: the daily job is not required for correctness
    expect(resolveAccessState(trial(-8, "TRIALING"), true, now)).toMatchObject({ phase: "READ_ONLY", canWrite: false });
  });
  it("never restricts anyone while no priced plan exists", () => {
    expect(resolveAccessState(trial(-100, "EXPIRED"), false, now)).toMatchObject({ phase: "FREE_UNTIL_PLANS", canWrite: true });
  });
  it("treats a lapsed paid plan like a lapsed trial, measured from the paid period's end", () => {
    const lapsed: SubscriptionLike = { status: "EXPIRED", trialEndsAt: at(-90), currentPeriodEnd: at(-2) };
    expect(resolveAccessState(lapsed, true, now).phase).toBe("GRACE");
    expect(resolveAccessState({ ...lapsed, currentPeriodEnd: at(-9) }, true, now).phase).toBe("READ_ONLY");
    expect(resolveAccessState({ status: "ACTIVE", trialEndsAt: at(-90), currentPeriodEnd: at(-9) }, true, now).phase).toBe("READ_ONLY");
  });
  it("honours a configured grace length", () => {
    expect(resolveAccessState(trial(-3, "EXPIRED"), true, now, { FACILITY_GRACE_DAYS: "2" }).phase).toBe("READ_ONLY");
    expect(resolveAccessState(trial(-3, "EXPIRED"), true, now, { FACILITY_GRACE_DAYS: "0" }).phase).toBe("READ_ONLY");
  });
});

describe("work that never stops after a trial ends", () => {
  it("keeps billing, safety-critical work and records export available", () => {
    for (const path of [
      "/api/facility/subscription", "/api/facility/subscription/purchase", "/api/payments/abc/checkout",
      "/api/facility/critical-alerts/abc", "/api/facility/his/emergency", "/api/facility/his/emergency/abc",
      "/api/facility/his/nursing/tasks", "/api/facility/his/medication-orders/abc", "/api/facility/his/pharmacy/dispense",
      "/api/facility/break-glass", "/api/facility/his/patients/3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10/package",
    ]) expect(isAlwaysAllowedPath(path), path).toBe(true);
  });
  it("blocks creating new administrative and clinical records", () => {
    for (const path of [
      "/api/facility/staff", "/api/facility/services", "/api/facility/his/documents", "/api/facility/his/encounters",
      "/api/facility/specimens", "/api/facility/his/registration", "/api/facility/website", "/api/facility/his/settings",
    ]) expect(isAlwaysAllowedPath(path), path).toBe(false);
  });
  it("does not allow look-alike paths", () => {
    expect(isAlwaysAllowedPath("/api/facility/subscriptionx")).toBe(false);
    expect(isAlwaysAllowedPath("/api/facility/his/emergency-fake")).toBe(false);
    expect(isAlwaysAllowedPath("/api/facility/his/patients/x/package/extra")).toBe(false);
  });
});

describe("notice schedule", () => {
  it("sends one notice at 14, 7 and 1 days", () => {
    expect(noticeThreshold(15)).toBeNull();
    expect(noticeThreshold(14)).toBe(14);
    expect(noticeThreshold(8)).toBe(14);
    expect(noticeThreshold(7)).toBe(7);
    expect(noticeThreshold(2)).toBe(7);
    expect(noticeThreshold(1)).toBe(1);
    expect(noticeThreshold(0)).toBeNull();
  });
});
