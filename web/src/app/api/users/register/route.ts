import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

/**
 * POST /api/users/register
 * Saves registration data from the post-signup registration form.
 * Creates or updates a User record and role-specific profile.
 */
export async function POST(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      firstName, lastName, middleName, email, phone, gender, dateOfBirth,
      address, city, state,
      mdcnRegistrationNumber, mdcnLicenseNumber, yearOfRegistration,
      specialty, yearsOfExperience, affiliation, biography,
      cacRegistrationNumber, organisationName, organisationType,
      facilityLicenseNumber,
      occupation, emergencyContactName, emergencyContactRelationship,
      emergencyContactPhone,
      accountType,
    } = body;

    const clerkId = clerkUser.id;
    const role = (clerkUser.unsafeMetadata as Record<string, unknown>)?.role as string || "PATIENT";

    // Upsert the User record
    const user = await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
        role: role as any,
        name: `${firstName} ${lastName}`,
        phone,
        sex: gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        onboardingComplete: false,
        status: "pending",
        accountType,
        conditions: [],
        medications: [],
      },
      update: {
        email,
        name: `${firstName} ${lastName}`,
        phone,
        sex: gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        status: "pending",
        accountType,
      },
    });

    // Create role-specific profiles
    if (accountType === "doctor") {
      await prisma.doctorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          gender,
          licenseNumber: mdcnLicenseNumber,
          mdcnRegistrationNumber,
          yearOfRegistration: yearOfRegistration ? parseInt(yearOfRegistration) : null,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          specialty,
          affiliation,
          biography,
          areasOfExpertise: [],
          aiToolsEnabled: false,
          verified: false,
          documentUrls: [],
          consultationSchedule: {},
        },
        update: {
          gender,
          licenseNumber: mdcnLicenseNumber,
          mdcnRegistrationNumber,
          yearOfRegistration: yearOfRegistration ? parseInt(yearOfRegistration) : null,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          specialty,
          affiliation,
          biography,
          verified: false,
        },
      });
    }

    if (accountType === "laboratory" || accountType === "diagnostic_centre" || accountType === "hospital") {
      await prisma.labStaffProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          laboratoryName: organisationName,
          position: organisationType,
          licenseIdNumber: facilityLicenseNumber,
          cacRegistrationNumber,
          facilityLicenseNumber,
          departments: [],
          verified: false,
          documentUrls: [],
        },
        update: {
          laboratoryName: organisationName,
          position: organisationType,
          licenseIdNumber: facilityLicenseNumber,
          cacRegistrationNumber,
          facilityLicenseNumber,
          verified: false,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REGISTRATION_SUBMITTED",
        resourceType: "User",
        resourceId: user.id,
        details: {
          accountType,
          role,
          requiresVerification: accountType === "doctor" || accountType === "laboratory" || accountType === "diagnostic_centre" || accountType === "hospital",
        },
      },
    }).catch(() => {}); // Non-blocking

    return NextResponse.json({
      success: true,
      userId: user.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to save registration data" },
      { status: 500 }
    );
  }
}
