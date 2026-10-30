# Isolated Emergency and Facility Website QA

This harness renders the real production components without requiring Clerk keys or a live database. Its facility, API responses and browser-local persistence are synthetic and must never be mistaken for a production save/publish verification.

## Build

Use the project's Node requirement (22.12 or later). Install dependencies and generate Prisma types, then run:

```sh
npm ci
npx prisma generate
node scripts/build-feature-audit.mjs
```

Serve `qa/feature-audit/dist` locally with a static server. Open `/?screen=emergency`, `/?screen=website`, or `/?screen=module&id=recognise-arrest`.

The following website query parameters exercise failure states: `mode=error`, `mode=forbidden`, `mode=loading`, `mode=save-error`. Drafts persist only in browser localStorage under `imedics.feature-audit.website`. Delete that synthetic key to test an empty facility layout.

## Browser audit performed

- Emergency and populated website editor/preview at 320, 375, 390, 430, 768, 1024 and 1440 px.
- Emergency search, BLS/ALS filtering, module navigation, checklist, quiz, completion and refresh persistence.
- Video keyboard activation, thumbnail error fallback, blocked iframe fallback, close-player cycle and external YouTube popup destination.
- Facility block add/edit, duplicate, move down, hide/show, remove, all four templates, add-ons, editable opening-hours rows and FAQ items.
- Facility draft save, successful feedback, refresh persistence, preview and publish with mocked API/localStorage.
- Error, forbidden, loading and failed-save UI states with no JavaScript page errors.

The real route tests at `src/app/api/facility/website/route.test.ts` exercise the real authorization helper and route handlers with mocked Prisma. They cover invited managers, lower-privilege staff, inactive users, legacy ownership, multiple facilities, cross-facility GET/PUT/POST/DELETE, validation, draft reload, publication and unpublication.

## Still requires a configured test environment

Sign in as a disposable facility owner and invited facility manager in the real application. Confirm the Our Website menu, edit/save/refresh, publish and inspect the actual public facility profile, then restore the test content. Repeat permission checks against a second real facility, and run the database-backed integration suites. No production facility data has been changed by this harness.
