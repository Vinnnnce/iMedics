import { requirePageRole } from "@/lib/guards";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("PATIENT");
  return children;
}
