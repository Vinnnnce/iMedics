# I-Medics audit checks

## Medic1905-update HIS acceptance checks
- Preserve the current homepage, emergency education, public directories and authentication entry points.
- Hospital templates: adopt/customize, save draft, submit, independently approve, publish and create a new version; concurrent saves must not mutate a submitted/published version.
- Locked fields cannot be hidden behind new conditions, have their validation weakened, or lose mandatory signature roles through alternatives.
- Document workflow: save, submit, independent review/signature, finalize, release, PDF and amendment. Required patient-linked image/attachment references must resolve within the same hospital and patient.
- Protected records must be excluded from unauthorized worklists, portfolios, media lists and package exports as well as direct reads and workflow actions.
- Uploads: only an explicit CLEAN scanner result is clean; scanner failures and corrupt bytes must not leave an accessible final object.
- Draft edits made during an in-flight save must remain dirty; save/submit and autosave must not race.
- Run unit/API regressions, Prisma validation, lint, typecheck and a migration-free production build. Authenticated browser journeys require configured Clerk, Postgres, storage and synthetic test accounts; do not claim them verified from mocks.

## Baseline and merge
- Production homepage and emergency centre opened in cloud browser before edits.
- Audit branch is an ancestor of main: no merge needed.
- Preserve existing branding, BLS/ALS filtering, search, quizzes, checklists and progress.

## Emergency
- Open /emergency, search AED, filter BLS and ALS, open a module, read steps, answer quiz, complete and reopen.
- Requested delta: nine illustrated topics, sourced first-aid instructions, exact safety notice and verified educational videos.
- Check video thumbnail failure, click-to-load iframe, close player, permanent external fallback, keyboard access.
- At 320, 375, 390, 430, 768, 1024, 1440 widths check overflow, labels, illustration/video sizing and navigation; include landscape.

## Facility website
- Facility dashboard > Our Website must open the existing builder for the selected facility.
- Check loading, forbidden, missing facility, failed load with retry, empty layout.
- Apply templates, add/select/edit/reorder/hide/duplicate/remove sections, toggle add-ons, preview.
- Save, success confirmation, refresh persistence, publish saved layout, open correct public profile.
- API must reject unauthenticated, inactive, unprivileged and cross-facility callers.
- Editing during save must remain dirty; publishing must not race a save.
- Test preview uses actual facility identity, directory and slug, not placeholder routes.

## Regression and environment limits
- Check homepage, login/signup entry pages, carousel, banners, dashboard links, facility/profile/document route guards.
- Full authenticated journeys require test accounts and real Clerk/database configuration. Mocked tests are not production verification.
- Run lint, typecheck, automated tests, Prisma validation and CI-style build without deployment migrations.
- Deploy only through the existing authorized GitHub/Vercel workflow; verify production after deployment.
- On an anonymous production visit, protected sidebar/header/bottom links must not issue speculative RSC requests redirected to Clerk's external sign-in domain. Inspect console errors as well as JavaScript page errors; clicking a protected route must still initiate sign-in.
