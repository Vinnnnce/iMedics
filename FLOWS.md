# Main flows and upgrade acceptance

## Baseline inspected
- Public homepage: existing directory/service links, theme switch, signup/login and legal footer.
- Authentication: Clerk SignIn/SignUp embedded forms; hash routing; provider owns passwords, recovery, verification and sessions.
- Registration: authenticated callback wizard, six account types, server registration, private credential uploads and admin verification.
- Dashboards: patient, doctor, facility and admin navigation; existing server guards and facility permissions.
- Legal: public routes currently render old templates while newer account-aware content is unused.

## Regression checks
- Public homepage still renders and directory/service links remain unchanged.
- Login/signup retain Clerk components, recovery, social authentication and provider security; no alternate identity database.
- At 320, 375, 390, 768 and 1440 px, form containers stay centered without horizontal overflow. Landscape and reduced motion remain usable.
- Registration keeps all six account types and professional review gates, does not require optional cookies, and does not solicit health history.
- Public policy routes show one shared document with audience selection, draft status, version metadata, contents and working cookie settings.
- Cookie controls: accept all, reject optional, customize, save, reopen and withdraw; defaults deny optional processing.
- Tour: automatic first authenticated-ready onboarding, next/previous/skip/finish/restart, permission-filtered steps and server-scoped progress. Public tour is separately available.
- Navbar: search, actual notifications, theme, profile, sign out, accessible mobile drawer and current page title.
- APIs: no user ID accepted from client for tour/acceptance; same-origin writes and authentication retained.

## External checks requiring staging credentials
- Clerk signup/login, email delivery, MFA, password recovery, session revocation.
- Migrated PostgreSQL registration, audit acceptance history and tour round trips.
- Verified patient/doctor/facility dashboard access and real notification data.
- Production deployment and authenticated device/browser coverage.
