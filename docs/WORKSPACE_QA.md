# Workspace QA inventory

The new portal is additive. The synthetic preview and authenticated Next.js route use the same dashboard component, but the preview never calls production services.

## Coverage inventory

| Area | Functional check | Visual check |
|---|---|---|
| Four roles | Switch preview roles; check role-specific controls and headings | Desktop and 375px screenshots for each role |
| Navigation | Open every visible view; mobile menu open/close | No clipped content or page-level horizontal overflow |
| Patient overview | Open next appointment, timeline, metric and care reminder | Appointment and next steps visible without scrolling on desktop |
| Tasks | Add task; complete it; reopen it; invalid empty submission | Checkbox and checklist progress match state |
| Notifications | Open centre; mark unread items read | Bell badge clears; confirmation visible |
| Filters | Name and case-number search; status filter; no-match case | Useful empty state |
| Charts | Switch test, period and data disclosure | Desktop and mobile canvas; readable data table |
| Documents | Invalid file; valid file; share with consent; revoke | Filename wraps; access state visible |
| Intake | Required consent and fields; successful save | Confirmation shown in appointment card |
| Payments | Open receipt detail; open dispute form | Currency and status readable |
| Doctor | Template switch; edit/export draft; follow-up form | Clinical alerts and next-patient summary visible |
| Facility | Add resource; inspect staff/room assignment form | Bookings, services and workload visible |
| Admin | Subscription, refund, dispute forms; audit export | No clinical record navigation or message content |
| Intelligence | Import JSON form; invalid JSON; attendance explanation | Assistive-only labels visible |
| Themes | Toggle light/dark and back | Contrast, canvas and overlays in both themes |
| Modal accessibility | Keyboard focus contained; Escape closes | Overlay never clipped at 375px |
| Exports | Table CSV; spreadsheet formula escaping | Export contains current record data |
| Live authorization | Mocked route tests and data-scope inspection | No role switch in production component |

## Explicit exclusions

The browser preview is not evidence of a successful Clerk login, live Neon migration, S3 upload, real payment, email delivery, push subscription, scheduler deployment, or model call. Those require the repository operator's configured staging environment and must be exercised before production rollout.

Homepage conversion experiments cannot be activated without changing or integrating the existing homepage. Vendor wearable OAuth connections and a clinically validated predictive model are not implemented by the JSON import and transparent attendance heuristics.

## Final local results

- **Compilation:** Production Next.js build completed; TypeScript and targeted new-code ESLint checks passed.
- **Tests:** 81 passed, including 21 workspace tests. The 18 existing payment integration tests were skipped because their configured integration environment was absent.
- **Database:** Existing migration chain and all twelve extension tables applied successfully in PGlite. Ownership filtering, capacity constraints, wearable inserts, delivery leases and advisory locks were exercised.
- **Responsive screenshots:** Every visible role-specific navigation view was captured at 1440px and 375px. No page-level horizontal overflow was observed; wide tables have their own scroll containers.
- **Automated accessibility:** No WCAG A/AA violations were found by axe on the final four role overviews or the patient dark overview. This is a scoped automated result, not a comprehensive accessibility certification.
- **Keyboard:** Twelve consecutive Tab presses stayed inside the notification dialog after adding an explicit focus loop. Escape dismissed the dialog.
- **Additional interactions:** Doctor template switching, facility resource creation, admin subscription updates, audit CSV download, invalid wearable JSON rejection and successful wearable rendering were exercised.
- **Runtime:** No browser page errors were observed in the tested preview flows.
