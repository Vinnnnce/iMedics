import Link from "next/link";
import { Search, Plus, Users, AlertCircle, Activity, Shield, Clock, CheckCircle2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { formatDate, formatClinicDateTime } from "@/lib/format";

export default async function StaffManagementPage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;

  // Fetch comprehensive staff data
  const [allStaff, departments, credentialAlerts, activityLog] = await Promise.all([
    prisma.facilityStaff.findMany({
      where: { facilityId: facility.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        facilityRole: true,
        status: true,
        department: { select: { id: true, name: true } },
        lastLoginAt: true,
        createdAt: true,
        credentials: { select: { id: true, type: true, expiryDate: true, verificationStatus: true } },
        user: { select: { id: true, lastActiveAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.facilityDepartment.findMany({
      where: { facilityId: facility.id, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffCredential.findMany({
      where: { staff: { facilityId: facility.id }, expiryDate: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
      select: {
        id: true,
        staff: { select: { id: true, fullName: true } },
        type: true,
        expiryDate: true,
      },
    }),
    prisma.controlAuditEvent.findMany({
      where: { facilityId: facility.id },
      select: { id: true, action: true, actorId: true, occurredAt: true, details: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ]);

  // Calculate statistics
  const stats = {
    totalStaff: allStaff.length,
    active: allStaff.filter((s) => s.status === "ACTIVE").length,
    onLeave: allStaff.filter((s) => s.status === "ON_LEAVE").length,
    suspended: allStaff.filter((s) => s.status === "SUSPENDED").length,
    terminated: allStaff.filter((s) => s.status === "TERMINATED").length,
    credentialsExpiring: credentialAlerts.length,
  };

  // Group staff by role
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
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage roles, permissions, and credentials</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/lab/staff-management/invite">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="beeline-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Staff</p>
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

        <Card className="beeline-card bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Terminated</p>
            <p className="text-2xl font-bold text-red-600">{stats.terminated}</p>
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
                <p className="text-sm text-yellow-800 mt-1">{stats.credentialsExpiring} staff members have credentials expiring within 90 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff by Role */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Staff by Role</h2>
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

      {/* Department Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Departments</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {departments.map((dept) => {
            const deptStaffCount = allStaff.filter((s) => s.department?.id === dept.id).length;
            return (
              <Card key={dept.id} className="beeline-card hover:bg-muted/50 cursor-pointer">
                <CardContent className="p-4">
                  <p className="font-medium">{dept.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{deptStaffCount} staff members</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Staff Directory */}
      <div>
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search staff by name or email..." className="pl-10" />
          </div>
        </div>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>All Staff Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allStaff.map((staff) => (
                <Link key={staff.id} href={`/lab/staff-management/${staff.id}`}>
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
                        {staff.department && <span>{staff.department.name}</span>}
                      </div>
                      {staff.lastLoginAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last login: {formatClinicDateTime(staff.lastLoginAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link href={`/lab/staff-management/${staff.id}/permissions`}>
                        <Button variant="ghost" size="sm">
                          <Shield className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/lab/staff-management/${staff.id}/credentials`}>
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
              <div key={log.id} className="flex justify-between text-sm p-2 border-b last:border-0">
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
