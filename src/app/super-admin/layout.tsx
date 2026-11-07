import { ConsoleNav } from "@/components/superadmin/nav";
import { requirePageRole } from "@/lib/guards";
import { requireConsolePage } from "@/lib/superadmin/access";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("ADMIN");
  const access = await requireConsolePage(user);
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 px-4 lg:grid-cols-[15rem_minmax(0,1fr)] md:px-0">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <ConsoleNav allowedSections={access.sections} />
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
