"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { subscribeWithVapidKey } from "@/lib/notifications/browser-push";

const CATEGORIES = [
  ["APPOINTMENT", "Appointments and bookings"],
  ["MESSAGE", "Messages"],
  ["PAYMENT", "Payments and refunds"],
  ["LAB_RESULT", "Results"],
  ["PRESCRIPTION", "Prescriptions"],
] as const;
const CHANNELS = [
  ["IN_APP", "Pop-ups"],
  ["EMAIL", "Email"],
  ["PUSH", "Push"],
] as const;

type Matrix = Record<string, Record<string, boolean>>;

/** Choose how to be notified for each kind of update, and turn push on or off for this browser. */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Matrix | null>(null);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ preferences: Matrix; pushAvailable: boolean; vapidPublicKey: string | null }>("/notifications/preferences")
      .then(async (data) => {
        const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/sw.js") : undefined;
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        if (!active) return;
        setPrefs(data.preferences);
        setPushAvailable(data.pushAvailable);
        setVapidKey(data.vapidPublicKey);
        setSubscribed(Boolean(existing));
      })
      .catch(() => active && setError("Could not load your notification settings."));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (category: string, channel: string, enabled: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [category]: { ...prefs[category], [channel]: enabled } });
    try {
      await apiClient.put("/notifications/preferences", { [category]: { ...prefs[category], [channel]: enabled } });
    } catch {
      setPrefs(previous);
      setError("Could not save that change.");
    }
  };

  const enablePush = async () => {
    setBusy(true);
    setError("");
    try {
      if (!vapidKey) throw new Error("Push is not set up on this server.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications are blocked in this browser. Allow them in the site settings and try again.");
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub = await subscribeWithVapidKey(reg, vapidKey);
      await apiClient.post("/notifications/push-subscription", sub.toJSON());
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on push notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/push-subscription", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card" id="notifications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5" /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          For your privacy, emails and push alerts never include health details. They only tell you something happened and link you back here.
        </p>
        {!prefs && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {prefs && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Notify me about</th>
                  {CHANNELS.map(([key, label]) => (
                    <th key={key} className="pb-2 text-center font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(([category, label]) => (
                  <tr key={category} className="border-t border-border">
                    <td className="py-3 pr-2">{label}</td>
                    {CHANNELS.map(([channel, channelLabel]) => (
                      <td key={channel} className="py-3 text-center">
                        <Switch size="sm" aria-label={`${label}: ${channelLabel}`} checked={prefs[category]?.[channel] ?? true} onCheckedChange={(v) => toggle(category, channel, Boolean(v))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Push notifications on this device
            <span className="block text-xs text-muted-foreground">
              {!pushAvailable ? "Not enabled on this server yet." : !supported ? "This browser does not support push." : subscribed ? "On" : "Off"}
            </span>
          </p>
          {pushAvailable && supported && (
            <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={subscribed ? disablePush : enablePush}>
              {subscribed ? "Turn off" : "Turn on"}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
