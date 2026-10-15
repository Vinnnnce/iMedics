# Fees, payments and notifications

## Fees

| Who | Where | Rule |
|---|---|---|
| Doctor | `/doctor/fees`, `PUT /api/doctors/me/fees` | Standard fee (0 = free) plus an optional lower follow-up fee valid for N days (1 to 90). Patients cannot book a doctor who has not set a standard fee. |
| Facility (lab, diagnostic centre, hospital) | `/lab/services`, `/api/facility/services` | Priced services with type, description, availability text and turnaround; plus address, city, state and opening hours. Must be verified. Removing a booked service hides it instead. |

**Follow-up rate.** A booking is charged the follow-up fee when the patient has a *completed standard* consultation with that doctor within the doctor's window before the new appointment. Follow-ups do not start a new window. Without a follow-up fee, the standard fee applies. The booking panel shows the price (and why a reduced rate applies, or that one is available) before the patient commits.

**The server owns the price.** `GET /api/doctors/[id]/pricing` is only a preview. `POST /api/appointments` recomputes it and freezes it on the appointment (`fee_kind`, `fee_amount`, `fee_currency`); later fee changes never alter existing bookings. Facility bookings freeze the service name, price and currency the same way.

## Payments

- Provider: **Paystack** (`NGN, GHS, KES, ZAR, USD`) through the `PaymentProvider` interface in `lib/payments/provider.ts`. Methods offered per currency are in `lib/payments/config.ts` (card; bank transfer and USSD for NGN; mobile money for GHS and KES). Add Flutterwave or another gateway by implementing the interface.
- **Flow.** Patient picks a time and a method → booking is created with a pending payment (slot held 30 minutes) → patient is sent to the gateway → return to `/payments/callback` (verified server-side) and/or the webhook confirms → the doctor or facility is notified of the (now paid) booking.
- **States:** `PENDING`, `SUCCESSFUL`, `FAILED`, `REFUND_PENDING`, `REFUNDED`, `CANCELLED`. Transitions are claimed with conditional updates, so webhooks and verification can arrive in any order, twice, or together without double effects. Gateway amount and currency must match the stored payment or it is rejected and logged.
- **Retries** use a fresh gateway reference each time; every earlier reference still resolves to the same payment, so money is never "lost" if an old checkout is completed.
- **Expiry.** Unpaid and failed bookings are cancelled when the hold passes (lazily on booking/availability, and by the cron job). A payment that arrives after release is refunded automatically.
- **Refund policy** (`isRefundEligible`): the provider cancelling always refunds; a patient gets a full refund if the provider has not confirmed yet, or if they cancel at least 24 hours before. Refunds are requested from the gateway and completed by webhook; failed requests are retried by the cron job.
- **Receipts and records.** `/payments` lists everything paid or received; `/payments/[id]` is the printable receipt (`RCT-YYYYMM-XXXXXXXX`). `payment_events` is an append-only trail.
- **Development.** With no `PAYSTACK_SECRET_KEY` a test checkout page stands in for the gateway. It is refused in production.

## Notifications

| Event | Recipient | Channels |
|---|---|---|
| Booking requested (paid or free), confirmed, cancelled, rescheduled; reminders 24h and 1h before | the other party / both | in-app, email, push |
| New message (bursts coalesced into one) | the other participant | in-app, email, push |
| Payment successful, failed, refund started, refunded | payer | in-app, email, push |
| Service booking requested / updated | facility / patient | in-app, email, push |
| New approved summary available | patient | in-app, email, push |

- **Privacy by construction.** All text lives in `lib/notifications/events.ts`. Templates receive ids only, never names, amounts or clinical content, so email, push and lock-screen text is always generic ("You have a new message. Sign in to read it.") and links to the relevant page in the signed-in app (`/payments/<id>`, `/patient/appointments`, ...). A unit test guards against clinical terms and money in template text.
- **Preferences.** Profile page → Notifications: per category (appointments, messages, payments, results, prescriptions) switch pop-ups, email and push. Push is enabled per browser.
- **Delivery.** In-app notifications are always stored; email (Resend HTTP API) and push (Web Push/VAPID) run after the response is returned and never fail the request. Pop-ups appear while the app is open (30-second polling).
- **Reschedule.** `POST /api/appointments/[id]/reschedule`: doctors move an appointment and the patient is notified; a patient moving a confirmed appointment sends it back to the doctor for re-confirmation.

## Tests

Unit tests run with `npm test`. `src/lib/payments/flow.int.test.ts` exercises fees, payments, refunds, expiry, reminders and notification preferences against a real database; set `TEST_DATABASE_URL` to a disposable, migrated database to run it.
