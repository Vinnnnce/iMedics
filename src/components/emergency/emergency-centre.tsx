"use client";

import { useMemo, useState } from "react";
import { useStoredArray } from "@/hooks/use-stored-array";
import Link from "next/link";
import { Search, AlertTriangle, Clock, CheckCircle2, GraduationCap, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EMERGENCY_MODULES, EMERGENCY_BANNER, GUIDELINE_SOURCE, LAST_REVIEWED } from "@/lib/emergency/content";
import { EmergencyIllustration } from "@/components/emergency/illustrations";
import { EmergencyEducation } from "./emergency-education";

const PROGRESS_KEY = "medic1905.emergency.progress";

export function EmergencyCentre() {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<"ALL" | "BLS" | "ALS">("ALL");
  const [completed] = useStoredArray(PROGRESS_KEY);

  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EMERGENCY_MODULES.filter((m) => {
      if (track !== "ALL" && m.track !== track) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.steps.some((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
      );
    });
  }, [query, track]);

  const blsCount = EMERGENCY_MODULES.filter((m) => m.track === "BLS").length;
  const doneCount = completed.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Persistent emergency banner */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4" role="alert">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold text-foreground">{EMERGENCY_BANNER.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{EMERGENCY_BANNER.body}</p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Emergency Response and Life Support Learning Centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured education on adult basic life support (BLS) and an introduction to advanced life support (ALS).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sources: {GUIDELINE_SOURCE}. Last reviewed {LAST_REVIEWED}. This material is educational only and does not replace certified training or local protocols.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emergency topics (for example: AED, compressions, airway)"
            className="pl-9"
            aria-label="Search emergency topics"
          />
        </div>
        <Tabs className="min-w-0 max-w-full" value={track} onValueChange={(v) => setTrack(v as "ALL" | "BLS" | "ALS")}>
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger className="h-auto min-h-9 whitespace-normal" value="ALL">All</TabsTrigger>
            <TabsTrigger className="h-auto min-h-9 whitespace-normal" value="BLS">Basic life support</TabsTrigger>
            <TabsTrigger className="h-auto min-h-9 whitespace-normal" value="ALS">Advanced (professionals)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="beeline-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>
            You have completed {doneCount} of {EMERGENCY_MODULES.length} modules
          </span>
          <div className="ml-auto flex w-full max-w-full items-center gap-1 sm:w-auto" aria-hidden="true">
            {Array.from({ length: EMERGENCY_MODULES.length }).map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${completed.includes(EMERGENCY_MODULES[i].id) ? "bg-emerald-500" : "bg-muted"}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      <nav aria-label="Emergency education sections" className="flex flex-wrap gap-4 text-sm font-semibold text-primary underline">
        <a className="inline-flex min-h-11 items-center" href="#emergency-guides-title">Illustrated first-aid guides</a>
        <a className="inline-flex min-h-11 items-center" href="#emergency-videos-title">Educational videos</a>
      </nav>

      <div className="space-y-3">
        {modules.length === 0 && (
          <p className="text-sm text-muted-foreground">No modules match your search.</p>
        )}
        {modules.map((m) => (
          <Link key={m.id} href={`/emergency/${m.id}`} className="block">
            <Card className="beeline-card transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-4 p-4">
                {completed.includes(m.id) ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Completed" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    <Badge variant="outline" className="shrink-0 rounded-lg text-[10px]">{m.track === "BLS" ? "Basic life support" : "Advanced"}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.summary}</p>
                </div>
                <EmergencyIllustration
                  id={m.id}
                  className="h-12 w-12 shrink-0 text-muted-foreground sm:h-16 sm:w-16"
                />
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {m.minutes} min
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        BLS modules ({blsCount}) are suitable for everyone. ALS modules are intended for appropriately trained healthcare professionals.
        Advanced interventions, medications and rhythm-specific algorithms must never be attempted without certified training.
      </p>
      <EmergencyEducation />
    </div>
  );
}
