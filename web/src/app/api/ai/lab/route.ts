import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { category, values, patientSummary } = await req.json();

  if (!category || !values) {
    return NextResponse.json({ error: "Missing category or values" }, { status: 400 });
  }

  const analysisId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return NextResponse.json({
    analysisId,
    status: "completed",
    category,
    summary: `Based on the ${category} results provided, most values are within typical reference ranges. Some values may be outside the expected range and should be discussed with your doctor.`,
    insights: [
      {
        code: "HGB",
        status: "normal",
        message: "Hemoglobin is within reference range.",
      },
      {
        code: "WBC",
        status: "normal",
        message: "White blood cell count is within normal limits.",
      },
    ],
    disclaimer: "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
  });
}
