import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { ROLE_POLICY } from "@/lib/roles";
/** Keep old bookmarks working without a second design system or competing navigation shell. */
export default async function WorkspacePage() {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN");
  redirect(`${ROLE_POLICY[user.role].dashboard}#care-workspace`);
}
