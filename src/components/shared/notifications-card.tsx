"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { formatClinicDateTime } from "@/lib/format";

interface Item {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
}

export function NotificationsCard({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (items.length === 0) return null;

  const markRead = () =>
    startTransition(async () => {
      try {
        await apiClient.post("/notifications/read");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <Card className="beeline-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
        <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={markRead}>
          Mark all read
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className="text-sm">
            <p className="font-medium">{n.title}</p>
            {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
            <p className="text-xs text-muted-foreground">{formatClinicDateTime(n.createdAt)}</p>
          </div>
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
