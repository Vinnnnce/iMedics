"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { safeNotificationHref } from "@/lib/notifications/safe-href";

interface Item {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  toast: boolean;
}

const POLL_MS = 30_000;

/**
 * The notification bell and pop-up alerts. Polls for new notifications while the tab is visible and shows a brief,
 * non-blocking toast for each one (unless the user turned pop-ups off for that category). Text is generic by design.
 */
export function NotificationCenter({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true, inFlight = false, initialized = false;
    let cursor: string | null = null, since: string | null = null;
    const refresh = async () => {
      if (!active || inFlight || !navigator.onLine || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const query = cursor ? `?after=${encodeURIComponent(cursor)}&limit=50`
          : since ? `?since=${encodeURIComponent(since)}&limit=50` : "?limit=1";
        const data = await apiClient.get<{
          unreadCount: number; notifications: Item[]; nextCursor: string | null; checkedAt: string;
        }>(`/notifications${query}`);
        if (!active) return;
        setUnread(data.unreadCount);
        setUnavailable(false);
        if (initialized) for (const n of data.notifications) {
          if (!n.toast) continue;
          toast(n.title, {
            id: n.id, description: n.body ?? undefined,
            action: n.href ? { label: "View", onClick: () => router.push(safeNotificationHref(n.href)) } : undefined,
          });
        }
        initialized = true;
        cursor = data.nextCursor;
        since = data.notifications.at(-1)?.createdAt ?? since ?? data.checkedAt;
      } catch (error) {
        // Recover when retention or another device removes the cursor anchor.
        if (error instanceof ApiError && error.status === 400 && cursor) cursor = null;
        if (active) setUnavailable(true);
      } finally { inFlight = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onRefresh = () => void refresh();
    document.addEventListener("visibilitychange", onRefresh);
    window.addEventListener("online", onRefresh);
    window.addEventListener("notifications-read", onRefresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onRefresh);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("notifications-read", onRefresh);
    };
  }, [enabled, router]);

  if (!enabled) return null;

  return (
    <>
      <Link href="/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted">
        <Bell className="h-5 w-5" />
        {unavailable && <span className="sr-only">Notification updates temporarily unavailable</span>}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </>
  );
}
