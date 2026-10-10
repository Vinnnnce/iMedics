"use client";

import { useEffect, useState } from "react";

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
  }, []);

  return me;
}
