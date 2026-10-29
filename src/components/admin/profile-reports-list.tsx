"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface Report {
  id: string;
  targetType: "DOCTOR" | "FACILITY";
  targetId: string;
  targetName: string;
  profileHref: string | null;
  reason: string;
  details: string | null;
  status: "OPEN" | "REVIEWED" | "DISMISSED";
  createdAt: string;
}

/** Admin list of reported profiles with one-click resolution. */
export function ProfileReportsList({ reports }: { reports: Report[] }) {
  const router = useRouter();

  const resolve = async (id: string, status: "REVIEWED" | "DISMISSED") => {
    try {
      await apiClient.patch("/admin/profile-reports", { id, status });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the report");
    }
  };

  if (reports.length === 0) return <p className="text-sm text-muted-foreground">No reports yet.</p>;

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <Card key={r.id} className="beeline-card">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {r.profileHref ? <Link href={r.profileHref} className="underline underline-offset-4">{r.targetName}</Link> : r.targetName}
                </p>
                <Badge variant="outline" className="rounded-lg text-xs">{r.targetType === "DOCTOR" ? "Doctor" : "Facility"}</Badge>
                <Badge variant={r.status === "OPEN" ? "secondary" : "outline"} className="rounded-lg text-xs">{r.status.toLowerCase()}</Badge>
              </div>
              <p className="text-sm">{r.reason}</p>
              {r.details && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{r.details}</p>}
              <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            {r.status === "OPEN" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve(r.id, "REVIEWED")}>Mark reviewed</Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r.id, "DISMISSED")}>Dismiss</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
