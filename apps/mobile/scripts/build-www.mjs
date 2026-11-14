// Copies the shared web shell (PUBG-style loading screen + WebView bootstrap)
// into apps/mobile/www so Capacitor can bundle it. The app itself loads the
// production web platform; this page is the offline / first-paint fallback.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("www", { recursive: true });
cpSync(new URL("../shared-www/", import.meta.url), "www/", { recursive: true });
console.log("www/ prepared");
