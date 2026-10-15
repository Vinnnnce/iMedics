import { requirePageRole } from "@/lib/guards";
import { loadWorkspace } from "@/lib/workspace/data";
import { WorkspaceDashboard } from "@/components/workspace/dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your care workspace | iMedics", robots: { index: false, follow: false } };
export default async function WorkspacePage() {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN");
  return <WorkspaceDashboard initialData={await loadWorkspace(user)} />;
}
