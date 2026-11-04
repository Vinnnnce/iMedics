# Medic1905 experience system

This upgrade extends the existing brand and component system rather than replacing it. Authentication and onboarding use an inviting healthcare illustration, while clinical workspaces and legal reading prioritise restraint, predictable controls and legible information.

## Visual foundations

- Typography: existing Inter family and Tailwind sizing. Input text is at least 16px on authentication screens to avoid unwanted mobile zoom.
- Dark surfaces: background `#101112`, card `#191b1d`, popover `#202224`, muted/secondary `#242628`, border `#34383c`, sidebar `#141617`. Existing brand accents and semantic clinical warning colours remain.
- Light surfaces: existing white/light token set is preserved. The public homepage's scoped brand styles are not replaced.
- Authentication: a pale healthcare illustration beside a maximum-420px form at desktop widths; a separate single-column layout below 1024px. Mobile has a small pulse graphic rather than a shrunken desktop diagram.
- Legal reading: maximum-1120px document layout, narrow reading column, desktop sticky contents navigation, persistent readable text and a clear draft/version banner.
- Navigation: existing role-aware modules consolidated in the shared Navbar, with a Base UI/shadcn Sheet on mobile. Search and tour controls move into the profile menu on compact screens.

## Interaction and accessibility

- SVG connections animate using CSS only. Pause controls and reduced-motion rules apply; static SVG remains without animation.
- The tour is a non-modal, page-level portal. It must not inherit the navbar's backdrop-filter containing block. Its position leaves room for mobile bottom navigation.
- The mobile navigation drawer uses the existing accessible Sheet implementation for focus containment and Escape handling.
- Cookie choices do not obstruct sign-in after dismissal. Accept-all and reject-optional controls have equal visual weight; reopening is available in the page footer and policy reader.
- No patient records are included in tour examples. Navigation visibility is presentation, not an authorisation boundary.

## Verification boundaries

Component QA rendered the actual source components using synthetic user/API fixtures, real Clerk sign-in/sign-up UI, and the existing Inter family. Those captures are not proof of authenticated production sessions, completed real-account registration, verified provider configuration or every clinical dashboard's visual state.
