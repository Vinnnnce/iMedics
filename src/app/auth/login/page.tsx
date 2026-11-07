"use client";
import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/auth-layout";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function LoginPage() {
  return <AuthLayout title="Welcome back" description="Sign in to your connected healthcare workspace.">
    <div data-testid="card-signin" className="w-full min-w-0">
      <SignIn appearance={clerkAppearance} routing="hash" signUpUrl="/auth/signup" forceRedirectUrl="/auth/callback" />
    </div>
  </AuthLayout>;
}
