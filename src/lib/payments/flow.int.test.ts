/**
 * End-to-end checks of fees, payments, refunds, expiry, reminders and notifications against a real Postgres.
 * Skipped unless TEST_DATABASE_URL points at a migrated, disposable database:
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.PAYMENT_PROVIDER = "mock";
process.env.PAYSTACK_SECRET_KEY = "";

describe.skipIf(!url)("fees, payments and notifications", () => {
  type Mods = {
    prisma: typeof import("../prisma").prisma;
    pricing: typeof import("../pricing");
    pay: typeof import("./service");
    notify: typeof import("../notifications/service");
    prefs: typeof import("../notifications/preferences");
    reminders: typeof import("../reminders");
  };
  let m: Mods;
  const tag = Math.random().toString(36).slice(2, 8);
  const ids = {} as { patientUser: string; doctorUser: string; patient: string; doctor: string };

  const book = async (opts: { at: Date; kind?: "STANDARD" | "FOLLOW_UP"; amount?: number; status?: "BOOKED" | "COMPLETED" | "CONFIRMED" }) => {
    const appointment = await m.prisma.appointment.create({
      data: { patientId: ids.patient, doctorId: ids.doctor, scheduledAt: opts.at, status: opts.status ?? "BOOKED", feeKind: opts.kind ?? "STANDARD", feeAmount: opts.amount ?? 10000, feeCurrency: "NGN" },
    });
    const payment = await m.prisma.$transaction((tx) =>
      m.pay.createPendingPayment(tx, { kind: "CONSULTATION", payerId: ids.patientUser, payeeId: ids.doctorUser, appointmentId: appointment.id, description: "Consultation fee", amount: opts.amount ?? 10000, currency: "NGN" }),
    );
    return { appointment, payment };
  };
  const pay = (reference: string, amountMinor = 1_000_000) => m.pay.applyProviderOutcome(reference, { status: "success", amountMinor, currency: "NGN", channel: "card" });
  const days = (n: number) => new Date(Date.now() + n * 86_400_000);

  beforeAll(async () => {
    m = {
      prisma: (await import("../prisma")).prisma,
      pricing: await import("../pricing"),
      pay: await import("./service"),
      notify: await import("../notifications/service"),
      prefs: await import("../notifications/preferences"),
      reminders: await import("../reminders"),
    };
    const p = m.prisma;
    const pu = await p.user.create({ data: { clerkId: `t-p-${tag}`, email: `p-${tag}@t.test`, name: "Pat Ient", role: "PATIENT", onboardingComplete: true } });
    const du = await p.user.create({ data: { clerkId: `t-d-${tag}`, email: `d-${tag}@t.test`, name: "Doc Tor", role: "DOCTOR", onboardingComplete: true } });
    const patient = await p.patient.create({ data: { caseNumber: `T-${tag}`, userId: pu.id, firstName: "Pat", lastName: "Ient", gender: "FEMALE", dateOfBirth: new Date("1990-01-01") } });
    const doctor = await p.doctorProfile.create({ data: { userId: du.id, verificationStatus: "VERIFIED", consultationFee: 10000, followUpFee: 4000, followUpWindowDays: 14 } });
    // A provisioned payout subaccount with zero commission: provider charges can be split at the
    // (mock) gateway, and checkout's live verification of the percentage passes.
    await p.providerSubaccount.create({
      data: { userId: du.id, provider: "DOCTOR", businessName: "Test Clinic", settlementBank: "Test Bank", accountNumber: "0123456789", percentageCharge: 0, currency: "NGN", subaccountCode: `ACCT_TEST_${tag}`, status: "ACTIVE" },
    });
    Object.assign(ids, { patientUser: pu.id, doctorUser: du.id, patient: patient.id, doctor: doctor.id });
  });

  afterAll(async () => {
    if (!m) return;
    const p = m.prisma;
    // Refund records reference payments (no cascade): remove them before the payments.
    await p.refund.deleteMany({ where: { payment: { payerId: { in: [ids.patientUser, ids.doctorUser] } } } });
    await p.payment.deleteMany({ where: { payerId: ids.patientUser } });
    await p.payment.deleteMany({ where: { payerId: ids.doctorUser } });
    await p.appointment.deleteMany({ where: { patientId: ids.patient } });
    await p.notification.deleteMany({ where: { userId: { in: [ids.patientUser, ids.doctorUser] } } });
    await p.providerSubaccount.deleteMany({ where: { userId: ids.doctorUser } });
    await p.commissionRule.deleteMany({ where: { createdById: ids.doctorUser } });
    // The notification outbox (workspace_delivery) references users without a cascade.
    await p.$executeRaw`DELETE FROM workspace_delivery WHERE owner_id IN (${ids.patientUser}::uuid, ${ids.doctorUser}::uuid)`;
    await p.patient.delete({ where: { id: ids.patient } });
    await p.doctorProfile.delete({ where: { id: ids.doctor } });
    await p.user.deleteMany({ where: { id: { in: [ids.patientUser, ids.doctorUser] } } });
    await p.$disconnect();
  });

  describe("consultation fee", () => {
    it("charges the standard fee to a new patient and advertises the follow-up rate", async () => {
      const fee = await m.pricing.resolveConsultationFee(ids.doctor, ids.patient, days(3));
      expect(fee).toMatchObject({ configured: true, kind: "STANDARD", amount: 10000, followUpAmount: 4000, followUpWindowDays: 14 });
    });

    it("charges the follow-up fee within the window after a completed standard visit, and not after it", async () => {
      const visit = await book({ at: days(-5), status: "COMPLETED" });
      const within = await m.pricing.resolveConsultationFee(ids.doctor, ids.patient, days(2));
      expect(within).toMatchObject({ kind: "FOLLOW_UP", amount: 4000, qualifyingAppointmentId: visit.appointment.id });
      const outside = await m.pricing.resolveConsultationFee(ids.doctor, ids.patient, days(30));
      expect(outside).toMatchObject({ kind: "STANDARD", amount: 10000 });
    });

    it("does not chain follow-ups: only a completed STANDARD visit opens the window", async () => {
      await m.prisma.appointment.deleteMany({ where: { patientId: ids.patient } });
      await m.prisma.payment.deleteMany({ where: { payerId: ids.patientUser } });
      await book({ at: days(-3), status: "COMPLETED", kind: "FOLLOW_UP", amount: 4000 });
      const fee = await m.pricing.resolveConsultationFee(ids.doctor, ids.patient, days(1));
      expect(fee.kind).toBe("STANDARD");
    });

    it("reports an unconfigured fee instead of silently charging nothing", async () => {
      await m.prisma.doctorProfile.update({ where: { id: ids.doctor }, data: { consultationFee: null } });
      expect((await m.pricing.resolveConsultationFee(ids.doctor, ids.patient, days(1))).configured).toBe(false);
      await m.prisma.doctorProfile.update({ where: { id: ids.doctor }, data: { consultationFee: 10000 } });
    });
  });

  describe("payments", () => {
    it("marks a payment successful once, issues one receipt, and is idempotent", async () => {
      const { payment, appointment } = await book({ at: days(5) });
      const first = await pay(payment.providerReference);
      expect(first?.status).toBe("SUCCESSFUL");
      expect(first?.receiptNumber).toMatch(/^RCT-\d{6}-[0-9A-F]{8}$/);
      const again = await pay(payment.providerReference);
      expect(again?.receiptNumber).toBe(first?.receiptNumber);
      const events = await m.prisma.paymentEvent.count({ where: { paymentId: payment.id, type: "SUCCEEDED" } });
      expect(events).toBe(1);

      // The doctor is told about the booking only now that it is paid, and exactly once.
      const doctorNotes = await m.prisma.notification.findMany({ where: { userId: ids.doctorUser, title: "New booking request" } });
      expect(doctorNotes.some((n) => (n.data as { appointmentId?: string }).appointmentId === appointment.id)).toBe(true);
      expect(doctorNotes.filter((n) => (n.data as { appointmentId?: string }).appointmentId === appointment.id)).toHaveLength(1);
    });

    it("refuses a payment whose amount does not match, and records it", async () => {
      const { payment } = await book({ at: days(6) });
      const result = await pay(payment.providerReference, 100);
      expect(result?.status).toBe("PENDING");
      expect(await m.prisma.paymentEvent.count({ where: { paymentId: payment.id, type: "AMOUNT_MISMATCH" } })).toBe(1);
    });

    it("moves a failed payment to FAILED and allows a retry that succeeds", async () => {
      const { payment } = await book({ at: days(7) });
      const failed = await m.pay.applyProviderOutcome(payment.providerReference, { status: "failed", reason: "Declined" });
      expect(failed?.status).toBe("FAILED");
      const ok = await pay(payment.providerReference);
      expect(ok?.status).toBe("SUCCESSFUL");
    });

    it("recognises an earlier checkout attempt's reference after a retry (no lost payments)", async () => {
      const { payment } = await book({ at: days(8) });
      const { reference: first } = await m.pay.startCheckout(payment.id, { id: ids.patientUser, email: "p@t.test" }, "CARD");
      const { reference: second } = await m.pay.startCheckout(payment.id, { id: ids.patientUser, email: "p@t.test" }, "CARD");
      expect(second).not.toBe(first);
      const viaOld = await pay(first);
      expect(viaOld?.id).toBe(payment.id);
      expect(viaOld?.status).toBe("SUCCESSFUL");
    });

    it("rejects methods that do not exist for the currency", async () => {
      const { payment } = await book({ at: days(9) });
      await expect(m.pay.startCheckout(payment.id, { id: ids.patientUser, email: "p@t.test" }, "MOBILE_MONEY")).rejects.toThrow(/not available/);
    });

    it("does not let someone else start checkout for a payment", async () => {
      const { payment } = await book({ at: days(10) });
      await expect(m.pay.startCheckout(payment.id, { id: ids.doctorUser, email: "d@t.test" }, "CARD")).rejects.toThrow(/not found/i);
    });
  });

  describe("cancellation, refunds and expiry", () => {
    it("refunds a paid booking that is cancelled, and completes via the mock gateway", async () => {
      const { payment } = await book({ at: days(11) });
      await pay(payment.providerReference);
      const paid = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      await m.pay.settlePaymentOnCancellation(paid, true, "Cancelled by the doctor");
      const after = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(after.status).toBe("REFUNDED");
      expect(after.refundedAt).not.toBeNull();
    });

    it("does not refund when the policy says no, and closes unpaid charges as cancelled", async () => {
      const late = await book({ at: days(12) });
      await pay(late.payment.providerReference);
      const paid = await m.prisma.payment.findUniqueOrThrow({ where: { id: late.payment.id } });
      await m.pay.settlePaymentOnCancellation(paid, false, "Late cancellation");
      expect((await m.prisma.payment.findUniqueOrThrow({ where: { id: late.payment.id } })).status).toBe("SUCCESSFUL");

      const unpaid = await book({ at: days(13) });
      await m.pay.settlePaymentOnCancellation(unpaid.payment, true, "Cancelled");
      expect((await m.prisma.payment.findUniqueOrThrow({ where: { id: unpaid.payment.id } })).status).toBe("CANCELLED");
    });

    it("refunds automatically if money arrives after the booking was released", async () => {
      const { payment } = await book({ at: days(14) });
      await m.pay.settlePaymentOnCancellation(payment, true, "Released");
      await pay(payment.providerReference);
      expect((await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REFUNDED");
    });

    it("releases the slot of an unpaid booking whose hold expired, and leaves paid ones alone", async () => {
      const stale = await book({ at: days(15) });
      await m.prisma.payment.update({ where: { id: stale.payment.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      const paid = await book({ at: days(16) });
      await pay(paid.payment.providerReference);
      await m.prisma.payment.update({ where: { id: paid.payment.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });

      expect(await m.pay.expireStalePayments()).toBeGreaterThanOrEqual(1);
      expect((await m.prisma.appointment.findUniqueOrThrow({ where: { id: stale.appointment.id } })).status).toBe("CANCELLED");
      expect((await m.prisma.payment.findUniqueOrThrow({ where: { id: stale.payment.id } })).status).toBe("CANCELLED");
      expect((await m.prisma.appointment.findUniqueOrThrow({ where: { id: paid.appointment.id } })).status).toBe("BOOKED");
    });
  });

  describe("notifications", () => {
    it("creates an in-app notification with a safe link and no clinical text", async () => {
      await m.notify.notifyUser(ids.patientUser, { kind: "APPOINTMENT_CONFIRMED", appointmentId: ids.doctor });
      const n = await m.prisma.notification.findFirst({ where: { userId: ids.patientUser, title: "Appointment confirmed" }, orderBy: { createdAt: "desc" } });
      expect(n?.href).toBe("/patient/appointments");
      expect(`${n?.title} ${n?.body}`).not.toMatch(/diagnos|prescri/i);
    });

    it("coalesces a burst of messages into one notification", async () => {
      const event = { kind: "MESSAGE_RECEIVED", conversationId: "22222222-2222-4222-8222-222222222222" } as const;
      await m.notify.notifyUser(ids.doctorUser, event);
      await m.notify.notifyUser(ids.doctorUser, event);
      await m.notify.notifyUser(ids.doctorUser, event);
      const count = await m.prisma.notification.count({ where: { userId: ids.doctorUser, type: "MESSAGE" } });
      expect(count).toBe(1);
    });

    it("respects preferences: pop-ups off marks the notification as no-toast", async () => {
      await m.prefs.savePreferences(ids.patientUser, { PAYMENT: { IN_APP: false, EMAIL: false, PUSH: false } });
      const matrix = await m.prefs.getPreferenceMatrix(ids.patientUser);
      expect(matrix.PAYMENT).toEqual({ IN_APP: false, EMAIL: false, PUSH: false });
      expect(matrix.MESSAGE).toEqual({ IN_APP: true, EMAIL: true, PUSH: true });
      await m.notify.notifyUser(ids.patientUser, { kind: "PAYMENT_FAILED", paymentId: ids.doctor });
      const n = await m.prisma.notification.findFirst({ where: { userId: ids.patientUser, title: "Payment failed" }, orderBy: { createdAt: "desc" } });
      expect((n?.data as { toast?: boolean }).toast).toBe(false);
    });

    it("sends each reminder once", async () => {
      const soon = await m.prisma.appointment.create({
        data: { patientId: ids.patient, doctorId: ids.doctor, scheduledAt: new Date(Date.now() + 40 * 60_000), status: "CONFIRMED" },
      });
      expect(await m.reminders.sendDueAppointmentReminders()).toBeGreaterThanOrEqual(1);
      const before = await m.prisma.notification.count({ where: { userId: ids.patientUser, title: "Appointment starting soon" } });
      await m.reminders.sendDueAppointmentReminders();
      expect(await m.prisma.notification.count({ where: { userId: ids.patientUser, title: "Appointment starting soon" } })).toBe(before);
      await m.prisma.appointment.delete({ where: { id: soon.id } });
    });
  });

  describe("payments platform hardening", () => {
    // ids is populated by beforeAll, which runs after this describe is registered.
    const payer = () => ({ id: ids.patientUser, email: `p-${tag}@t.test` });
    const subaccount = () =>
      m.prisma.providerSubaccount.create({
        data: { userId: ids.doctorUser, provider: "DOCTOR", businessName: "Test Clinic", settlementBank: "Test Bank", accountNumber: "0123456789", percentageCharge: 0, currency: "NGN", subaccountCode: `ACCT_TEST_${tag}`, status: "ACTIVE" },
      });

    it("refuses checkout for a provider charge until the payout subaccount exists", async () => {
      const { payment } = await book({ at: days(5) });
      await m.prisma.providerSubaccount.deleteMany({ where: { userId: ids.doctorUser } });
      await expect(m.pay.startCheckout(payment.id, payer(), "CARD")).rejects.toThrow(/payout account/);
      await subaccount();
    });

    it("returns a duplicate charge without touching the payment's own refund state", async () => {
      const { payment } = await book({ at: days(5) });
      const first = await m.pay.startCheckout(payment.id, payer(), "CARD");
      const second = await m.pay.startCheckout(payment.id, payer(), "CARD");

      await pay(first.reference);
      await pay(second.reference);

      const fresh = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(fresh.status).toBe("SUCCESSFUL");
      expect(fresh.chargedReference).toBe(first.reference);
      expect(await m.prisma.refund.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(await m.prisma.paymentEvent.count({ where: { paymentId: payment.id, type: "DUPLICATE_CHARGE_REFUND_SUBMITTED" } })).toBe(1);

      // A replay of the duplicate's success submits nothing new.
      await pay(second.reference);
      expect(await m.prisma.paymentEvent.count({ where: { paymentId: payment.id, type: "DUPLICATE_CHARGE_REFUND_SUBMITTED" } })).toBe(1);

      // The duplicate's refund completing must not refund the payment itself.
      await m.pay.handleWebhookEvent({ type: "refund.processed", reference: second.reference });
      const afterWebhook = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(afterWebhook.status).toBe("SUCCESSFUL");
      expect(await m.prisma.refund.count({ where: { paymentId: payment.id } })).toBe(0);
    });

    it("never treats a legacy payment without a charged reference as a duplicate", async () => {
      const { payment } = await book({ at: days(5) });
      const { reference } = await m.pay.startCheckout(payment.id, payer(), "CARD");
      await pay(reference);

      // Simulate a payment recorded before chargedReference existed, then replay its own success.
      await m.prisma.payment.update({ where: { id: payment.id }, data: { chargedReference: null } });
      await pay(reference);

      const fresh = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(fresh.status).toBe("SUCCESSFUL");
      expect(await m.prisma.paymentEvent.count({ where: { paymentId: payment.id, type: "DUPLICATE_CHARGE_REFUND_SUBMITTED" } })).toBe(0);
    });

    it("applies two concurrent subscription charges once each, with both periods surviving", async () => {
      const p = m.prisma;
      const subs = await import("../subscriptions");
      const admin = await p.user.create({ data: { clerkId: `t-a-${tag}`, email: `a-${tag}@t.test`, name: "Admin", role: "ADMIN", onboardingComplete: true } });
      const plan = await p.subscriptionPlan.create({ data: { code: `test-plan-${tag}`, name: "Test Plan", monthlyPrice: 5000, currency: "NGN", features: { pricingConfirmed: true }, active: true } });
      const subscription = await p.doctorSubscription.create({
        data: { doctorId: ids.doctor, planId: plan.id, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000) },
      });
      const mkCharge = () =>
        p.payment.create({
          data: {
            kind: "SUBSCRIPTION", payerId: ids.doctorUser, payeeId: admin.id, description: "Subscription",
            amount: 5000, currency: "NGN", provider: "MOCK", status: "SUCCESSFUL", paidAt: new Date(),
            providerReference: `test-sub-${tag}-${Math.random().toString(36).slice(2)}`,
            events: { create: { type: "CREATED", details: { planCode: plan.code } } },
          },
        });

      try {
        const [a, b] = await Promise.all([mkCharge(), mkCharge()]);
        // Two renewals landing at once: serialized, each consumed exactly once, both months kept.
        await Promise.all([subs.activateSubscriptionForPayment(a.id), subs.activateSubscriptionForPayment(b.id)]);

        const events = await p.subscriptionEvent.count({ where: { subscriptionId: subscription.id, type: { in: ["STARTED", "RENEWED", "PLAN_CHANGED"] } } });
        expect(events).toBe(2);
        const row = await p.doctorSubscription.findUniqueOrThrow({ where: { id: subscription.id } });
        expect(row.status).toBe("ACTIVE");
        // 20 days left in the current period plus the two paid months.
        expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(new Date(Date.now() + 55 * 86_400_000).getTime());

        // The recovery job re-runs without consuming either charge again.
        await subs.repairSubscriptionActivations();
        expect(await p.subscriptionEvent.count({ where: { subscriptionId: subscription.id, type: { in: ["STARTED", "RENEWED", "PLAN_CHANGED"] } } })).toBe(2);
      } finally {
        await p.doctorSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
        await p.payment.deleteMany({ where: { payerId: ids.doctorUser } });
        await p.subscriptionPlan.delete({ where: { id: plan.id } }).catch(() => {});
        await p.user.delete({ where: { id: admin.id } }).catch(() => {});
      }
    });

    it("repairs a late-cancellation refund that a crash interrupted", async () => {
      // The crash state, built directly: the booking was cancelled, the money arrived afterwards,
      // and the refund that is owed never started. (Driving it through the normal flow would
      // auto-refund in the same call, leaving nothing to recover.)
      const { payment, appointment } = await book({ at: days(5) });
      await m.prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
      await m.prisma.payment.update({
        where: { id: payment.id },
        // paidAt strictly after the cancellation: recovery compares appointment.updatedAt < paidAt
        // with millisecond precision, so an in-the-same-millisecond Date can lose the race.
        data: { status: "SUCCESSFUL", paidAt: new Date(Date.now() + 1000), chargedReference: payment.providerReference },
      });

      const recovered = await m.pay.recoverLateCancellationRefunds();
      expect(recovered).toBeGreaterThanOrEqual(1);
      const fresh = await m.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      // The mock gateway completes refunds immediately; a real gateway would be REFUND_PENDING.
      expect(["REFUND_PENDING", "REFUNDED"]).toContain(fresh.status);
      expect(await m.prisma.refund.count({ where: { paymentId: payment.id } })).toBe(1);

      // A payment that was already successful when the booking was cancelled is the policy's
      // business (refund when eligible, kept when not) — recovery must not touch it.
      const paid = await book({ at: days(6) });
      const { reference } = await m.pay.startCheckout(paid.payment.id, payer(), "CARD");
      await pay(reference);
      await m.prisma.appointment.update({ where: { id: paid.appointment.id }, data: { status: "CANCELLED" } });
      await m.pay.recoverLateCancellationRefunds();
      const untouched = await m.prisma.payment.findUniqueOrThrow({ where: { id: paid.payment.id } });
      expect(untouched.status).toBe("SUCCESSFUL");
    });

    it("sums provider earnings per currency from the full period", async () => {
      const p = m.prisma;
      // An isolated payee: other tests' payments for the shared doctor must not pollute totals.
      const payee = await p.user.create({ data: { clerkId: `t-e-${tag}`, email: `e-${tag}@t.test`, name: "Earner", role: "DOCTOR", onboardingComplete: true } });
      const mk = (amount: number, currency: string, commission: number, status: "SUCCESSFUL" | "REFUNDED" = "SUCCESSFUL") =>
        p.payment.create({
          data: {
            kind: "CONSULTATION", payerId: ids.patientUser, payeeId: payee.id, description: "Consultation fee",
            amount, currency, provider: "MOCK", status, paidAt: new Date(),
            commissionAmount: commission, providerAmount: amount - commission,
            providerReference: `test-earn-${tag}-${Math.random().toString(36).slice(2)}`,
          },
        });
      try {
      await mk(10000, "NGN", 1000);
      await mk(5000, "NGN", 1000);
      await mk(30, "USD", 3);
      await mk(20, "USD", 2, "REFUNDED");

      const reports = await import("../reports");
      const summary = await reports.providerEarningsSummary(payee.id, new Date(Date.now() - 86_400_000));
      const ngn = summary.totals.find((row) => row.currency === "NGN");
      const usd = summary.totals.find((row) => row.currency === "USD");
      expect(ngn).toMatchObject({ gross: 15000, commission: 2000, earnings: 13000, refunded: 0 });
      // The refunded USD charge reverses only the provider's share (18), not the whole 20.
      expect(usd).toMatchObject({ gross: 50, commission: 5, earnings: 27, refunded: 18 });
      } finally {
        await p.payment.deleteMany({ where: { payeeId: payee.id } });
        await p.user.delete({ where: { id: payee.id } }).catch(() => {});
      }
    });
  });
});
