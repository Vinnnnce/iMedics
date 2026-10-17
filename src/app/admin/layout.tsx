import { AdminNav } from "@/components/admin/admin-nav";
import { requirePageRole } from "@/lib/guards";
import { countPendingVerifications } from "@/lib/admin/overview";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("ADMIN");
  const pending = await countPendingVerifications();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[13rem_1fr] md:px-0">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <AdminNav pending={pending} />
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
