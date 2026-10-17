import type { Metadata } from "next";
import { PublicFacilityDirectory } from "@/components/public/public-facility-directory";

export const metadata: Metadata = {
  title: "Find a hospital on Medic1905",
  description: "Verified hospitals on Medic1905 with transparent service prices, departments, consultants and online booking.",
};

export default async function HospitalsDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  return (
    <PublicFacilityDirectory
      directory="hospitals"
      typeLabel="Hospital"
      pluralLabel="Hospitals"
      searchPlaceholder="Search hospitals by name or city"
      q={q}
    />
  );
}
