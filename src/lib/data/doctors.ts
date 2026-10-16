import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";

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
            { location: { contains: search, mode: "insensitive" } },
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

/** One doctor's public profile with recent reviews and, for patients, their own like / review state. */
export async function getDoctorProfileView(id: string, viewer: User) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id, ...visibleDoctor },
    select: {
      ...publicSelect,
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true, patient: { select: { firstName: true } } },
      },
    },
  });
  if (!doctor) return null;

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
    viewer: viewerState,
  };
}
