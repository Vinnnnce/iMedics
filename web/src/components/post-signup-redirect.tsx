"use client";

import { useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function PostSignupRedirect() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      const role = (user.publicMetadata as Record<string, unknown>)?.role as string ||
        (user.unsafeMetadata as Record<string, unknown>)?.role as string;
      if (role) {
        // Role already set, go to role-specific dashboard
        switch (role) {
          case "DOCTOR":
            router.push("/doctor/dashboard");
            break;
          case "LAB_SCIENTIST":
            router.push("/lab/dashboard");
            break;
          default:
            router.push("/dashboard");
        }
      } else {
        // No role yet, go to role selection
        router.push("/onboarding/role-select");
      }
    }
  }, [user, isLoaded, router]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
