"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-foreground">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-background" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Medic1905</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your care</p>
        </div>

        <div className="stat-card p-6">
          <SignIn
            appearance={{
              variables: {
                colorBackground: "transparent",
                colorPrimary: "var(--primary)",
                borderRadius: "0.5rem",
              },
              elements: {
                card: "bg-transparent border-0 shadow-none",
                headerTitle: "text-foreground",
                headerSubtitle: "text-muted-foreground",
                formButtonPrimary: "bg-foreground text-background font-semibold",
                socialButtonsBlockButton: "border border-border text-foreground bg-secondary",
                footerActionLink: "text-foreground",
                formFieldLabel: "text-foreground",
                formFieldInput: "bg-muted border-border text-foreground",
              },
            }}
            routing="path"
            path="/auth/login"
            signUpUrl="/auth/signup"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Medic1905 is a platform only, not a medical provider. AI content is informational, not medical advice.
        </p>
      </div>
    </div>
  );
}
