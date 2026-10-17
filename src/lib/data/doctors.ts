import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import { nextAvailableSlot } from "../availability";
import { portfolioItemIsPublic, serializePublicPortfolioItem, doctorServiceSelect, serializeDoctorService } from "../doctor-profile";

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
  verificationStatus: true,
  user: { select: { name: true, avatarUrl: true } },
  // Medic1905 profile enhancement: only shown when the doctor publishes them.
  professionalTitle: true,
  qualifications: true,
  clinicalInterests: true,
  conditionsTreated: true,
  proceduresPerformed: true,
  patientCarePhilosophy: true,
  consultationApproach: true,
  whenToBookGuidance: true,
  consultationModes: true,
  linkedinUrl: true,
  linkedinPublic: true,
  cvFileId: true,
  licensingAuthority: true,
  licenseExpiry: true,
  licensePublic: true,
  professionalMemberships: true,
  awards: true,
  hospitalAffiliations: true,
  identityVerification: true,
  identityVerifiedAt: true,
  licenseVerification: true,
  licenseVerifiedAt: true,
  qualificationVerification: true,
  qualificationVerifiedAt: true,
  licenseNumber: true,
} satisfies Prisma.DoctorProfileSelect;

type PublicRow = Prisma.DoctorProfileGetPayload<{ select: typeof publicSelect }>;

/**
 * Public shape of a doctor: flat name, JSON-safe fees, and nothing the doctor has not
 * published — the LinkedIn URL disappears unless it is public, and the licence number
 * is only included when the doctor opted into public display.
 */
function toPublic({ user, consultationFee, followUpFee, ...profile }: PublicRow) {
  return {
    ...profile,
    name: user.name,
    avatarUrl: user.avatarUrl,
    consultationFee: consultationFee === null ? null : Number(consultationFee),
    followUpFee: followUpFee === null ? null : Number(followUpFee),
    linkedinUrl: profile.linkedinPublic ? profile.linkedinUrl : null,
    licenseNumber: profile.licensePublic ? profile.licenseNumber : null,
  };
}

const visibleDoctor: Prisma.DoctorProfileWhereInput = {
  verificationStatus: "VERIFIED",
  user: { status: "ACTIVE", deletedAt: null },
  // Directory listing is a subscription-gated feature: a doctor whose active plan switches
  // listing off is hidden from the directory. Doctors without a plan keep the free listing.
  NOT: [
    {
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() },
        plan: { features: { path: ["listing"], equals: false } },
      },
    },
  ],
};

/** Verified doctors who are accepting patients. */
export async function listDoctors(options: { search?: string; specialty?: string; limit?: number; offset?: number } = {}) {
  const { search, specialty, limit = 20, offset = 0 } = options;

  const where: Prisma.DoctorProfileWhereInput = {
    ...visibleDoctor,
    acceptingPatients: true,
    ...(specialty ? { specialty: { equals: specialty, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { specialty: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } } ,
            { affiliation: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.doctorProfile.findMany({
      where,
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: limit,
      skip: offset,
      select: publicSelect,
    }),
    prisma.doctorProfile.count({ where }),
  ]);
  return { doctors: rows.map(toPublic), total };
}

/** Average of one review category, across approved reviews that set it. */
function categoryAverage(reviews: { communicationRating: number | null; professionalismRating: number | null; punctualityRating: number | null; explanationRating: number | null }[], key: "communicationRating" | "professionalismRating" | "punctualityRating" | "explanationRating") {
  const values = reviews.map((r) => r[key]).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return { avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10, count: values.length };
}

/**
 * One doctor's public profile: published services and portfolio, the real next available slot,
 * approved reviews (with the doctor's replies), and, for patients, their own like / review state.
 */
export async function getDoctorProfileView(id: string, viewer: User) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id, ...visibleDoctor },
    select: {
      ...publicSelect,
      reviews: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          communicationRating: true, professionalismRating: true, punctualityRating: true, explanationRating: true,
          doctorResponse: true, doctorRespondedAt: true,
          patient: { select: { firstName: true } },
        },
      },
    },
  });
  if (!doctor) return null;

  const [services, portfolio, nextSlot] = await Promise.all([
    prisma.doctorService.findMany({
      where: { doctorId: id, isActive: true },
      orderBy: [{ kind: "asc" }, { price: "asc" }],
      select: doctorServiceSelect,
    }),
    prisma.doctorPortfolioItem.findMany({
      where: { doctorId: id, visibility: "PUBLIC" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: { id: true, type: true, title: true, description: true, externalUrl: true, publishedAt: true, attachmentFileId: true, consentStatus: true, visibility: true },
    }),
    nextAvailableSlot(id),
  ]);

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

  // Category averages are computed over every approved review, not just the listed page.
  const categoryRows = await prisma.doctorReview.findMany({
    where: { doctorId: id, moderationStatus: "APPROVED" },
    select: { communicationRating: true, professionalismRating: true, punctualityRating: true, explanationRating: true },
  });

  const { reviews, ...profile } = doctor;
  const publishedReviews = reviews.map(({ patient, ...r }) => ({ ...r, author: patient.firstName }));
  return {
    doctor: toPublic(profile),
    services: services.map(serializeDoctorService),
    portfolio: portfolio.filter(portfolioItemIsPublic).map(serializePublicPortfolioItem),
    nextAvailableAt: nextSlot?.start.toISOString() ?? null,
    reviews: publishedReviews,
    reviewCategories: {
      communication: categoryAverage(categoryRows, "communicationRating"),
      professionalism: categoryAverage(categoryRows, "professionalismRating"),
      punctuality: categoryAverage(categoryRows, "punctualityRating"),
      explanation: categoryAverage(categoryRows, "explanationRating"),
    },
    viewer: viewerState,
  };
}
