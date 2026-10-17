import type { Metadata } from "next";
import { PublicFacilityDirectory } from "@/components/public/public-facility-directory";

export const metadata: Metadata = {
  title: "Find a laboratory on Medic1905",
  description: "Verified laboratories on Medic1905 with transparent service prices, departments, consultants and online booking.",
};

export default async function LaboratoriesDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  return (
    <PublicFacilityDirectory
      directory="laboratories"
      typeLabel="Laboratory"
      pluralLabel="Laboratories"
      searchPlaceholder="Search laboratories by name or city"
      q={q}
    />
  );
}
