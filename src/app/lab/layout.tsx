import { requirePageRole } from "@/lib/guards";

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("LAB_SCIENTIST");
  return children;
}
