"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useMe } from "@/lib/use-me";

interface State { phase: string; canWrite: boolean; daysLeft: number | null }

/** Tells facility staff when a free trial or plan is about to end, or has. Silent otherwise. */
export function SubscriptionBanner() {
  const me = useMe();
  const pathname = usePathname();
  const [state, setState] = useState<State | null>(null);
  const hasFacility = Boolean(me?.facility);

  useEffect(() => {
    if (!hasFacility) return;
    let cancelled = false;
    apiClient.get<{ state: State }>("/facility/subscription").then((r) => { if (!cancelled) setState(r.state); }).catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
  }, [hasFacility, pathname]);

  if (!hasFacility || !state || pathname === "/lab/subscription") return null;
  const { phase, daysLeft } = state;
  let message: string | null = null;
  let urgent = false;
  if (phase === "TRIAL" && daysLeft !== null && daysLeft <= 14) message = daysLeft <= 1 ? "Your free trial ends tomorrow." : `Your free trial ends in ${daysLeft} days.`;
  else if (phase === "PAID" && daysLeft !== null && daysLeft <= 7) message = `Your plan renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
  else if (phase === "GRACE") { message = `Your plan has ended. You have ${daysLeft ?? 0} more day${daysLeft === 1 ? "" : "s"} before new records are blocked.`; urgent = true; }
  else if (phase === "READ_ONLY") { message = "Your plan has ended. Existing records stay available, but new records cannot be created until you choose a plan."; urgent = true; }
  if (!message) return null;

  const Icon = urgent ? AlertTriangle : Info;
  return (
    <div role={urgent ? "alert" : "status"} className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${urgent ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/50"}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <Link href="/lab/subscription" className="font-semibold underline underline-offset-4">View plans</Link>
    </div>
  );
}
