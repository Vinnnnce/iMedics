import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type {
  TopRatedDoctor,
  TopRatedFacility,
  TopRatedFacilityType,
} from "@/components/home/imedics-homepage";
import { loadHomepageAds, type HomepageAds } from "@/lib/home/home-ads";

/** Revalidate this tag after any change that affects the public homepage. */
export const HOME_CACHE_TAG = "homepage";
const REVALIDATE_SECONDS = 300;
const FACILITY_KINDS: readonly TopRatedFacilityType[] = ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"];

export interface HomepageData extends HomepageAds {
  topDoctors: TopRatedDoctor[];
  topFacilities: TopRatedFacility[];
}

async function loadTopDoctors(): Promise<TopRatedDoctor[]> {
  const doctors = await prisma.doctorProfile.findMany({
    where: { verificationStatus: "VERIFIED", ratingCount: { gt: 0 } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 4,
    select: {
      id: true,
      specialty: true,
      ratingAvg: true,
      ratingCount: true,
      user: { select: { name: true } },
    },
  });
  return doctors.map((doctor) => ({
    id: doctor.id,
    name: doctor.user.name?.trim() || "Doctor",
    specialty: doctor.specialty,
    ratingAvg: doctor.ratingAvg,
    ratingCount: doctor.ratingCount,
  }));
}

/** The three best-rated published facilities of one kind. */
async function loadTopFacilities(type: TopRatedFacilityType): Promise<TopRatedFacility[]> {
  const facilities = await prisma.labStaffProfile.findMany({
    where: {
      isPublished: true,
      verificationStatus: "VERIFIED",
      ratingCount: { gt: 0 },
      // Older profiles may predate the `kind` column; fall back to the account type.
      OR: [{ kind: type }, { kind: null, user: { accountType: type } }],
    },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 3,
    select: { id: true, laboratoryName: true, slug: true, ratingAvg: true, ratingCount: true },
  });
  return facilities
    .filter((facility) => facility.laboratoryName)
    .map((facility) => ({
      id: facility.id,
      name: facility.laboratoryName as string,
      type,
      slug: facility.slug,
      ratingAvg: facility.ratingAvg,
      ratingCount: facility.ratingCount,
    }));
}

/**
 * Everything the public homepage needs, cached for a few minutes. The page is
 * the most visited route and none of this data is personal, so it is shared
 * across all visitors instead of hitting the database on every request. Admin
 * ad changes and new reviews can call revalidateTag(HOME_CACHE_TAG, "max") to
 * refresh it sooner. Errors propagate so a transient failure is never cached.
 */
const loadHomepageDataCached = unstable_cache(
  async (): Promise<HomepageData> => {
    const [topDoctors, facilityGroups, ads] = await Promise.all([
      loadTopDoctors(),
      Promise.all(FACILITY_KINDS.map(loadTopFacilities)),
      loadHomepageAds(),
    ]);
    return { topDoctors, topFacilities: facilityGroups.flat(), ...ads };
  },
  ["homepage-data-v2"],
  { revalidate: REVALIDATE_SECONDS, tags: [HOME_CACHE_TAG] },
);

/** Failure-tolerant: a database outage renders the homepage with its defaults. */
export async function getHomepageData(): Promise<HomepageData> {
  try {
    return await loadHomepageDataCached();
  } catch {
    return { topDoctors: [], topFacilities: [], carouselAds: [], bannerAd: null };
  }
}
