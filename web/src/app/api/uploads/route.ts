import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const category = formData.get("category") as string;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return NextResponse.json({
    message: "File uploaded successfully",
    fileName: file.name,
    fileSize: buffer.length,
    category,
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  });
}
