# Payments & Commissions Platform Roadmap (Medic1905)

> Status: planned. This document defines the phased build-out of provider onboarding, consultation payments, refunds and reconciliation, doctor subscriptions, and facility payments. It is a planning document only — existing code is unchanged.

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
