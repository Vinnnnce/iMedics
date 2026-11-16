import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";

// Generate staff compliance report
export async function GET(req: Request) {
  try {
    const user = await requirePageRole("LABORATORY");
    const lab = await getLaboratoryProfile(user.id);
    if (!lab) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const reportType = new URL(req.url).searchParams.get("type") || "compliance";

    if (reportType === "compliance") {
      return await generateComplianceReport(lab.id);
    } else if (reportType === "activity") {
      return await generateActivityReport(lab.id);
    } else if (reportType === "credentials") {
      return await generateCredentialsReport(lab.id);
    } else if (reportType === "export-csv") {
      return await exportActivityCSV(lab.id);
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function generateComplianceReport(laboratoryId: string) {
  const staff = await prisma.laboratoryStaff.findMany({
    where: { laboratoryId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      credentials: {
        select: {
          type: true,
          expiryDate: true,
          verificationStatus: true,
        },
      },
    },
  });

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const report = {
    generatedAt: new Date().toISOString(),
    laboratorId: laboratoryId,
    summary: {
      totalStaff: staff.length,
      activeStaff: staff.filter(s => s.status === "ACTIVE").length,
      suspendedStaff: staff.filter(s => s.status === "SUSPENDED").length,
      credentialsExpired: 0,
      credentialsExpiringIn30Days: 0,
      credentialsExpiringIn90Days: 0,
    },
    details: staff.map(s => {
      const expiredCreds = s.credentials.filter(c => c.expiryDate < now);
      const expiring30 = s.credentials.filter(c => c.expiryDate >= now && c.expiryDate <= in30Days);
      const expiring90 = s.credentials.filter(c => c.expiryDate > in30Days && c.expiryDate <= in90Days);
      const verified = s.credentials.filter(c => c.verificationStatus === "VERIFIED").length;

      return {
        name: s.fullName,
        email: s.email,
        role: s.role,
        status: s.status,
        totalCredentials: s.credentials.length,
        verifiedCredentials: verified,
        expiredCredentials: expiredCreds.length,
        expiringIn30Days: expiring30.length,
        expiringIn90Days: expiring90.length,
        complianceStatus: expiredCreds.length === 0 && expiring30.length === 0 ? "COMPLIANT" : "NEEDS_ATTENTION",
      };
    }),
  };

  // Update summary counts
  report.summary.credentialsExpired = report.details.reduce((sum, d) => sum + d.expiredCredentials, 0);
  report.summary.credentialsExpiringIn30Days = report.details.reduce((sum, d) => sum + d.expiringIn30Days, 0);
  report.summary.credentialsExpiringIn90Days = report.details.reduce((sum, d) => sum + d.expiringIn90Days, 0);

  return NextResponse.json(report);
}

async function generateActivityReport(laboratoryId: string) {
  const activities = await prisma.controlAuditEvent.findMany({
    where: { laboratoryId },
    select: {
      id: true,
      action: true,
      actorId: true,
      occurredAt: true,
      details: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });

  const groupedByAction = activities.reduce((acc, activity) => {
    const action = activity.action;
    if (!acc[action]) {
      acc[action] = [];
    }
    acc[action].push(activity);
    return acc;
  }, {} as Record<string, typeof activities>);

  const report = {
    generatedAt: new Date().toISOString(),
    laboratoryId,
    totalEvents: activities.length,
    eventsByType: Object.entries(groupedByAction).map(([action, events]) => ({
      action,
      count: events.length,
      lastOccurred: events[0]?.occurredAt,
    })),
    recentActivity: activities.slice(0, 50),
  };

  return NextResponse.json(report);
}

async function generateCredentialsReport(laboratoryId: string) {
  const credentials = await prisma.laboratoryCredential.findMany({
    where: { staff: { laboratoryId } },
    select: {
      id: true,
      type: true,
      licenseNumber: true,
      expiryDate: true,
      verificationStatus: true,
      verifiedAt: true,
      staff: { select: { fullName: true, email: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const expired = credentials.filter(c => c.expiryDate < now);
  const expiringIn30 = credentials.filter(c => c.expiryDate >= now && c.expiryDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
  const expiringIn90 = credentials.filter(c => c.expiryDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) && c.expiryDate <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));

  const report = {
    generatedAt: new Date().toISOString(),
    laboratoryId,
    summary: {
      totalCredentials: credentials.length,
      verifiedCredentials: credentials.filter(c => c.verificationStatus === "VERIFIED").length,
      pendingCredentials: credentials.filter(c => c.verificationStatus === "PENDING").length,
      rejectedCredentials: credentials.filter(c => c.verificationStatus === "REJECTED").length,
      expiredCredentials: expired.length,
      expiringIn30Days: expiringIn30.length,
      expiringIn90Days: expiringIn90.length,
    },
    credentials: {
      expired: expired.map(c => ({
        staffName: c.staff.fullName,
        staffEmail: c.staff.email,
        type: c.type,
        licenseNumber: c.licenseNumber,
        expiryDate: c.expiryDate,
        daysExpired: Math.floor((now.getTime() - c.expiryDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      expiringIn30: expiringIn30.map(c => ({
        staffName: c.staff.fullName,
        staffEmail: c.staff.email,
        type: c.type,
        licenseNumber: c.licenseNumber,
        expiryDate: c.expiryDate,
        daysRemaining: Math.floor((c.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      expiringIn90: expiringIn90.map(c => ({
        staffName: c.staff.fullName,
        staffEmail: c.staff.email,
        type: c.type,
        licenseNumber: c.licenseNumber,
        expiryDate: c.expiryDate,
        daysRemaining: Math.floor((c.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    },
  };

  return NextResponse.json(report);
}

async function exportActivityCSV(laboratoryId: string) {
  const activities = await prisma.controlAuditEvent.findMany({
    where: { laboratoryId },
    select: {
      id: true,
      action: true,
      actorId: true,
      occurredAt: true,
      details: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 5000,
  });

  // Convert to CSV format
  const headers = ["Date", "Time", "Action", "Actor ID", "Details"];
  const rows = activities.map(a => [
    a.occurredAt.toLocaleDateString(),
    a.occurredAt.toLocaleTimeString(),
    a.action,
    a.actorId,
    JSON.stringify(a.details || {}),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="team-activity-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
