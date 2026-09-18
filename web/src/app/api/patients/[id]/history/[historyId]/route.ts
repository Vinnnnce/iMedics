import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { medicalHistorySchema } from "@/lib/validations";

// GET /api/patients/[id]/history/[historyId] - Get a specific medical history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  try {
    const { id, historyId } = await params;
    const history = await prisma.medicalHistory.findFirst({
      where: { id: historyId, patientId: id },
    });
    if (!history) {
      return NextResponse.json({ error: "Medical history not found" }, { status: 404 });
    }
    return NextResponse.json(history);
  } catch (error) {
    console.error("Get medical history error:", error);
    return NextResponse.json({ error: "Failed to get medical history" }, { status: 500 });
  }
}

// PUT /api/patients/[id]/history/[historyId] - Update a medical history
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  try {
    const { id, historyId } = await params;
    const body = await req.json();
    const validated = medicalHistorySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }
    const data = validated.data;
    const history = await prisma.medicalHistory.update({
      where: { id: historyId, patientId: id },
      data: {
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
    return NextResponse.json(history);
  } catch (error) {
    console.error("Update medical history error:", error);
    return NextResponse.json({ error: "Failed to update medical history" }, { status: 500 });
  }
}

// DELETE /api/patients/[id]/history/[historyId] - Delete a medical history
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  try {
    const { id, historyId } = await params;
    await prisma.medicalHistory.delete({
      where: { id: historyId, patientId: id },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete medical history error:", error);
    return NextResponse.json({ error: "Failed to delete medical history" }, { status: 500 });
  }
}
