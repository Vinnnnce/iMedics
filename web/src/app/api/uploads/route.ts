import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string | null;
    const patientId = formData.get("patientId") as string | null;
    const labName = formData.get("labName") as string | null;
    const testDate = formData.get("testDate") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, JPG, PNG, WebP" },
        { status: 400 }
      );
    }

    // In production, upload to S3-compatible storage
    // For now, generate a placeholder URL
    const fileUrl = `uploads/${Date.now()}_${file.name}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Save metadata to database
    let labResult = null;
    if (patientId) {
      try {
        labResult = await prisma.labResult.create({
          data: {
            patientId,
            panelType: category,
            testDate: testDate ? new Date(testDate) : new Date(),
            labName: labName || null,
            fileUrl,
            status: "PENDING",
          },
        });
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    return NextResponse.json({
      message: "File uploaded successfully",
      fileName: file.name,
      fileSize: buffer.length,
      fileType: file.type,
      category,
      fileUrl,
      labResultId: labResult?.id || null,
      jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: labResult ? "saved" : "uploaded",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: String(error) },
      { status: 500 }
    );
  }
}
