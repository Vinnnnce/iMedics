"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser, useClerk } from "@clerk/nextjs";
import { User, Bell, Shield, Moon, Sun } from "lucide-react";

export default function ProfilePage() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const role = ((user?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile info */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-foreground" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-foreground/10 text-foreground font-bold text-xl">
              {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
              <p className="text-xs text-foreground mt-1 capitalize">{role.toLowerCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">Notifications</span>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg">Manage</Button>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">Privacy & Security</span>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg">Manage</Button>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full rounded-lg text-destructive border-destructive/30"
        onClick={() => signOut({ redirectUrl: "/auth/login" })}
      >
        Sign Out
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Medic1905 is a platform only, not a medical provider. AI content is informational.
      </p>
    </div>
  );
}
