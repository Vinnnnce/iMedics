"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "BANNED";
  accountType: string | null;
  onboardingComplete: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
}

/**
 * The signed-in user's authoritative role and status, loaded from the server.
 * Use this for UI decisions (navigation, labels). It is never a security
 * boundary: every API route enforces access on the server.
 */
export function useMe(): Me | null {
  const { userId, isLoaded } = useAuth();
  const [account, setAccount] = useState<{ clerkId: string; me: Me | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!isLoaded || !userId) return;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => {
        if (active) setAccount({ clerkId: userId, me: data });
      })
      .catch(() => {
        if (active) setAccount({ clerkId: userId, me: null });
      });
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  return userId && account?.clerkId === userId ? account.me : null;
}
