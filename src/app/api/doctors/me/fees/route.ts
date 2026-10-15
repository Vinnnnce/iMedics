import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { currencySchema, priceSchema } from "@/lib/money";
import { writeAudit } from "@/lib/audit";

const feeSelect = { consultationFee: true, followUpFee: true, followUpWindowDays: true, currency: true } as const;

type Money = { toString(): string } | null;
const serialize = (p: { consultationFee: Money; followUpFee: Money; followUpWindowDays: number; currency: string }) => ({
  consultationFee: p.consultationFee === null ? null : Number(p.consultationFee),
  followUpFee: p.followUpFee === null ? null : Number(p.followUpFee),
  followUpWindowDays: p.followUpWindowDays,
  currency: p.currency,
});

// GET /api/doctors/me/fees — the signed-in doctor's current fees.
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const fees = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctor.id }, select: feeSelect });
  return NextResponse.json({ fees: serialize(fees) });
});

const updateSchema = z
  .object({
    consultationFee: priceSchema,
    /** null = no separate follow-up rate (follow-ups cost the standard fee). */
    followUpFee: priceSchema.nullable(),
    followUpWindowDays: z.number().int().min(1).max(90),
    currency: currencySchema,
  })
  .refine((v) => v.followUpFee === null || v.followUpFee <= v.consultationFee, {
    path: ["followUpFee"],
    message: "The follow-up fee cannot be higher than the standard fee",
  });

// PUT /api/doctors/me/fees — set the standard consultation fee and the reduced follow-up fee.
// Fees apply to new bookings only; appointments already booked keep the price they were booked at.
export const PUT = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, updateSchema);

  const fees = await prisma.doctorProfile.update({ where: { id: doctor.id }, data, select: feeSelect });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_FEES_UPDATED", resourceType: "DoctorProfile", resourceId: doctor.id, details: data, req });
  return NextResponse.json({ fees: serialize(fees) });
});
