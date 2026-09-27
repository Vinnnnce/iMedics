"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-foreground">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-foreground-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join Medic1905 to manage your care</p>
        </div>

        <div className="beeline-card p-6">
          <SignUp
            appearance={{
              variables: {
                colorBackground: "transparent",
                colorPrimary: "var(--primary)",
                borderRadius: "0.75rem",
              },
              elements: {
                card: "bg-transparent border-0 shadow-none",
                headerTitle: "text-white",
                headerSubtitle: "text-gray-400",
                formButtonPrimary: "bg-foreground text-background font-bold",
                socialButtonsBlockButton: "border border-border text-white",
                footerActionLink: "text-foreground",
              },
            }}
            routing="path"
            path="/auth/signup"
            signInUrl="/auth/login"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          By signing up, you agree that Medic1905 is a platform only. Doctors remain responsible for clinical decisions.
        </p>
      </div>
    </div>
  );
}
