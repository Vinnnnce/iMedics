# Medic1905 Mobile App (Android / iOS)

Capacitor shell around the Medic1905 web platform (same backend, auth,
simulation engine and database as the web simulator).

## Local development

```bash
npm install
npx cap add android   # once
npx cap add ios       # once, on macOS with Xcode
npx cap sync
npx cap open android  # or: npx cap open ios
```

## What CI builds (see .github/workflows/mobile.yml)

- **Android**: signed release `apk` + `aab` (key material comes from GitHub
  Secrets `ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_ALIAS`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`).
- **iOS**: unsigned Xcode archive / ad-hoc IPA for TestFlight — signing and
  upload require an Apple Developer account configured via Secrets
  (`APPLE_CERT_P12`, `APPLE_CERT_PASSWORD`, `APPLE_PROVISIONING_PROFILE`,
  `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY`). Until those exist, CI produces the archive and
  attaches it to the workflow run for manual signing.

The app id is `medic.simulator.m1905` (set in `capacitor.config.ts`).
