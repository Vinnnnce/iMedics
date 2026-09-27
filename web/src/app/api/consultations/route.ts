import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/auth";

type MedicationInput = {
  name?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

type SymptomInput = { name?: string; duration?: string; severity?: string };

type VitalsInput = {
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  respiratoryRate?: string;
  spo2?: string;
  weight?: string;
  height?: string;
  bmi?: string;
};

type ConsultationInput = {
  patientId?: string;
  doctorId?: string; // used only when no Clerk session is available
  chiefComplaint?: string;
  historyPresentIllness?: string;
  pastMedicalHistory?: string;
  symptoms?: SymptomInput[];
  vitals?: VitalsInput;
  examination?: string;
  diagnosis?: string;
  icdCode?: string;
  differentialDiagnosis?: string;
  labFindings?: string;
  imagingFindings?: string;
  medications?: MedicationInput[];
  treatmentPlan?: string;
  recommendations?: string;
  followUpDate?: string;
  notes?: string;
  status?: string;
};

// GET /api/consultations — list consultation reports
// Optional query: patientId, doctorId
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;
    const doctorId = searchParams.get("doctorId") || undefined;

    const where: { patientId?: string; doctorId?: string } = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    const consultations = await prisma.consultation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ consultations });
  } catch (error) {
    console.error("List consultations error:", error);
    return Response.json(
      { error: "Failed to list consultations" },
      { status: 500 }
    );
  }
}

// POST /api/consultations — save a consultation report
// The report structure follows the JEMYS hospital information system
// (jemys.ru) electronic medical record: complaints, anamnesis,
// objective examination with vitals, diagnosis (ICD-10), laboratory
// and diagnostic findings, prescriptions, treatment plan.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConsultationInput;

    if (!body.patientId) {
      return Response.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const patient = await prisma.user.findUnique({
      where: { id: body.patientId },
    });
    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    // Resolve the author: the signed-in Clerk user, or an explicit
    // doctorId when no Clerk session exists (e.g. local development).
    let doctorId: string | undefined;
    let session: Awaited<ReturnType<typeof auth>> | null = null;
    try {
      session = await auth();
    } catch {
      // Clerk keys missing or misconfigured — treat as signed out
      // and fall back to an explicit doctorId below.
      session = null;
    }
    if (session?.userId) {
      const dbUser = await getDbUser();
      if (dbUser && dbUser.role !== "PATIENT" && dbUser.role !== "LAB_SCIENTIST") {
        doctorId = dbUser.id;
      } else if (dbUser) {
        return Response.json(
          { error: "Only doctors and admins can write consultation reports" },
          { status: 403 }
        );
      }
    }
    if (!doctorId) {
      doctorId = body.doctorId;
    }
    if (!doctorId) {
      return Response.json(
        { error: "Could not resolve the consulting doctor" },
        { status: 400 }
      );
    }

    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    const medications = (body.medications || []).filter((m) => m.name?.trim());
    const symptoms = (body.symptoms || []).filter((s) => s.name?.trim());

    const consultation = await prisma.consultation.create({
      data: {
        patientId: body.patientId,
        doctorId,
        chiefComplaint: body.chiefComplaint?.trim() || null,
        historyPresentIllness: body.historyPresentIllness?.trim() || null,
        pastMedicalHistory: body.pastMedicalHistory?.trim() || null,
        symptoms: symptoms as object,
        vitals: (body.vitals || {}) as object,
        examination: body.examination?.trim() || null,
        diagnosis: body.diagnosis?.trim() || null,
        icdCode: body.icdCode?.trim() || null,
        differentialDiagnosis: body.differentialDiagnosis?.trim() || null,
        labFindings: body.labFindings?.trim() || null,
        imagingFindings: body.imagingFindings?.trim() || null,
        medications: medications as object,
        treatmentPlan: body.treatmentPlan?.trim() || null,
        recommendations: body.recommendations?.trim() || null,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        notes: body.notes?.trim() || null,
        status: body.status === "draft" ? "draft" : "finalized",
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ success: true, consultation }, { status: 201 });
  } catch (error) {
    console.error("Create consultation error:", error);
    return Response.json(
      { error: "Failed to save consultation report" },
      { status: 500 }
    );
  }
}
