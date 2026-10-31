import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import { portfolioItemIsPublic } from "../doctor-profile";

const publicSelect = {
  id: true,
  specialty: true,
  subSpecialty: true,
  affiliation: true,
  biography: true,
  education: true,
  languages: true,
  areasOfExpertise: true,
  location: true,
  consultationFee: true,
  followUpFee: true,
  followUpWindowDays: true,
  currency: true,
  yearsOfExperience: true,
  acceptingPatients: true,
  ratingAvg: true,
  ratingCount: true,
  likeCount: true,
  user: { select: { name: true, avatarUrl: true } },
} satisfies Prisma.DoctorProfileSelect;

type PublicRow = Prisma.DoctorProfileGetPayload<{ select: typeof publicSelect }>;

/** Public shape of a doctor: no licence or registration numbers, flat name. */
function toPublic({ user, consultationFee, followUpFee, ...profile }: PublicRow) {
  return {
    ...profile,
    name: user.name,
    avatarUrl: user.avatarUrl,
    consultationFee: consultationFee === null ? null : Number(consultationFee),
    followUpFee: followUpFee === null ? null : Number(followUpFee),
  };
}

const visibleDoctor: Prisma.DoctorProfileWhereInput = {
  verificationStatus: "VERIFIED",
  user: { status: "ACTIVE", deletedAt: null },
};

/** Verified doctors who are accepting patients. */
export const DOCTOR_SORTS = ["rating", "fee_asc", "likes", "name"] as const;
export type DoctorSort = (typeof DOCTOR_SORTS)[number];

const DOCTOR_ORDER: Record<DoctorSort, Prisma.DoctorProfileOrderByWithRelationInput[]> = {
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  fee_asc: [{ consultationFee: { sort: "asc", nulls: "last" } }, { ratingAvg: "desc" }],
  likes: [{ likeCount: "desc" }, { ratingAvg: "desc" }],
  name: [{ user: { name: "asc" } }],
};

export interface DoctorListOptions {
  search?: string;
  specialty?: string;
  /** Only doctors rated at least this many stars (1–5). */
  minRating?: number;
  /** Only doctors whose consultation fee is at most this amount. */
  maxFee?: number;
  sort?: DoctorSort;
  limit?: number;
  offset?: number;
}

export async function listDoctors(options: DoctorListOptions = {}) {
  const { search, specialty, minRating, maxFee, sort = "rating", limit = 20, offset = 0 } = options;

  const where: Prisma.DoctorProfileWhereInput = {
    ...visibleDoctor,
    acceptingPatients: true,
    ...(specialty ? { specialty: { equals: specialty, mode: "insensitive" } } : {}),
    ...(minRating ? { ratingAvg: { gte: minRating }, ratingCount: { gt: 0 } } : {}),
    ...(maxFee !== undefined ? { consultationFee: { lte: maxFee } } : {}),
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { specialty: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
            { affiliation: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.doctorProfile.findMany({
      where,
      orderBy: DOCTOR_ORDER[sort],
      take: limit,
      skip: offset,
      select: publicSelect,
    }),
    prisma.doctorProfile.count({ where }),
  ]);
  return { doctors: rows.map(toPublic), total };
}

/** Specialties offered by doctors who are currently bookable, for the directory filter. */
export async function listDoctorSpecialties(): Promise<string[]> {
  const rows = await prisma.doctorProfile.findMany({
    where: { ...visibleDoctor, acceptingPatients: true, specialty: { not: "" } },
    distinct: ["specialty"],
    select: { specialty: true },
    orderBy: { specialty: "asc" },
    take: 100,
  });
  return rows.map((r) => r.specialty).filter((v): v is string => Boolean(v));
}

/** One doctor's public profile with recent reviews and, for patients, their own like / review state. */
export async function getDoctorProfileView(id: string, viewer: User) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id, ...visibleDoctor },
    select: {
      ...publicSelect,
      reviews: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true, patient: { select: { firstName: true } } },
      },
    },
  });
  if (!doctor) return null;

  // Public portfolio (consent rules enforced by portfolioItemIsPublic) and the
  // star breakdown across every approved review, not just the recent ones.
  const [portfolioRows, ratingGroups] = await Promise.all([
    prisma.doctorPortfolioItem.findMany({
      where: { doctorId: id, visibility: "PUBLIC" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true, type: true, title: true, description: true, externalUrl: true,
        publishedAt: true, attachmentFileId: true, visibility: true, consentStatus: true,
      },
    }),
    prisma.doctorReview.groupBy({
      by: ["rating"],
      where: { doctorId: id, moderationStatus: "APPROVED" },
      _count: { _all: true },
    }),
  ]);
  const portfolio = portfolioRows
    .filter(portfolioItemIsPublic)
.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      externalUrl: item.externalUrl,
      attachmentFileId: item.attachmentFileId,
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    }));
  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratingGroups.find((g) => g.rating === stars)?._count._all ?? 0,
  }));

  let viewerState = { liked: false, canReview: false };
  if (viewer.role === "PATIENT") {
    const patient = await prisma.patient.findFirst({ where: { userId: viewer.id, deletedAt: null }, select: { id: true } });
    if (patient) {
      const [like, completed] = await Promise.all([
        prisma.doctorLike.findUnique({ where: { patientId_doctorId: { patientId: patient.id, doctorId: id } }, select: { id: true } }),
        prisma.appointment.findFirst({ where: { patientId: patient.id, doctorId: id, status: "COMPLETED" }, select: { id: true } }),
      ]);
      viewerState = { liked: Boolean(like), canReview: Boolean(completed) };
    }
  }

  const { reviews, ...profile } = doctor;
  return {
    doctor: toPublic(profile),
    reviews: reviews.map(({ patient, ...r }) => ({ ...r, author: patient.firstName })),
    portfolio,
    ratingBreakdown,
    viewer: viewerState,
  };
}
