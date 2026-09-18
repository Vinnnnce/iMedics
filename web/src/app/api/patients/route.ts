import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { patientSchema } from "@/lib/validations";
import { calculateBMI } from "@/lib/bmi";

// POST /api/patients - Create patient profile
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validated = patientSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Auto-calculate BMI
    const bmiResult = calculateBMI(data.height, data.weight);

    // Auto-generate case number if not provided
    const caseNumber =
      data.caseNumber ||
      `MC-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

    const patient = await prisma.patient.create({
      data: {
        caseNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        gender: data.gender,
        dateOfBirth: new Date(data.dateOfBirth),
        height: data.height || null,
        weight: data.weight || null,
        bmi: bmiResult?.value || null,
        occupation: data.occupation || null,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || null,
        ecName: data.ecName || null,
        ecRelationship: data.ecRelationship || null,
        ecPhone: data.ecPhone || null,
        ecAddress: data.ecAddress || null,
      },
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error("Create patient error:", error);
    return NextResponse.json(
      { error: "Failed to create patient", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/patients - List patients
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { caseNumber: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.patient.count({ where });

    return NextResponse.json({ patients, total });
  } catch (error) {
    console.error("List patients error:", error);
    return NextResponse.json(
      { error: "Failed to list patients", details: String(error) },
      { status: 500 }
    );
  }
}
