import Link from "next/link";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";

export default async function AddStaffPage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;

  const departments = await prisma.facilityDepartment.findMany({
    where: { facilityId: facility.id, active: true },
    orderBy: { name: "asc" },
  });

  const FACILITY_ROLES = [
    "DOCTOR",
    "NURSE",
    "TECHNICIAN",
    "RADIOLOGIST",
    "PATHOLOGIST",
    "RECEPTIONIST",
    "ADMINISTRATOR",
    "PHARMACIST",
    "PHYSIOTHERAPIST",
    "COUNSELOR",
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href="/lab/staff-management">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add Staff Member</h1>
          <p className="text-muted-foreground mt-1">Invite a new staff member to your organization</p>
        </div>
      </div>

      {/* Tabs for invite methods */}
      <div className="flex gap-2 border-b">
        <button className="px-4 py-2 border-b-2 border-primary font-medium">Individual Invite</button>
        <button className="px-4 py-2 text-muted-foreground">Bulk Import (CSV)</button>
      </div>

      {/* Individual Invite Form */}
      <form className="space-y-6">
        {/* Personal Information */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input placeholder="John" required />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input placeholder="Doe" required />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Email *</Label>
                <Input type="email" placeholder="john@facility.com" required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input type="tel" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Department */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Role Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Facility Role *</Label>
                <Select defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Checkbox defaultChecked />
                <span>This staff member works in multiple departments (optional)</span>
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Initial Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground mb-3">
              Choose a permission template. Permissions can be customized after the staff member joins.
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="limited" defaultChecked />
                <div>
                  <p className="font-medium">Limited Access</p>
                  <p className="text-xs text-muted-foreground">View-only access to assigned department</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="standard" />
                <div>
                  <p className="font-medium">Standard Access</p>
                  <p className="text-xs text-muted-foreground">Full role-based permissions</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="admin" />
                <div>
                  <p className="font-medium">Administrator Access</p>
                  <p className="text-xs text-muted-foreground">Full facility-wide permissions</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Welcome Message (optional)</Label>
              <Textarea
                placeholder="Welcome to our facility! Here's what you need to know..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Onboarding Checklist</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Complete staff profile</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Upload professional credentials</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Complete orientation training</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Sign compliance agreements</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Period */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Access Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Leave end date blank for permanent positions
            </p>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="beeline-card bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900">What happens next:</p>
              <ul className="space-y-1 text-blue-800">
                <li>✓ Invitation email will be sent to the staff member</li>
                <li>✓ They&apos;ll create their account and set a password</li>
                <li>✓ You&apos;ll review their credentials before full access is granted</li>
                <li>✓ An audit log will record this action</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2 sticky bottom-6 bg-background rounded-lg p-4 border">
          <Button type="submit">
            <Plus className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
          <Link href="/lab/staff-management" className="ml-auto">
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>

      {/* Bulk Import Section */}
      <Card className="beeline-card mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Bulk Import CSV</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium mb-1">Upload CSV File</p>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to select a CSV file to bulk invite staff
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              <a href="#" className="underline">Download template</a> • Max 500 staff per import
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
