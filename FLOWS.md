# Main flows and upgrade acceptance

## Workforce and platform controls acceptance
- Preserve public home, authentication, registration, patient/doctor/facility dashboards and clinical workflows.
- Facility organisation: explicitly select a facility, create departments/subdepartments, assign leadership, create ranked positions, appoint staff and export the organisation chart.
- Workforce: invite by email, accept/reject with verified identity, resend/cancel, change status, and retain separate memberships across facilities.
- Permissions: show effective permission matrix, save overrides, reject cross-tenant department/manager IDs, revoke access immediately.
- Platform: explicitly provisioned super administrator with fresh MFA can version feature/document policies with confirmation and reason. Ordinary admins cannot change policies.
- Security: deny direct APIs when disabled, deny clinical privilege by rank alone, preserve signed records, atomic audit of new management mutations.
- Responsive checks: desktop and 375px drawer, forms, tables, errors, empty states and dark theme.
- Live authenticated flows require configured Clerk and PostgreSQL; do not simulate these as production evidence.

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
