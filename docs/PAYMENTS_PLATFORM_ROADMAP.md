# Payments & Commissions Platform Roadmap (Medic1905)

> Status: **work in progress (feature branch `payments-platform`).** All five phases below are implemented in code on the branch, with the payment-flow and recovery tests running in CI against a disposable database. Known open items before this can be called complete:
>
> - **Duplicate-charge refund claims**: a claim that exists without a recorded gateway outcome (crash or timeout between claim and result) stays durably unresolved; recovery relies on the gateway's refund webhooks and an admin-visible event trail rather than automatic resolution.
> - **FAILED refund re-approval**: an admin can move a FAILED refund back to APPROVED, but the retry path does not yet resubmit when an earlier REFUND_ACCEPTED event exists; it alerts instead.
> - **Checkout attempt accounting**: each checkout attempt's reference and split snapshot are recorded, but the winning attempt's accounting is not yet applied atomically from an attempt-level record.
> - **Per-transaction commission override**: Paystack's `transaction_charge` may be able to carry a calculated (percentage-derived) commission per transaction, removing the dependence on mutable subaccount defaults — unverified against the live API.
> - **Settlement-report verification**: reconciliation compares against the gateway's charge list, not a settlement report; a missing successful charge raises a warning to verify manually in the gateway dashboard.
> - **Mock provider**: cannot exercise nonzero percentage checkout (its live percentage read always returns zero).
>
> Seeded subscription plan prices and allowances are placeholder defaults; purchases are disabled until an admin confirms them (`pricingConfirmed: true` in the plan's `features` JSON, together with real prices).
>
> Where things live: commission and payout configuration in `/admin/commission` and `/admin/providers` (Phase 1); the split and subaccount wiring in `lib/commissions.ts`, `lib/subaccounts.ts` and `lib/payments/service.ts` (Phase 2); the refund queue and reconciliation screens in `/admin/refunds` and `/admin/reconciliation` with the daily job at `/api/cron/reconciliation` (Phase 3); plans and gating in `lib/subscriptions.ts` with the doctor screen at `/doctor/subscription` and the lifecycle job at `/api/cron/subscriptions` (Phase 4); facility commission rules, bulk service import, branch pricing and reporting in Phase 5 (`/api/facility/services/bulk`, `/admin/reports`).

## Phase 1: Foundations

- Define provider types and onboarding requirements.
- Create provider, service, consultation, payment, commission, refund, subscription, and plan data models.
- Build provider pricing screens for doctors, hospitals, laboratories, and diagnostic centres.
- Build commission configuration screens for Medic1905 admins.
- Create a provider verification workflow.
- Integrate payment-provider subaccount creation after provider verification.

## Phase 2: Consultation payments

- Build the patient checkout screen.
- Create a payment intent when a patient initiates a booking.
- Pass the provider subaccount and commission configuration to the gateway.
- Collect the full consultation fee from the patient.
- Apply the split so Medic1905 receives only its commission.
- Handle gateway webhooks for successful, failed, and refunded payments.
- Confirm appointments only after successful payment.
- Build provider earnings and transaction history screens.

## Phase 3: Refunds and reconciliation

- Define cancellation and refund rules.
- Build patient refund-request and provider cancellation flows.
- Implement refund status tracking.
- Build an admin refund-approval workflow.
- Create daily reconciliation between Medic1905 payment records and gateway reports.
- Add alerts for missing webhooks, mismatched amounts, duplicate payments, and failed settlements.

## Phase 4: Doctor subscriptions

- Create subscription plans and feature entitlements.
- Build doctor plan-selection and checkout screens.
- Implement monthly recurring billing or a managed renewal flow.
- Track consultation usage against each doctor's monthly allowance.
- Gate chat, audio, video, AI, analytics, and listing features by subscription tier.
- Build upgrade, downgrade, cancellation, expiry, and renewal flows.
- Send subscription billing and expiry notifications.

## Phase 5: Facility payments and scale

- Extend checkout to hospital, laboratory, and diagnostic-centre services.
- Build facility service catalogues and price management.
- Support facility-specific commission rules.
- Add bulk service import/update for large facilities.
- Add branch/location-based pricing if needed.
- Add reporting for platform revenue, provider earnings, refunds, subscription revenue, and usage by plan.
