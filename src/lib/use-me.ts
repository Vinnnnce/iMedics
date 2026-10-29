"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export interface MeFacility {
  id: string;
  name: string | null;
  kind: "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE";
  facilityRole: string;
  permissions: readonly string[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "BANNED";
  accountType: string | null;
  avatarUrl: string | null;
  facility: MeFacility | null;
  onboardingComplete: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
}

/**
 * The signed-in user's authoritative role and status, loaded from the server.
 * Use this for UI decisions (navigation, labels). It is never a security
 * boundary: every API route enforces access on the server.
 *
 * Re-fetches when the Clerk session changes (sign-in, sign-out) so the identity
 * never goes stale.
 */
export function useMe(): Me | null {
  const { user } = useUser();
  const clerkUserId = user?.id;
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => {
        if (active) setMe(data);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, [clerkUserId]);

  return me;
}
