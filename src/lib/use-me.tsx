"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import type { Me } from "@/lib/me-types";

export type { Me, MeFacility } from "@/lib/me-types";

const MeContext = createContext<Me | null>(null);

/**
 * Provides the signed-in user's authoritative identity to the whole app.
 *
 * The root layout resolves it on the server and passes it as `initialMe`, so
 * the navigation renders with the correct role on the first paint, with no
 * client-side fetch waterfall and no flash of another role's links. A fresh
 * server render (navigation, router.refresh) simply passes a new `initialMe`.
 *
 * The identity is derived during render rather than copied into state by an
 * effect: signed out on the client means no identity, the server value is used
 * when present, and /api/me is only fetched when the server had none but a
 * Clerk session exists (a client-side sign-in without a full page load).
 */
export function MeProvider({ initialMe, children }: { initialMe: Me | null; children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const clerkUserId = user?.id;
  const [fetched, setFetched] = useState<{ forUser: string; me: Me | null } | null>(null);

  useEffect(() => {
    if (!isLoaded || !clerkUserId || initialMe) return;
    let active = true;
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => {
        if (active) setFetched({ forUser: clerkUserId, me: data });
      })
      .catch(() => {
        if (active) setFetched({ forUser: clerkUserId, me: null });
      });
    return () => {
      active = false;
    };
  }, [clerkUserId, isLoaded, initialMe]);

  const me: Me | null =
    isLoaded && !clerkUserId
      ? null
      : (initialMe ?? (fetched && fetched.forUser === clerkUserId ? fetched.me : null));

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/**
 * The signed-in user's authoritative role and status. Use this for UI
 * decisions (navigation, labels). It is never a security boundary: every API
 * route enforces access on the server.
 */
export function useMe(): Me | null {
  return useContext(MeContext);
}