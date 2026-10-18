"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { apiClient } from "@/lib/api-client";

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
  const { theme } = useTheme();
  const [unread, setUnread] = useState(0);
  // Newest notification time we have already seen; anything newer is "new" and gets a toast.
  const cursor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      // First load: newest rows first, only to seed the cursor. Polls: rows after the
      // cursor, oldest-first, so new notifications can be toasted in order.
      const query = cursor.current ? `?after=${encodeURIComponent(cursor.current)}&limit=10` : "?limit=10";
      const data = await apiClient.get<{ unread: number; notifications: Item[] }>(`/notifications${query}`);
      setUnread(data.unread);

      if (data.notifications.length > 0) {
        const firstLoad = !cursor.current;
        if (!firstLoad) {
          for (const n of data.notifications) {
            if (!n.toast) continue;
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.href ? { label: "View", onClick: () => router.push(n.href as string) } : undefined,
            });
          }
        }
        // First load is newest-first (cursor = newest); polls are oldest-first (cursor = newest new row).
        cursor.current = firstLoad
          ? data.notifications[0].id
          : data.notifications[data.notifications.length - 1].id;
      }
    } catch {
      /* offline or signed out: try again on the next tick */
    }
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  if (!enabled) return null;

  return (
    <>
      <Toaster position="top-right" theme={theme === "dark" ? "dark" : "light"} closeButton />
      <Link href="/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </>
  );
}
