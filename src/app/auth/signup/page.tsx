"use client";
import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/auth-layout";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return <AuthLayout title="Your connected care starts here" description="Create your secure sign-in, then choose your account type.">
    <div data-testid="card-signup" className="w-full min-w-0">
      <SignUp appearance={clerkAppearance} routing="hash" signInUrl="/auth/login" forceRedirectUrl="/auth/callback" />
    </div>
  </AuthLayout>;
}
