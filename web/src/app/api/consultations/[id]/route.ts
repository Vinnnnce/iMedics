import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/consultations/[id] — fetch a single consultation report
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, email: true, dateOfBirth: true, sex: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });
    if (!consultation) {
      return Response.json(
        { error: "Consultation not found" },
        { status: 404 }
      );
    }
    return Response.json({ consultation });
  } catch (error) {
    console.error("Get consultation error:", error);
    return Response.json(
      { error: "Failed to fetch consultation" },
      { status: 500 }
    );
  }
}
