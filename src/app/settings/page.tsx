import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SettingsClient } from "@/components/settings/settings-client";

// Account settings: profile, appearance, notifications, security, organization
// and privacy — each section persists through the existing APIs.
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <SettingsClient
      initial={{
        name: user.name,
        phone: user.phone ?? "",
        language: user.language,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
