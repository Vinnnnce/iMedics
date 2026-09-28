"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Shield, Globe, Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    appointments: true,
    labResults: true,
    messages: true,
  });
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    shareData: false,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Simulate save delay
      await new Promise((r) => setTimeout(r, 800));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account preferences and configuration
        </p>
      </div>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" /> Account Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                defaultValue={user?.firstName || ""}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                defaultValue={user?.lastName || ""}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user?.emailAddresses?.[0]?.emailAddress || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" placeholder="+234 800 000 0000" />
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" /> Notifications
          </CardTitle>
          <CardDescription>Choose what you want to be notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { key: "email", label: "Email Notifications", desc: "Receive updates via email" },
            { key: "push", label: "Push Notifications", desc: "Get push alerts on your device" },
            { key: "sms", label: "SMS Notifications", desc: "Receive text message alerts" },
            { key: "appointments", label: "Appointment Reminders", desc: "Get reminded about upcoming appointments" },
            { key: "labResults", label: "Lab Results", desc: "Be notified when results are ready" },
            { key: "messages", label: "Messages", desc: "Get notified about new messages from doctors" },
          ].map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={notifications[item.key as keyof typeof notifications]}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, [item.key]: checked }))
                  }
                />
              </div>
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" /> Privacy & Security
          </CardTitle>
          <CardDescription>Control your data and visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Profile Visibility</p>
                <p className="text-xs text-muted-foreground">
                  Allow other users to see your profile
                </p>
              </div>
              <Switch
                checked={privacy.profileVisible}
                onCheckedChange={(checked) =>
                  setPrivacy((prev) => ({ ...prev, profileVisible: checked }))
                }
              />
            </div>
            <Separator />
          </div>
          <div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Share Health Data</p>
                <p className="text-xs text-muted-foreground">
                  Allow anonymized data to be used for research
                </p>
              </div>
              <Switch
                checked={privacy.shareData}
                onCheckedChange={(checked) =>
                  setPrivacy((prev) => ({ ...prev, shareData: checked }))
                }
              />
            </div>
            <Separator />
          </div>
        </CardContent>
      </Card>

      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5" /> Language & Region
          </CardTitle>
          <CardDescription>Set your preferred language and region</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-foreground"
              defaultValue="en"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ha">Hausa</option>
              <option value="yo">Yorùbá</option>
              <option value="ig">Igbo</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-foreground"
              defaultValue="Africa/Lagos"
            >
              <option value="Africa/Lagos">West Africa Time (WAT)</option>
              <option value="UTC">Coordinated Universal Time (UTC)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Settings saved successfully
          </p>
        )}
      </div>
    </div>
  );
}
