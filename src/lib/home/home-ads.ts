import { prisma } from "@/lib/prisma";
import type { ImedicsHomeAd } from "@/components/home/imedics-homepage";

export interface HomepageAds {
  /** Active HOMEPAGE_CAROUSEL ads; empty means the built-in slides are used. */
  carouselAds: ImedicsHomeAd[];
  /** The active HOMEPAGE_BANNER ad; null means the built-in default is used. */
  bannerAd: ImedicsHomeAd | null;
}

const AD_SELECT = { title: true, content: true, imageUrl: true, linkUrl: true } as const;

/** Only ads inside their (optional) schedule window are shown. */
function scheduledNow(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

/**
 * Homepage ad slots. Ads are plain promotional content managed in the admin
 * content manager; they never carry clinical data. This version throws on
 * database errors so callers (the cached homepage loader) never cache an empty
 * result caused by a transient failure.
 */
export async function loadHomepageAds(now: Date = new Date()): Promise<HomepageAds> {
  // Queried per placement: one combined take could let a backlog of older
  // carousel ads starve the banner slot entirely.
  const [carouselAds, bannerAds] = await Promise.all([
    prisma.ad.findMany({
      where: { active: true, placement: "HOMEPAGE_CAROUSEL", ...scheduledNow(now) },
      select: AD_SELECT,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.ad.findMany({
      where: { active: true, placement: "HOMEPAGE_BANNER", ...scheduledNow(now) },
      select: AD_SELECT,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 1,
    }),
  ]);
  return { carouselAds, bannerAd: bannerAds[0] ?? null };
}

/** Failure-tolerant variant: any error degrades to the built-in defaults. */
export async function getHomepageAds(): Promise<HomepageAds> {
  try {
    return await loadHomepageAds();
  } catch {
    return { carouselAds: [], bannerAd: null };
  }
}
