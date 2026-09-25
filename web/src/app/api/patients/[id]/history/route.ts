import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { medicalHistorySchema } from "@/lib/validations";

// POST /api/patients/[id]/history - Create medical history
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Check if patient exists
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const validated = medicalHistorySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const data = validated.data;

    const history = await prisma.medicalHistory.create({
      data: {
        patientId: id,
        status: data.status,
        chiefComplaint: data.chiefComplaint || null,
        symptoms: data.symptoms,
        medications: data.medications,
        hasWound: data.hasWound,
        woundLocation: data.woundLocation || null,
        woundType: data.woundType || null,
        woundTimeSinceInjury: data.woundTimeSinceInjury || null,
        woundCause: data.woundCause || null,
        hasDiabetes: data.hasDiabetes,
        diabetesDuration: data.diabetesDuration || null,
        diabetesType: data.diabetesType || null,
        diabetesControl: data.diabetesControl || null,
        hasStroke: data.hasStroke,
        strokeDate: data.strokeDate || null,
        strokeResidual: data.strokeResidual || null,
        hasHeartAttack: data.hasHeartAttack,
        heartAttackDate: data.heartAttackDate || null,
        heartAttackInterventions: data.heartAttackInterventions || null,
        familyHistory: data.familyHistory,
        pastHistory: data.pastHistory,
        allergies: data.allergies,
        smokingStatus: data.smokingStatus || null,
        smokingQuantity: data.smokingQuantity || null,
        alcoholUse: data.alcoholUse || null,
        physicalActivity: data.physicalActivity || null,
        sleepPattern: data.sleepPattern || null,
        pregnancies: data.pregnancies ?? null,
        deliveries: data.deliveries ?? null,
        reproductiveComplications: data.reproductiveComplications || null,
        mentalHealth: data.mentalHealth,
        immunizations: data.immunizations,
      },
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    console.error("Create medical history error:", error);
    return NextResponse.json(
      { error: "Failed to create medical history", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/patients/[id]/history - Get medical history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: { patientId: string; status?: string } = { patientId: id };
    if (status) {
      where.status = status;
    }

    const histories = await prisma.medicalHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ histories });
  } catch (error) {
    console.error("Get medical history error:", error);
    return NextResponse.json(
      { error: "Failed to get medical history", details: String(error) },
      { status: 500 }
    );
  }
}
