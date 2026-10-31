import type { Metadata } from "next";
import { PublicFacilityDirectory } from "@/components/public/public-facility-directory";

export const metadata: Metadata = {
  title: "Find a pharmacy on Medic1905",
  description: "Verified pharmacies on Medic1905 with transparent service prices and online ordering.",
};

export default async function PharmaciesDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  return (
    <PublicFacilityDirectory
      directory="pharmacies"
      typeLabel="Pharmacy"
      pluralLabel="Pharmacies"
      searchPlaceholder="Search pharmacies by name or city"
      q={q}
    />
  );
}
