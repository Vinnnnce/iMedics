// Medic1905 desktop shell - a Tauri window over the production web
// platform (same backend, auth, simulation engine and database as web).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;
use tauri_plugin_updater::UpdaterExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Periodic auto-update check against the Medic1905 release API.
            // Updates are downloaded and installed only when they carry a
            // valid signature (updater pubkey configured in tauri.conf.json).
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    match handle.updater_builder().check().await {
                        Ok(Some(update)) => {
                            let _ = update.download_and_install().await;
                        }
                        _ => {}
                    }
                    tauri::async_runtime::sleep(Duration::from_secs(12 * 3600)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Medic1905 desktop shell");
}
