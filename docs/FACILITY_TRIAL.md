# Free launch period and facility subscriptions

## How it works

- Every facility (hospital, laboratory, diagnostic centre, pharmacy) gets a **free trial the moment an admin verifies it**. The trial lasts 30 days (`FACILITY_TRIAL_DAYS`). During the trial everything is available.
- Optional launch promotion: set `LAUNCH_FREE_UNTIL=YYYY-MM-DD` and no trial ends before that date. A trial never gets shorter because of it.
- Facilities see a banner from 14 days before the end, an email/in-app notice at 14, 7 and 1 days, and a **Subscription** page where the owner can choose a plan.
- After a trial or paid period ends there is a **7-day grace period** (`FACILITY_GRACE_DAYS`) with full access. After that the facility is **read-only for new records**:
  - Always available: viewing every record, exporting a patient's records package, billing, and patient-safety work (critical results, emergency care, nursing, medication administration and dispensing, break-glass access).
  - Blocked with a clear message (HTTP 402): creating new documents, registrations, encounters, staff, services, settings and similar.
  - Nothing is ever deleted or hidden.
- **Nobody is restricted until a plan with confirmed pricing exists.** If you launch with no facility plans on sale, trials simply keep running ("free until plans are announced"). Restrictions switch on only when you confirm the first plan.

## Launch checklist

1. Set `FACILITY_TRIAL_DAYS` (and optionally `LAUNCH_FREE_UNTIL`) and make sure the daily job `GET /api/cron/subscriptions` is scheduled with `CRON_SECRET`. It ends trials, sends notices and creates missing trials.
2. Apply migration `20261113150000_facility_subscriptions`. Facilities already verified get a trial when the daily job first runs.
3. Before the first trial ends, create your plans as an admin (`POST /api/admin/facility-plans`: code, name, monthlyPrice, currency, `pricingConfirmed`). Set `pricingConfirmed: true` only when the price is final: that is the deliberate switch that turns restrictions on and makes the plan purchasable. Payments use the same gateway flow as doctor plans.
4. Support can extend a trial for a facility with `PATCH /api/admin/facility-subscriptions` (`facilityId`, `days` or `until`, and a reason of at least 10 characters). It is audited and can never shorten a trial. `GET` on the same route lists every facility's state, soonest trial end first.

## Things to know

- Plans are monthly and renewed by the facility each month (the owner is reminded 7 days before). There is no automatic card charge yet.
- A facility's paid period starts when the payment succeeds. Unused trial days are not added on top.
- A charge only applies if the person who paid belongs to the facility it names.
- Restrictions apply to API writes. Server-rendered pages never block reading.

## How it is tested

`src/lib/facility-subscriptions.test.ts` (rules, dates, always-allowed paths) and `src/lib/facility-subscriptions.int.test.ts` (real database and real route handlers): trial start, daily job, notices once, write guard returning 402 while reads and export keep working, other facilities unaffected, purchase refused for non-owners and unconfirmed plans, a payment applied exactly once under concurrent replays, renewal from the period end, outsiders' payments ignored, cancellation, and trial extension.
