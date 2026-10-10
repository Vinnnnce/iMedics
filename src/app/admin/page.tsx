import { redirect } from "next/navigation";

// Admins sign in through Clerk like everyone else; access is decided by role.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
