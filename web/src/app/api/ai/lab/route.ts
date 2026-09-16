import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeLabResults } from "@/lib/kimi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labResultId,
      patientAge,
      patientSex,
      patientLanguage,
      panelType,
      values,
    } = body as {
      labResultId?: string;
      patientAge?: number;
      patientSex?: string;
      patientLanguage?: string;
      panelType: string;
      values: Array<{
        code: string;
        name: string;
        value: string;
        unit: string;
        refLow: string;
        refHigh: string;
      }>;
    };

    if (!panelType || !values || !Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: "Missing panelType or values" }, { status: 400 });
    }

    // Call Kimi K3 for AI analysis
    const analysis = await analyzeLabResults({
      patientAge,
      patientSex,
      patientLanguage,
      panelType,
      values,
    });

    // Save analysis to database if labResultId provided
    let savedAnalysis = null;
    if (labResultId) {
      try {
        savedAnalysis = await prisma.aiAnalysis.upsert({
          where: { labResultId },
          create: {
            labResultId,
            status: "COMPLETED",
            doctorView: analysis.summary_for_doctor,
            patientView: analysis.summary_for_patient,
            flags: analysis.flags,
            urgencyLevel: analysis.flags.length > 3 ? "urgent" : "routine",
          },
          update: {
            status: "COMPLETED",
            doctorView: analysis.summary_for_doctor,
            patientView: analysis.summary_for_patient,
            flags: analysis.flags,
            urgencyLevel: analysis.flags.length > 3 ? "urgent" : "routine",
          },
        });

        await prisma.labResult.update({
          where: { id: labResultId },
          data: { status: "AI_ANALYSIS_COMPLETE" },
        });
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    return NextResponse.json({
      analysisId: savedAnalysis?.id || `ai_${Date.now()}`,
      status: "completed",
      panelType,
      summary_for_doctor: analysis.summary_for_doctor,
      summary_for_patient: analysis.summary_for_patient,
      flags: analysis.flags,
      limitations: analysis.limitations,
      disclaimer:
        "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
    });
  } catch (error) {
    console.error("AI lab analysis error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI analysis", details: String(error) },
      { status: 500 }
    );
  }
}
