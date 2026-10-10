import { redirect } from "next/navigation";

// Account settings are managed on the profile page.
export default function SettingsPage() {
  redirect("/profile");
}
