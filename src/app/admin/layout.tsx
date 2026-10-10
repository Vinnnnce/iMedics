import { requirePageRole } from "@/lib/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("ADMIN");
  return children;
}
