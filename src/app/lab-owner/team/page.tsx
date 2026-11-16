import Link from "next/link";
import { Search, Plus, AlertCircle, Activity, Shield, Clock, CheckCircle2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { formatClinicDateTime } from "@/lib/format";

export default async function IndependentLabStaffPage() {
  const user = await requirePageRole("LAB_SCIENTIST");
  const lab = await getLaboratoryProfile(user.id);
  if (!lab) return null;

  // Fetch comprehensive staff data for independent lab
  // eslint-disable-next-line react-hooks/purity
  const credentialExpiryThreshold = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const [allStaff, credentialAlerts, activityLog] = await Promise.all([
    prisma.facilityStaff.findMany({
      where: { facilityId: lab.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        facilityRole: true,
        status: true,
        specialty: true,
        lastLoginAt: true,
        createdAt: true,
        credentials: { select: { id: true, type: true, expiryDate: true, verificationStatus: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.staffCredential.findMany({
      where: { staff: { facilityId: lab.id }, expiryDate: { lte: credentialExpiryThreshold } },
      select: {
        id: true,
        staff: { select: { id: true, fullName: true } },
        type: true,
        expiryDate: true,
      },
    }),
    prisma.controlAuditEvent.findMany({
      where: { facilityId: lab.id },
      select: { sequence: true, action: true, actorId: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = {
    totalStaff: allStaff.length,
    active: allStaff.filter((s) => s.status === "ACTIVE").length,
    onLeave: allStaff.filter((s) => s.status === "ON_LEAVE").length,
    suspended: allStaff.filter((s) => s.status === "SUSPENDED").length,
    credentialsExpiring: credentialAlerts.length,
  };

  const staffByRole = allStaff.reduce(
    (acc, staff) => {
      acc[staff.facilityRole] = (acc[staff.facilityRole] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "ON_LEAVE":
        return "bg-blue-100 text-blue-800";
      case "SUSPENDED":
        return "bg-orange-100 text-orange-800";
      case "TERMINATED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <CheckCircle2 className="h-4 w-4" />;
      case "ON_LEAVE":
        return <Clock className="h-4 w-4" />;
      case "SUSPENDED":
        return <AlertCircle className="h-4 w-4" />;
      case "TERMINATED":
        return <Trash2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground mt-1">Manage your laboratory team members and credentials</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/lab-owner/team/invite">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="beeline-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Team Members</p>
            <p className="text-2xl font-bold">{stats.totalStaff}</p>
          </CardContent>
        </Card>

        <Card className="beeline-card bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>

        <Card className="beeline-card bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="text-2xl font-bold text-blue-600">{stats.onLeave}</p>
          </CardContent>
        </Card>

        <Card className="beeline-card bg-orange-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Suspended</p>
            <p className="text-2xl font-bold text-orange-600">{stats.suspended}</p>
          </CardContent>
        </Card>

        <Card className="beeline-card bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Credentials Expiring</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.credentialsExpiring}</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {credentialAlerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Credential Expiry Alerts</p>
                <p className="text-sm text-yellow-800 mt-1">{stats.credentialsExpiring} team members have credentials expiring within 90 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff by Role */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team by Role</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(staffByRole)
            .sort((a, b) => b[1] - a[1])
            .map(([role, count]) => (
              <Card key={role} className="beeline-card">
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{role}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Team Directory */}
      <div>
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search team members by name or email..." className="pl-10" />
          </div>
        </div>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allStaff.map((staff) => (
                <Link key={staff.id} href={`/lab-owner/team/${staff.id}`}>
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{staff.fullName}</p>
                        <Badge className={getStatusColor(staff.status)} variant="outline">
                          {getStatusIcon(staff.status)}
                          <span className="ml-1">{staff.status}</span>
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>{staff.email}</span>
                        <span>{staff.facilityRole}</span>
                        {staff.specialty && <span>{staff.specialty}</span>}
                      </div>
                      {staff.lastLoginAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last login: {formatClinicDateTime(staff.lastLoginAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link href={`/lab-owner/team/${staff.id}/permissions`}>
                        <Button variant="ghost" size="sm">
                          <Shield className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/lab-owner/team/${staff.id}/credentials`}>
                        <Button variant="ghost" size="sm">
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {activityLog.length > 0 && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activityLog.map((log) => (
              <div key={String(log.sequence)} className="flex justify-between text-sm p-2 border-b last:border-0">
                <span className="font-medium">{log.action}</span>
                <span className="text-muted-foreground">{formatClinicDateTime(log.occurredAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
