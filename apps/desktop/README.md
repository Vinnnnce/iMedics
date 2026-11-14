# Medic1905 Desktop App (Windows)

Tauri 2 shell around the Medic1905 web platform. Produces a 64-bit
`Medic1905-Simulator_<version>_x64-setup.exe` (NSIS installer, with MSI as
secondary target). The window loads the production platform; the local
`shared-www` boot screen covers first paint and offline states.

## Local development

```bash
npm install          # in apps/desktop
npm run tauri dev    # requires Rust toolchain
npm run tauri build  # produces the installer in src-tauri/target/release/bundle/
```

## CI

`.github/workflows/windows.yml` builds the signed installer on
`windows-latest`. Code signing uses the `WINDOWS_CSC_PFX` /
`WINDOWS_CSC_PASSWORD` secrets when present; otherwise the build is
unsigned and clearly labelled as such in the release notes.

Auto-update: the `updater` plugin checks
`/api/app-releases/updates/{{target}}/{{current_version}}` and installs
signed updates automatically once an updater keypair is configured
(`TAURI_UPDATER_KEY`/`TAURI_UPDATER_PUBKEY` secrets).
