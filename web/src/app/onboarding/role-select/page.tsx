"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Heart, Stethoscope, FlaskConical } from "lucide-react";

const ROLES = [
  {
    value: "PATIENT",
    label: "Patient",
    desc: "Book consults, view results, manage your health",
    icon: Heart,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  {
    value: "DOCTOR",
    label: "Doctor",
    desc: "Review patients, write consultations, prescribe",
    icon: Stethoscope,
    color: "text-foreground",
    bgColor: "bg-foreground/10",
  },
  {
    value: "LAB_SCIENTIST",
    label: "Laboratory Staff",
    desc: "Manage lab orders, upload results, verify tests",
    icon: FlaskConical,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
];

export default function RoleSelectionPage() {
  const router = useRouter();
  const { user } = useUser();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedRole) return;
    setLoading(true);

    try {
      // Update Clerk public metadata with role
      await user?.update({
        unsafeMetadata: { role: selectedRole },
      });

      // Redirect to role-specific onboarding
      const route = selectedRole === "PATIENT"
        ? "/onboarding/patient"
        : selectedRole === "DOCTOR"
        ? "/onboarding/doctor"
        : "/onboarding/lab";

      router.push(route);
    } catch (error) {
      console.error("Failed to set role:", error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Choose Your Role</h1>
          <p className="text-sm text-muted-foreground mt-1">Select how you'll use Medic1905</p>
        </div>

        <div className="space-y-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`w-full text-left transition-all beeline-tile ${
                  isSelected
                    ? "border-2 border-primary bg-foreground/5"
                    : "border-2 border-border hover:border-primary/30"
                } rounded-lg p-4`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${role.bgColor}`}>
                    <Icon className={`h-6 w-6 ${role.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold">{role.label}</p>
                    <p className="text-sm text-muted-foreground">{role.desc}</p>
                  </div>
                  <div className={`h-6 w-6 rounded-full border-2 ${
                    isSelected ? "border-primary bg-foreground" : "border-border"
                  }`}>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" className="h-full w-full p-1 text-foreground-foreground" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          className="w-full mt-6 bg-foreground text-background hover:bg-foreground/90 rounded-lg h-12 text-base font-bold"
          disabled={!selectedRole || loading}
          onClick={handleContinue}
        >
          {loading ? "Setting up..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
