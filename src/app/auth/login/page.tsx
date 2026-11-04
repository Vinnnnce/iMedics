"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function LoginPage() {
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
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your care</p>
        </div>

        <div className="stat-card p-4 sm:p-6" data-testid="card-signin">
          <SignIn
            appearance={clerkAppearance}
            routing="hash"
            signUpUrl="/auth/signup"
            fallbackRedirectUrl="/"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Medic1905 is a platform only, not a medical provider. AI content is informational, not medical advice.
        </p>
      </div>
    </div>
  );
}
