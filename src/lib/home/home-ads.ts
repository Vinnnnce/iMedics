import { prisma } from "@/lib/prisma";
import type { ImedicsHomeAd } from "@/components/home/imedics-homepage";

export interface HomepageAds {
  /** Active HOMEPAGE_CAROUSEL ads; empty means the built-in slides are used. */
  carouselAds: ImedicsHomeAd[];
  /** The active HOMEPAGE_BANNER ad; null means the built-in default is used. */
  bannerAd: ImedicsHomeAd | null;
}

/**
 * Homepage ad slots. Ads are plain promotional content managed in the admin
 * content manager; they never carry clinical data. Any failure (for example
 * the database being unreachable during a static render) degrades to the
 * built-in defaults instead of breaking the homepage.
 */
export async function getHomepageAds(): Promise<HomepageAds> {
  try {
    // Queried per placement: one combined take could let a backlog of older
    // carousel ads starve the banner slot entirely.
    const [carouselAds, bannerAds] = await Promise.all([
      prisma.ad.findMany({
        where: { active: true, placement: "HOMEPAGE_CAROUSEL" },
        select: { title: true, content: true },
        orderBy: { createdAt: "asc" },
        take: 6,
      }),
      prisma.ad.findMany({
        where: { active: true, placement: "HOMEPAGE_BANNER" },
        select: { title: true, content: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      }),
    ]);
    return { carouselAds, bannerAd: bannerAds[0] ?? null };
  } catch {
    return { carouselAds: [], bannerAd: null };
  }
}
