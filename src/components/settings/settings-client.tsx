"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import {
  BellRing, Building2, ChevronRight, Globe, Moon, Palette,
  ShieldCheck, Sun, User as UserIcon, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { useMe, type MeFacility } from "@/lib/use-me";
import { apiClient } from "@/lib/api-client";

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";
const LANGUAGES = [["en", "English"], ["fr", "Français"], ["es", "Español"], ["ru", "Русский"]] as const;
const KIND_LABEL: Record<MeFacility["kind"], string> = {
  HOSPITAL: "Hospital", LABORATORY: "Laboratory", DIAGNOSTIC_CENTRE: "Diagnostic centre",
};

interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: readonly Section[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "security", label: "Account & security", icon: ShieldCheck },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "privacy", label: "Privacy", icon: Globe },
];

interface SettingsInitial {
  name: string;
  phone: string;
  language: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

/**
 * Settings: every control persists through the existing APIs — profile via
 * PATCH /api/me, the profile picture via the presign + confirm flow, the
 * theme via the theme provider (localStorage) and notifications via the
 * preferences API. Sections without permission for the caller's role are
 * simply not rendered.
 */
export function SettingsClient({ initial }: { initial: SettingsInitial }) {
  const me = useMe();
  const { openUserProfile } = useClerk();

  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone,
    language: initial.language,
  });
  const [saved, setSaved] = useState({
    name: initial.name,
    phone: initial.phone,
    language: initial.language,
  });
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const dirty = form.name !== saved.name || form.phone !== saved.phone || form.language !== saved.language;

  // Warn before leaving with unsaved profile edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveProfile = async () => {
    if (!form.name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch("/me", {
        name: form.name,
        phone: form.phone.trim() || null,
        language: form.language,
      });
      setSaved({ ...form });
      toast.success("Profile saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const resetProfile = () => {
    setForm({ ...saved });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAvatar = async (file: File) => {
    setUploadingImage(true);
    try {
      const presign = await apiClient.post<{ key: string; uploadUrl: string; headers: Record<string, string> }>(
        "/me/profile-image",
        { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      );
      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      const confirmed = await apiClient.post<{ url: string }>("/me/profile-image/confirm", { key: presign.key });
      setAvatarUrl(confirmed.url);
      toast.success("Profile picture updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that image.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const facility = me?.facility ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, appearance, notifications and account.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        {/* Section navigation: stacked chips on mobile, sticky list on desktop. */}
        <nav aria-label="Settings sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:sticky md:top-20 md:mx-0 md:flex-col md:overflow-visible md:px-0">
          {SECTIONS.filter((s) => s.id !== "organization" || facility || me?.role === "DOCTOR").map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {/* Profile */}
          <Card id="profile" className="beeline-card scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="h-5 w-5" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- account avatar from the profile-image API
                  <img
                    src={avatarUrl}
                    alt="Your profile picture"
                    className="h-16 w-16 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-bold text-foreground">
                    {initial.name.trim().charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <div className="space-y-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAvatar(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? "Uploading…" : "Change picture"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG or WEBP, up to 5MB.</p>
                </div>
              </div>

              <label className="block text-xs text-muted-foreground">Email
                <input className={`${field} mt-1 bg-muted`} value={initial.email} disabled />
              </label>
              <label className="block text-xs text-muted-foreground">Name
                <input
                  className={`${field} mt-1`}
                  value={form.name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block text-xs text-muted-foreground">Phone
                <input
                  className={`${field} mt-1`}
                  value={form.phone}
                  maxLength={30}
                  inputMode="tel"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="block text-xs text-muted-foreground">Preferred language
                <select
                  className={`${field} mt-1`}
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  {LANGUAGES.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Used for your result reports and account communications.
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="rounded-lg bg-foreground text-background"
                  disabled={saving || !dirty || !form.name.trim()}
                  onClick={saveProfile}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  disabled={!dirty || saving}
                  onClick={resetProfile}
                >
                  Discard changes
                </Button>
                {dirty && <p className="text-xs text-muted-foreground">You have unsaved changes.</p>}
              </div>
            </CardContent>
          </Card>

          <AppearanceSection />

          <div id="notifications" className="scroll-mt-20">
            <NotificationPreferences />
          </div>

          {/* Account & security */}
          <Card id="security" className="beeline-card scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" /> Account & security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  Password, email address and two-factor settings
                  <span className="block text-xs text-muted-foreground">
                    Managed securely by the authentication provider.
                  </span>
                </p>
                <Button
                  variant="outline"
                  className="shrink-0 rounded-lg"
                  onClick={() => openUserProfile()}
                >
                  Manage account
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <SignOutButton />
              </div>
            </CardContent>
          </Card>

          {/* Organization — facility staff and doctors only. */}
          {(facility || me?.role === "DOCTOR") && (
            <Card id="organization" className="beeline-card scroll-mt-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" /> Organization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {facility ? (
                  <>
                    <p className="text-sm">
                      {facility.name || "Your facility"}{" "}
                      <Badge variant="secondary" className="rounded-lg">{KIND_LABEL[facility.kind]}</Badge>{" "}
                      <Badge variant="outline" className="rounded-lg">{facility.facilityRole}</Badge>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { href: "/lab/website", label: "Facility profile & website" },
                        { href: "/lab/staff", label: "Staff & roles" },
                        { href: "/lab/credentials", label: "Staff credentials" },
                        { href: "/lab/services", label: "Services & prices" },
                      ].map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                        >
                          {link.label}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Each page enforces your role and facility membership on the server.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm">Your professional profile and services.</p>
                    <Link href="/doctor/profile" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
                      Open doctor profile
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Privacy */}
          <Card id="privacy" className="beeline-card scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5" /> Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { href: "/legal/privacy", label: "Privacy policy" },
                  { href: "/legal/terms", label: "Terms of service" },
                  { href: "/legal/cookies", label: "Cookie policy" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Medical records are retained as required by law and cannot be deleted
                from these settings. For a copy of your data, contact support from
                your registered email address.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Appearance: light, dark or system — applied instantly and persisted. */
function AppearanceSection() {
  const { preference, setThemePreference } = useTheme();

  const options: { value: ThemePreference; label: string; description: string; icon: LucideIcon }[] = [
    { value: "light", label: "Light", description: "Bright surfaces for daytime use.", icon: Sun },
    { value: "dark", label: "Dark", description: "Low-light surfaces, easier at night.", icon: Moon },
    { value: "system", label: "System", description: "Follow your device's colour scheme.", icon: Palette },
  ];

  return (
    <Card id="appearance" className="beeline-card scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5" /> Appearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid gap-3 sm:grid-cols-3"
        >
          {options.map((option) => {
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemePreference(option.value)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? "border-foreground/40 bg-accent"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <option.icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
