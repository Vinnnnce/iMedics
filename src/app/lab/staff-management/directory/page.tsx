import Link from "next/link";
import { Search, Download, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { formatClinicDateTime } from "@/lib/format";

export default async function StaffDirectoryPage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;

  const allStaff = await prisma.facilityStaff.findMany({
    where: { facilityId: facility.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      facilityRole: true,
      status: true,
      department: { select: { name: true } },
      lastLoginAt: true,
      createdAt: true,
      credentials: { select: { expiryDate: true, verificationStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    totalStaff: allStaff.length,
    active: allStaff.filter((s) => s.status === "ACTIVE").length,
    pendingCredentials: allStaff.filter((s) =>
      s.credentials.some((c) => c.verificationStatus === "PENDING_VERIFICATION")
    ).length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Directory</h1>
          <p className="text-muted-foreground mt-1">Complete staff contact and credential information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
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
        <Card className="beeline-card bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Verification</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingCredentials}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or role..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Directory Table */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 font-semibold">Department</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Last Login</th>
                  <th className="text-right py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allStaff.map((staff) => (
                  <tr key={staff.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Link href={`/lab/staff-management/${staff.id}`} className="font-medium hover:underline">
                        {staff.fullName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{staff.email}</td>
                    <td className="py-3 px-4">{staff.facilityRole}</td>
                    <td className="py-3 px-4">{staff.department?.name || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant={staff.status === "ACTIVE" ? "default" : "secondary"}>
                        {staff.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {staff.lastLoginAt ? formatClinicDateTime(staff.lastLoginAt) : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/lab/staff-management/${staff.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
