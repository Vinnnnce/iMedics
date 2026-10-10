import { requirePageRole } from "@/lib/guards";

export default async function DoctorPatientsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("DOCTOR");
  return children;
}
