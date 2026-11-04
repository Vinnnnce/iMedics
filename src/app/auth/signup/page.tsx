"use client";

import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* Medic1905 logo on a white chip so the blue wordmark stays legible in dark mode */}
          <Image
            src="/medic1905-logo.png"
            alt="Medic1905"
            width={465}
            height={180}
            priority
            className="mx-auto mb-3 h-14 w-auto rounded-xl bg-white p-2 shadow-sm"
          />
          <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join Medic1905 to manage your care</p>
        </div>

        <div className="stat-card p-4 sm:p-6" data-testid="card-signup">
          <SignUp
            appearance={clerkAppearance}
            routing="hash"
            signInUrl="/auth/login"
            fallbackRedirectUrl="/"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          By signing up, you agree that Medic1905 is a platform only. Doctors remain responsible for clinical decisions.
        </p>
      </div>
    </div>
  );
}
