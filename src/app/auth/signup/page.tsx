"use client";

import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

const clerkAppearance = {
  variables: {
    colorBackground: "var(--card)",
    colorText: "var(--foreground)",
    colorTextSecondary: "var(--muted-foreground)",
    colorInputText: "var(--foreground)",
    colorInputBackground: "var(--muted)",
    colorInputBorderColor: "var(--border)",
    colorInputPlaceholder: "var(--muted-foreground)",
    colorPrimary: "var(--foreground)",
    colorPrimaryText: "var(--background)",
    colorDanger: "var(--destructive)",
    borderRadius: "0.5rem",
  },
  elements: {
    card: "bg-transparent border-0 shadow-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    formButtonPrimary: "bg-foreground text-background font-semibold hover:opacity-90",
    formFieldLabel: "text-foreground",
    formFieldInput: "bg-muted border-border text-foreground placeholder:text-muted-foreground",
    socialButtonsBlockButton: "border border-border text-foreground bg-secondary",
    socialButtonsBlockButtonText: "text-foreground",
    footerActionLink: "text-foreground underline",
    alternativeMethodsBlockButtonArrow: "text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    footer: "bg-transparent",
  },
};

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
