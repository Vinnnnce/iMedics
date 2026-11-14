-- Tauri updater signature (.sig file content for the Windows installer)
ALTER TABLE "app_releases" ADD COLUMN "update_signature" TEXT;
