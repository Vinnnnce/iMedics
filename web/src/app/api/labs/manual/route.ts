import { NextRequest, NextResponse } from "next/server";

interface LabValue {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { category, labName, testDate, values } = body as {
    category: string;
    labName: string;
    testDate: string;
    values: LabValue[];
  };

  if (!category || !values || !Array.isArray(values)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const flagged = values.filter((v) => {
    const val = parseFloat(v.value);
    const low = parseFloat(v.refLow);
    const high = parseFloat(v.refHigh);
    return !isNaN(val) && !isNaN(low) && !isNaN(high) && (val < low || val > high);
  });

  return NextResponse.json({
    message: "Lab results submitted",
    category,
    labName,
    testDate,
    totalValues: values.length,
    flaggedCount: flagged.length,
    flagged,
    analysisId: `analysis_${Date.now()}`,
    status: "pending",
  });
}
