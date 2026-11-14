# Medic1905 — Multi-Platform Distribution (Android · iOS · Windows · Web)

This document describes how the Medic1905 medical simulator is built and
distributed as native apps alongside the existing web platform, and how the
release pipeline works end to end.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  One backend: Next.js 16 on Vercel + Neon Postgres + Clerk      │
│  /api/sim/*      simulator engine (Prisma-backed)               │
│  /api/app-releases/*   public release metadata + download stats │
│  /api/admin/app-releases/*  release management (ADMIN only)     │
└─────────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
   Web (Next.js)      Capacitor shell       Tauri 2 shell
   /simulator/        (Android + iOS)       (Windows EXE/MSI)
```

- **Web simulator** — static client in `public/simulator/` calling
  `/api/sim/*` (ported from the original Express app to Next.js route
  handlers backed by Prisma/Neon). Same engine, same data.
- **Android / iOS** — `apps/mobile/` is a Capacitor project whose WebView
  loads the deployed web platform. App id `medic.simulator.m1905`.
  The bundled `www/` is only a PUBG-style boot screen + offline fallback.
- **Windows** — `apps/desktop/` is a Tauri 2 project (64-bit NSIS `.exe`
  installer + `.msi`) that opens the platform in a native window with
  tray icon, window-state persistence and auto-updates.
- All four surfaces share the **same authentication, backend, simulation
  engine and database**. No simulation data is duplicated or embedded.

## What lives where

| Path | Purpose |
|---|---|
| `simulator/` | Simulation engines + case data (CommonJS, also used by tooling) |
| `public/simulator/` | The web client (vanilla JS), patched to call `/api/sim/*` |
| `src/lib/simulator/router.ts` | The full simulator API (auth, cases, runs, theatre, instructor, admin) |
| `src/app/api/sim/[...path]/route.ts` | Mount point for the simulator API |
| `apps/mobile/` | Capacitor project (Android APK/AAB, iOS) |
| `apps/desktop/` | Tauri project (Windows installer) |
| `apps/shared-www/` | Shared native-app boot screen (PUBG-style) |
| `app-assets/` | Generated icon + splash sources (`scripts/generate-app-icons.py`) |
| `src/components/download/download-centre.tsx` | Homepage download centre (device detection, never auto-downloads) |
| `src/components/admin/release-manager.tsx` | Admin release console (publish, unpublish, stats) |
| `.github/workflows/` | CI/CD: `ci.yml` (web), `android.yml`, `ios.yml`, `windows.yml`, `release.yml` |

## Download centre

`/app/download` (and the homepage footer section **DOWNLOAD MEDIC1905
MEDICAL SIMULATOR**) shows three platform cards + an **OPEN WEB SIMULATOR**
link. The visitor's platform is highlighted as a recommendation, but all
three options are always shown and nothing ever downloads automatically.
Cards read live data from `GET /api/app-releases` (published, current
releases per platform: version, size, minimum OS, release date, notes).

iOS buttons point at the App Store / TestFlight URL stored on the release
record — never at a raw IPA. Until an App Store listing exists, the iOS
card links to TestFlight during beta and shows "coming to the App Store".

## Release management

- Admin console: **Admin → App releases** (`/admin/app-releases`).
  Create/edit releases, set version, minimum OS, release notes, file URL
  (object storage or GitHub Release asset), publish/unpublish, mark the
  current release per platform, and monitor download counts.
- Installation packages are **never stored in the database** — only
  metadata + counters. Files live in object storage (S3/R2) or as GitHub
  Release assets.
- CI sync: after a GitHub Release is published, `release.yml` POSTs the
  release + asset list to `POST /api/admin/app-releases/sync` with a
  `RELEASE_SYNC_TOKEN` bearer secret; the API upserts `AppRelease`
  records and flips `isCurrent`.

## CI/CD

- **`ci.yml`** — web platform: lint, typecheck, tests, migrations against
  a disposable Postgres service, production build. Runs on every push/PR.
- **`android.yml`** — builds signed release APK + AAB. Signing key comes
  from GitHub Secrets (base64 keystore). Without secrets it builds an
  unsigned release, clearly labelled as such.
- **`ios.yml`** — builds an Xcode archive; with Apple secrets configured
  it signs, exports an IPA and uploads to TestFlight via App Store Connect
  API. Without secrets it attaches the unsigned archive for manual signing.
- **`windows.yml`** — builds the Tauri NSIS `.exe` + `.msi`, generates
  SHA-256 checksums and the updater signature when a key is configured.
- **`release.yml`** — triggered by `v*.*.*` tags: runs all three platform
  builds, assembles one release with `SHA256SUMS.txt`, creates the GitHub
  Release, then syncs the download centre.

### Required GitHub Secrets

| Secret | Used by | Notes |
|---|---|---|
| `ANDROID_KEYSTORE` / `ANDROID_KEYSTORE_ALIAS` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_PASSWORD` | android.yml | base64-encoded keystore; generates signed APK/AAB |
| `APPLE_CERT_P12` / `APPLE_CERT_PASSWORD` / `APPLE_PROVISIONING_PROFILE` / `APPLE_TEAM_ID` | ios.yml | distribution certificate + profile |
| `APP_STORE_CONNECT_KEY_ID` / `APP_STORE_CONNECT_ISSUER_ID` / `APP_STORE_CONNECT_KEY` | ios.yml | TestFlight upload |
| `WINDOWS_CSC_PFX` / `WINDOWS_CSC_PASSWORD` | windows.yml | optional EXE code signing |
| `TAURI_UPDATER_KEY` / `TAURI_UPDATER_PUBKEY` | windows.yml | updater signing keypair (`npx tauri signer generate`) |
| `RELEASE_SYNC_TOKEN` | release.yml | shared bearer secret for the sync API |
| `APP_URL` (variable) | release.yml | production URL, e.g. `https://medic1905.vercel.app` |

> Signing keys and secrets are stored only as GitHub Actions secrets —
> never in source code.

## Local development

```bash
npm install
npx prisma migrate deploy && npx prisma generate
npm run sim:seed        # seed simulator reference data + demo users
npm run dev             # web platform on :3000
```

Demo simulator accounts (password `medic1905`): `student@medic1905.sim`,
`resident@medic1905.sim`, `surgeon@medic1905.sim`, `instructor@medic1905.sim`,
`admin@medic1905.sim` — one per supported role (medical student, resident,
specialist, surgeon, nursing, laboratory, diagnostic, pharmacy, instructor).

Native shells:

```bash
cd apps/mobile && npm install && npx cap add android && npx cap open android
cd apps/desktop && npm install && npm run tauri dev
```

## Deployment

1. **Web** — Vercel (repo → project, production branch `main`). Env vars:
   `DATABASE_URL`, `DIRECT_URL` (Neon), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`,
   `RELEASE_SYNC_TOKEN`.
2. **Migrations** — `npm run build` runs `prisma migrate deploy` on
   Vercel; the build never touches production data.
3. **Native apps** — push a `vX.Y.Z` tag; `release.yml` builds, signs and
   publishes everything, then the download centre updates automatically.
4. **Stores** — submit the AAB to Google Play and the signed IPA to
   App Store Connect/TestFlight from the release artifacts.

## Security notes

- Simulator sessions use hashed passwords (bcrypt) + bearer session
  tokens with expiry, stored in `sim_sessions`.
- Admin simulator routes and the release console require the platform's
  ADMIN role (`withAuth(["ADMIN"])`); the simulator's own instructor/admin
  roles are enforced inside the router.
- All traffic is HTTPS; the Capacitor config forbids cleartext and mixed
  content; iOS limits navigations to app-bound domains.
- The download redirect endpoint counts downloads and never streams files
  from the database.
- Simulator records (`sim_*` tables) stay strictly separated from real
  EMR patient records; the two never share tables or code paths.
