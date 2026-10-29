# Platform upgrade v2

## Apply
1. `npm install`
2. `npx prisma migrate deploy` (migrations `20261027000000_platform_upgrade_v2` and `20261028000000_profile_reports`, both additive only) then `npx prisma generate`
3. Optional: set `NEXT_PUBLIC_FEATURE_NEWS_PODCAST=true` to switch the public news and podcast pages on. Until then they show "coming soon"; admins can already prepare content at `/admin/news`.

## What changed
- **Navigation**: the root layout resolves the signed-in user on the server (`lib/me.ts`) and passes it to `MeProvider` (`lib/use-me.tsx`), so the menu is correct on first paint. Admin, doctor, patient and each facility type get only their own links, search chips and suggestions. Admin links live in `components/admin/admin-links.ts`.
- **Speed**: cached homepage data (`lib/home/home-data.ts`, 5 minutes, refreshed when ads change), caps on growth-prone list queries, route-level loading skeletons, new indexes.
- **Landing page**: ads have image, link, schedule and order; ratings are shown separately for doctors, hospitals, laboratories and diagnostic centres; news and podcast teasers.
- **Consultation reports**: drafts are editable and can be finalized; a finalized report can only be amended (reason required, previous version kept as a numbered revision, patient notified); PDF download for doctors and patients.
- **Facility documents**: patients can share a document with a whole facility; facility staff with VIEW_PATIENT_DOCUMENTS see documents their facility issued and documents shared with it (paginated, filterable). `findAccessibleDocument` now also resolves facility staff whose platform role is PATIENT.
- **Doctor profile**: photo, rating breakdown, public portfolio, share and CV buttons; any signed-in account can open it.
- **News and podcasts**: models, admin management, public pages (feature flagged).

## Added in the follow-up
- **Image uploads**: admins can upload PNG/JPG/WEBP images (5 MB) for ads, news covers and podcast covers (`components/admin/image-upload-field.tsx`). Same secure flow as profile photos (`lib/site-media.ts`): staging upload, server-side byte check, server-side copy to a final key; `/api/site-media/...` only serves images attached to content. Pasting an https URL still works.
- **Select labels**: the shared `Select` now shows an option's label, not its internal value. This fixes the long patient ID shown in the patient picker (and the raw enum values in other dropdowns).
- **Doctor directory**: specialty, minimum rating, maximum fee and sort filters, plus pagination. Open to all signed-in accounts.
- **Profile completeness**: a checklist card on the doctor and facility dashboards (`lib/profile-completeness.ts`).
- **Report a profile**: a button on doctor and facility public profiles, stored in `profile_reports`, reviewed at `/admin/profile-reports`.

## Recommended next steps (not built)
- Error monitoring (e.g. Sentry) and uptime checks; verify the Neon region matches the hosting region.
- Patient data-export request and a consent log view for document sharing.
- Audio upload for podcast episodes (currently an https URL) and cleanup of replaced images in storage.
- Global search across doctors and facilities in the top bar.
