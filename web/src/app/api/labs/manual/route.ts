import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeLabResults } from "@/lib/kimi";

interface LabValue {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, labName, testDate, values, patientId, patientAge, patientSex, patientLanguage } = body as {
      category: string;
      labName?: string;
      testDate: string;
      values: LabValue[];
      patientId?: string;
      patientAge?: number;
      patientSex?: string;
      patientLanguage?: string;
    };

    if (!category || !values || !Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: "Missing required fields: category and values" }, { status: 400 });
    }

    // Validate values
    for (const v of values) {
      if (!v.code || !v.name || v.value === undefined) {
        return NextResponse.json(
          { error: "Each value must have code, name, and value" },
          { status: 400 }
        );
      }
    }

    // Flag out-of-range values
    const flagged = values.filter((v) => {
      const val = parseFloat(v.value);
      const low = parseFloat(v.refLow);
      const high = parseFloat(v.refHigh);
      return !isNaN(val) && !isNaN(low) && !isNaN(high) && (val < low || val > high);
    });

    // Save to database
    let labResult = null;
    if (patientId) {
      try {
        labResult = await prisma.labResult.create({
          data: {
            patientId,
            panelType: category,
            testDate: new Date(testDate),
            labName: labName || null,
            values: JSON.stringify(values),
            status: "PENDING_AI_ANALYSIS",
          },
        });
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    // Trigger AI analysis
    let aiAnalysis = null;
    try {
      aiAnalysis = await analyzeLabResults({
        patientAge,
        patientSex,
        patientLanguage,
        panelType: category,
        values,
      });
    } catch (aiError) {
      console.error("AI analysis error:", aiError);
    }

    return NextResponse.json({
      message: "Lab results submitted successfully",
      labResultId: labResult?.id || null,
      category,
      labName: labName || null,
      testDate,
      totalValues: values.length,
      flaggedCount: flagged.length,
      flagged,
      analysisId: labResult?.id || `analysis_${Date.now()}`,
      status: aiAnalysis ? "ai_analysis_complete" : "pending_ai_analysis",
      aiSummary: aiAnalysis?.summary_for_patient || null,
      aiDoctorSummary: aiAnalysis?.summary_for_doctor || null,
      aiFlags: aiAnalysis?.flags || [],
      aiLimitations:
        aiAnalysis?.limitations ||
        "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
    });
  } catch (error) {
    console.error("Manual lab submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit lab results", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    const results = await prisma.labResult.findMany({
      where: { patientId },
      orderBy: { testDate: "desc" },
      include: { aiAnalysis: true },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Fetch lab results error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lab results", details: String(error) },
      { status: 500 }
    );
  }
}
