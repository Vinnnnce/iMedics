import { FacilityPortfolio, generatePortfolioMetadata } from "@/components/public/facility-portfolio";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return generatePortfolioMetadata({ directory: "pharmacies" as const, slug });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FacilityPortfolio directory="pharmacies" slug={slug} />;
}
