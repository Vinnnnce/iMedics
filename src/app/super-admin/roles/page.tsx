import { RoleBuilder } from "@/components/superadmin/role-builder";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "ROLES");
  return <RoleBuilder />;
}
