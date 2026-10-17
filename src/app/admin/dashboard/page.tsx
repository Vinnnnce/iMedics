import { redirect } from "next/navigation";

// The admin home moved to /admin. Kept so old links and bookmarks still work.
export default function LegacyAdminDashboard() {
  redirect("/admin");
}
