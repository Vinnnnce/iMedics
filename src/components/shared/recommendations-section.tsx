"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { RecommendationCategory } from "@/lib/recommendations";

/**
 * Personalized suggestions section for the dashboards.
 *
 * Shows the recommendation categories relevant to the signed-in account type
 * (patients see doctors and facilities, doctors see patients and facilities,
 * facilities see doctors, patients and the other facility types). Each
 * suggestion links to the profile or listing the viewer is authorized to open.
 */

type RecommendationsVariant = "patient" | "doctor" | "facility";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; categories: RecommendationCategory[] };

function RecommendationCardSkeleton() {
  return <div className="h-[72px] animate-pulse rounded-xl bg-muted" aria-hidden="true" />;
}

export function RecommendationsSection({ variant = "patient" }: { variant?: RecommendationsVariant }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const fetchRecommendations = useCallback(async (): Promise<State> => {
    try {
      const data = await apiClient.get<{ categories: RecommendationCategory[] }>(
        `/recommendations?context=${variant}`,
      );
      return { status: "ready", categories: data.categories ?? [] };
    } catch {
      return { status: "error" };
    }
  }, [variant]);

  useEffect(() => {
    let cancelled = false;
    void fetchRecommendations().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRecommendations]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void fetchRecommendations().then((next) => setState(next));
  }, [fetchRecommendations]);

  return (
    <section aria-labelledby="recommendations-heading" aria-busy={state.status === "loading"}>
      <h2 id="recommendations-heading" className="text-lg font-semibold tracking-tight">
        Recommended for you
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        People and services relevant to your account.
      </p>

      {state.status === "loading" && (
        <div className="space-y-6">
          <span className="sr-only">Loading suggestions</span>
          {Array.from({ length: 2 }).map((_, block) => (
            <div key={block} className="space-y-2">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <RecommendationCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <Card className="beeline-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground" role="alert">
              Could not load your suggestions right now.
            </p>
            <Button variant="outline" size="sm" onClick={retry}>
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && state.categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Suggestions will appear here once your account is set up.
        </p>
      )}

      {state.status === "ready" && state.categories.length > 0 && (
        <div className="space-y-6">
          {state.categories.map((category) => (
            <div key={category.key}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{category.label}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {category.items.length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground">
                    No {category.label.toLowerCase()} to suggest yet.
                  </p>
                )}
                {category.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="h-full beeline-card transition-colors group-hover:border-foreground/20">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                          )}
                        </div>
                        <ArrowRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
