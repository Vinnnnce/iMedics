import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { facilityBookingVisible } from "@/lib/facilities";
import { listDoctors } from "@/lib/data/doctors";
import { listPublicFacilities } from "@/lib/public-facilities";
import {
  RECOMMENDATION_CATEGORY_LABELS,
  type RecommendationCategory,
  type RecommendationContext,
  type RecommendationItem,
  type RecommendationViewerType,
  categoriesForViewer,
  capRecommendations,
  toDoctorRecommendation,
  toFacilityPatientRecommendation,
  toFacilityRecommendation,
  toPatientRecommendation,
  viewerFromAccountType,
  viewerFromRole,
} from "@/lib/recommendations";

const LIMIT = 4;

type Viewer =
  | { kind: "PATIENT" }
  | { kind: "DOCTOR"; doctorProfileId: string | null }
  | {
      kind: "FACILITY";
      viewer: RecommendationViewerType;
      facility: { id: string; verificationStatus: string };
    };

function parseContext(value: string | null): RecommendationContext | null {
  return value === "patient" || value === "doctor" || value === "facility" ? value : null;
}

/**
 * Resolve the dashboard perspective to build recommendations for.
 *
 * The context only selects which dashboard's perspective is used; authorization
 * is still derived entirely from the signed-in user on the server.
 */
async function resolveViewer(user: User, context: RecommendationContext): Promise<Viewer | null> {
  if (context === "doctor") {
    if (user.role !== "DOCTOR") throw forbidden("Doctor account required");
    const profile = await prisma.doctorProfile.findFirst({
      where: { userId: user.id, user: { status: "ACTIVE", deletedAt: null } },
      select: { id: true, verificationStatus: true },
    });
    // Unverified doctors have no authorized patient list yet; the patients
    // category simply stays empty while the other categories still render.
    return {
      kind: "DOCTOR",
      doctorProfileId: profile?.verificationStatus === "VERIFIED" ? profile.id : null,
    };
  }

  if (context === "facility") {
    // Throws notFound when the user has no facility portal access — same rule
    // as the facility portal pages.
    const facility = await resolveFacilityForPortalUser(user);
    const owner = await prisma.user.findUnique({
      where: { id: facility.userId },
      select: { accountType: true },
    });
    const viewer = viewerFromAccountType(owner?.accountType ?? null);
    // An unknown or patient/doctor account type has no facility perspective.
    if (!viewer || viewer === "PATIENT" || viewer === "DOCTOR") return null;
    return {
      kind: "FACILITY",
      viewer,
      facility: { id: facility.id, verificationStatus: facility.verificationStatus },
    };
  }

  if (user.role !== "PATIENT") throw forbidden("Patient account required");
  return { kind: "PATIENT" };
}

async function doctorItems(): Promise<RecommendationItem[]> {
  const { doctors } = await listDoctors({ limit: LIMIT });
  return doctors.map(toDoctorRecommendation);
}

async function facilityItems(
  directory: "hospitals" | "laboratories" | "diagnostic-centres",
): Promise<RecommendationItem[]> {
  const facilities = await listPublicFacilities({ directory, limit: LIMIT });
  return facilities
    .map((row) => toFacilityRecommendation(directory, row))
    .filter((item): item is RecommendationItem => item !== null);
}

/** Patients a doctor is already authorized to see: their active assignments only. */
async function doctorPatientItems(doctorProfileId: string): Promise<RecommendationItem[]> {
  const patients = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      user: { status: "ACTIVE", deletedAt: null },
      assignments: { some: { doctorId: doctorProfileId, status: "ACTIVE" } },
    },
    select: { id: true, firstName: true, lastName: true, caseNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: LIMIT,
  });
  return patients.map(toPatientRecommendation);
}

/**
 * Patients a facility is already authorized to see: those with an open lab order
 * or an active paid booking at the facility. The links open the portal listings
 * the facility already uses, never a patient profile.
 *
 * Lab-order suggestions follow the orders portal's own rule: only LAB_SCIENTIST
 * accounts may see other patients' orders, so other roles (e.g. invited staff
 * with a personal patient account) receive booking suggestions only.
 */
async function facilityPatientItems(
  user: User,
  facilityId: string,
  verified: boolean,
): Promise<RecommendationItem[]> {
  if (!verified) return [];
  const [orders, bookings] = await Promise.all([
    user.role === "LAB_SCIENTIST"
      ? prisma.labOrder.findMany({
      where: {
        // Same authorized transaction scope as the facility orders portal:
        // patients with a paid booking at this facility or a result uploaded by
        // this user. Nothing beyond that is exposed.
        patient: {
          deletedAt: null,
          OR: [
            {
              facilityBookings: {
                some: {
                  service: { facilityId },
                  status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED"] },
                  OR: [{ payment: null }, { payment: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } }],
                },
              },
            },
            { labResults: { some: { uploadedById: user.id } } },
          ],
        },
        status: { in: ["ORDERED", "IN_PROGRESS"] },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: LIMIT,
      select: { patient: { select: { id: true, firstName: true, lastName: true } } },
    })
      : Promise.resolve([] as { patient: { id: string; firstName: string | null; lastName: string | null } }[]),
    prisma.facilityBooking.findMany({
      where: {
        AND: [
          { service: { facilityId } },
          facilityBookingVisible,
          { status: { in: ["REQUESTED", "CONFIRMED"] } },
          { patient: { deletedAt: null } },
        ],
      },
      orderBy: { preferredAt: "asc" },
      take: LIMIT,
      select: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  const seen = new Set<string>();
  const items: RecommendationItem[] = [];
  for (const order of orders) {
    if (seen.has(order.patient.id)) continue;
    seen.add(order.patient.id);
    items.push(toFacilityPatientRecommendation("orders", order, "Open lab order"));
  }
  for (const booking of bookings) {
    if (seen.has(booking.patient.id)) continue;
    seen.add(booking.patient.id);
    items.push(toFacilityPatientRecommendation("bookings", booking, "Upcoming booking"));
  }
  return capRecommendations(items, LIMIT);
}

/**
 * Build the personalized recommendation categories for a signed-in user.
 *
 * Each account type receives the four categories it does not belong to, and
 * every item is limited to fields the requester is already authorized to see.
 */
export async function getRecommendations(
  user: User,
  contextParam: string | null,
): Promise<RecommendationCategory[]> {
  const context = parseContext(contextParam) ?? viewerFromRole(user.role);
  const viewer = await resolveViewer(user, context);
  if (!viewer) return [];

  const categories: RecommendationCategory[] = [];
  for (const key of categoriesForViewer(viewer.kind === "FACILITY" ? viewer.viewer : viewer.kind)) {
    let items: RecommendationItem[] = [];
    if (key === "doctors") {
      items = await doctorItems();
    } else if (key === "hospitals") {
      items = await facilityItems("hospitals");
    } else if (key === "laboratories") {
      items = await facilityItems("laboratories");
    } else if (key === "diagnosticCentres") {
      items = await facilityItems("diagnostic-centres");
    } else if (key === "patients") {
      if (viewer.kind === "DOCTOR" && viewer.doctorProfileId) {
        items = await doctorPatientItems(viewer.doctorProfileId);
      } else if (viewer.kind === "FACILITY") {
        items = await facilityPatientItems(user, viewer.facility.id, viewer.facility.verificationStatus === "VERIFIED");
      }
    }
    categories.push({ key, label: RECOMMENDATION_CATEGORY_LABELS[key], items: capRecommendations(items, LIMIT) });
  }
  return categories;
}
