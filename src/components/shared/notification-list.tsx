"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { formatClinicDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unread = items.filter((n) => !n.readAt && !readIds.has(n.id));

  const markRead = async (ids?: string[]) => {
    await apiClient.post("/notifications/read", ids ? { ids } : undefined).catch(() => undefined);
    setReadIds((prev) => new Set([...prev, ...(ids ?? items.map((n) => n.id))]));
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => markRead()}>
            Mark all read
          </Button>
        </div>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">You are all caught up.</p>}
      {items.map((n) => {
        const isUnread = !n.readAt && !readIds.has(n.id);
        const inner = (
          <Card className={cn("beeline-card", isUnread && "border-foreground/40")}>
            <CardContent className="flex items-start gap-3 p-4">
              <Bell className={cn("mt-0.5 h-4 w-4 shrink-0", isUnread ? "text-foreground" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatClinicDateTime(n.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        );
        return n.href ? (
          <Link key={n.id} href={n.href} onClick={() => isUnread && markRead([n.id])} className="block">
            {inner}
          </Link>
        ) : (
          <div key={n.id}>{inner}</div>
        );
      })}
    </div>
  );
}
