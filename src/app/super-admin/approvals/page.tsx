import { ApprovalWorkflows } from "@/components/superadmin/approval-workflows";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "APPROVALS");
  return <ApprovalWorkflows />;
}
