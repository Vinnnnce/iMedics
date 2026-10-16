"use client";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-center text-xs text-foreground">
    <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
    <span>You are offline. Information may be out of date. Reconnect before saving changes.</span>
  </div>;
}
