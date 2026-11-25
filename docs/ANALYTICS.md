# Healthcare Operations Intelligence

Performance analytics for hospitals, laboratories, diagnostic centres and pharmacies, plus a
doctor's own practice statistics. Everything is calculated from Medic1905's operational records;
nothing is duplicated into reporting tables.

Entry points: **Facility portal → Hospital System → Operations intelligence** (`/lab/analytics`) and
**Doctor portal → My performance** (`/doctor/performance`).

## Dashboards

| Dashboard | Route | Available to | Needs |
|---|---|---|---|
| Overview (executive) | `/lab/analytics/overview` | all facility kinds | `VIEW_ANALYTICS` |
| Command centre (live, refreshes every 60 s) | `/command-centre` | hospital | `VIEW_ANALYTICS` |
| Hospital operations: flow, admissions, discharges, transfers, length of stay, readmissions, bed map | `/hospital` | hospital | `VIEW_ANALYTICS` |
| Emergency department | `/emergency` | hospital | `VIEW_ANALYTICS` |
| Mortality & outcomes (denominators shown, small cells hidden) | `/mortality` | hospital | `VIEW_ANALYTICS` |
| Nursing performance | `/nursing` | hospital | `VIEW_ANALYTICS` |
| Clinical staff activity (alphabetical, never ranked) | `/doctors` | hospital, lab, diagnostic | `VIEW_ANALYTICS` |
| Laboratory | `/laboratory` | laboratory, hospital | `VIEW_ANALYTICS` |
| Diagnostic centre | `/diagnostic` | diagnostic centre, hospital | `VIEW_ANALYTICS` |
| Pharmacy | `/pharmacy` | pharmacy, hospital | `VIEW_ANALYTICS` |
| Departments | `/departments` | all | `VIEW_ANALYTICS` |
| Quality & safety, data completeness | `/quality` | all | `VIEW_ANALYTICS` |
| Financial | `/financial` | all | `VIEW_ANALYTICS` + `VIEW_REVENUE` |
| Forecasting (predictions and recommendations) | `/forecast` | all | `VIEW_ANALYTICS` |
| My performance (own activity only) | `/my-performance` | any staff member | active membership |
| Doctor's independent practice | `/doctor/performance` | verified doctors | doctor role |

Every dashboard has: period selector (today … last year, financial year, custom), comparison with the
previous equivalent period / same period last year / week, month or quarter over previous / custom baseline,
KPI cards with value, previous value, change, percentage change, trend line and target status, drill-down
to the underlying records, CSV / Excel / PDF export and print, a mobile filter drawer, and a collapsible
list of **indicators that cannot be shown because Medic1905 does not record the data** (see below).

## Calculation rules

* Periods are half-open `[start, end)` local-midnight intervals in the facility's time zone; the first day
  of the week and the financial-year start month are facility settings (`hospital_settings.week_starts_on`,
  `financial_year_start_month`). Quarters count from the financial-year start.
* Records are placed in a period by their **event date** (admission date, discharge date, collection time,
  verification time, payment time …), never by `updated_at`.
* A period still in progress is compared with the same number of elapsed days of the baseline.
* Missing is not zero: rates with no denominator and averages over no records are `null` ("no data").
  Every rate carries its numerator and denominator.
* Deaths, live discharges and inter-facility transfers are three separate figures. Inpatient mortality =
  deaths ÷ (live discharges + deaths) for the period; transfers out are excluded from the denominator.
  Pre-admission and ED-only deaths are not recorded and are not mixed in. Deaths are never attributed to an
  individual clinician. Age and diagnosis breakdowns hide groups with fewer than 5 cases.
* The full formula, numerator, denominator, source, event date, inclusions, exclusions and caveat of every
  metric are in `src/lib/analytics/registry.ts`, shown in the app under *Metric definitions*, and printed
  with every exported report.

## Database changes (`20261125090000_healthcare_operations_analytics`)

Additive only. No existing data is rewritten.

* `hospital_settings`: `week_starts_on` (default 1), `financial_year_start_month` (default 1).
* `analytics_performance_targets` — facility/department targets per metric.
* `analytics_snapshots` — disposable aggregate cache (no patient identifiers).
* `analytics_report_definitions` — saved/scheduled report templates.
* `analytics_generated_reports` — immutable generated report documents.
* Row-level security (same `app_facility_visible` policy as the clinical tables) on all four new tables.

The conceptual models in the brief that describe *derived* facts (admission events, mortality records, bed
occupancy snapshots, workload tables …) were deliberately **not** created: they would duplicate the operational
records, which remain the single source of truth. Audit uses the existing `audit_logs`.

## API

All under `withAuth`; facility comes from the verified membership, never from the request.

| Endpoint | Purpose |
|---|---|
| `GET /api/facility/analytics` | dashboards the caller may open, calendar, presets |
| `GET /api/facility/analytics/{dashboard}?preset&from&to&compare&compareFrom&compareTo` | dashboard payload |
| `GET /api/facility/analytics/drilldown?key&page&pageSize&identified` | records behind a figure (paginated; de-identified unless `identified=1` and permitted; audited) |
| `GET /api/facility/analytics/export?report&format=csv\|xlsx\|pdf` | export (rate-limited, audited; not for department-limited staff) |
| `GET /api/facility/analytics/metrics` | metric definition registry |
| `GET PUT DELETE /api/facility/analytics/targets` | targets (`MANAGE_HOSPITAL_SETTINGS` to change) |
| `GET POST /api/facility/analytics/reports`, `GET /reports/{id}?format=json\|csv\|xlsx\|pdf` | generate and keep reports |
| `GET POST DELETE /api/facility/analytics/definitions` | report templates and schedules |
| `GET /api/cron/analytics-reports` | daily job (header `x-cron-secret`): generates due scheduled reports, purges expired cache |
| `GET /api/doctors/me/performance` | a doctor's own practice statistics |

## Permissions and privacy

* Facility isolation by verified membership, plus database row-level security.
* `VIEW_ANALYTICS` for aggregate dashboards; `VIEW_REVENUE` for money; `MANAGE_INSURANCE` for claims.
* Organisation kind decides which dashboards exist (pharmacy sees no hospital mortality, etc.).
* `LIMITED` access staff see no aggregates (only *My performance*). `DEPARTMENT` staff, and department heads with
  assigned departments, see only department-filterable dashboards, filtered to their departments, and cannot export.
* Patient case numbers in drill-downs need `VIEW_PATIENT_DOCUMENTS` and a full-facility access level; each
  identified view is audited (`ANALYTICS_DRILLDOWN_IDENTIFIED`). Exports contain aggregates only.
* Export cells beginning with `= + - @` are neutralised against spreadsheet formula injection.
* Forecasts are statistical predictions labelled as such. They never diagnose, edit records or judge staff.

## Operations

* Apply the migration through your normal release process, then run `prisma generate`.
* Schedule `GET /api/cron/analytics-reports` daily with `x-cron-secret: $CRON_SECRET` (same scheduler as the other
  cron routes). Reports run at 06:00 facility time after the period closes, with the template creator's current
  rights; if those are lost the template is paused.
* Optional: set each hospital's week start and financial-year start in `hospital_settings`.

## Not implemented because the data is not recorded

Shown in-app per dashboard, never estimated: theatre/surgical analytics; discharge against medical advice;
risk-adjusted mortality and M&M reviews; cause of death (final diagnosis is used instead); ED time to treatment
and ED deaths; incidents, adverse events, falls, pressure injuries, infections, medication errors, complaints;
shift rosters, attendance and acuity; medication-administration timeliness; laboratory discipline sections,
EQA, nonconformities and reagent consumption; diagnostic slots/capacity, equipment utilisation, repeat
examinations and critical findings; pharmacy stock movement ledger, reorder levels, safety alerts, sales and
margin; invoices and claim amounts; supplier delivery dates; cross-facility organisation comparison.
Each needs new data capture first; the dashboards will pick them up once the data exists.

## Verification

* `npx vitest run src/lib/analytics` — 46 unit tests (periods incl. daylight saving, statistics, forecasting,
  registry, authorisation, exports) run anywhere.
* Integration tests (`*.int.test.ts`) run when `ANALYTICS_TEST_DATABASE_URL` points to a migrated disposable
  database whose name ends in `_test`. They seed a synthetic, de-identified dataset and check every expected value
  against figures worked out by hand, check facility isolation, department scoping, targets, caching,
  like-for-like comparison, that every dashboard executes for every facility kind, that every drill-down executes,
  and that every KPI is defined in the registry.
