import type { Metadata } from "next";
import { PublicFacilityDirectory } from "@/components/public/public-facility-directory";

export const metadata: Metadata = {
  title: "Find a diagnostic centre on Medic1905",
  description: "Verified diagnostic centres on Medic1905 with transparent prices for scans and imaging, and online booking.",
};

export default async function DiagnosticCentresDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  return (
    <PublicFacilityDirectory
      directory="diagnostic-centres"
      typeLabel="Diagnostic centre"
      pluralLabel="Diagnostic centres"
      searchPlaceholder="Search diagnostic centres by name or city"
      q={q}
    />
  );
}
