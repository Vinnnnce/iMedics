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
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";

export default async function AddTeamMemberPage() {
  const user = await requirePageRole("LAB_SCIENTIST");
  const lab = await getLaboratoryProfile(user.id);
  if (!lab) return null;

  const TEAM_ROLES = [
    "LABORATORY_TECHNICIAN",
    "SENIOR_TECHNICIAN",
    "PATHOLOGIST",
    "MICROBIOLOGIST",
    "BIOCHEMIST",
    "HEMATOLOGIST",
    "PHLEBOTOMIST",
    "QUALITY_OFFICER",
    "ADMINISTRATOR",
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href="/lab-owner/team">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add Team Member</h1>
          <p className="text-muted-foreground mt-1">Invite a new member to your laboratory team</p>
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
                <Input type="email" placeholder="john@lab.com" required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input type="tel" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Specialization */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle>Role Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Lab Role *</Label>
                <Select defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Specialization (optional)</Label>
                <Input placeholder="e.g., Clinical Chemistry, Microbiology" />
              </div>
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
              Choose a permission template. Permissions can be customized after the team member joins.
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="limited" defaultChecked />
                <div>
                  <p className="font-medium">Limited Access</p>
                  <p className="text-xs text-muted-foreground">View-only access to assigned tests</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="technician" />
                <div>
                  <p className="font-medium">Technician Access</p>
                  <p className="text-xs text-muted-foreground">Full test operations permissions</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="senior" />
                <div>
                  <p className="font-medium">Senior Technician Access</p>
                  <p className="text-xs text-muted-foreground">Includes quality check and approvals</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="radio" name="permission_template" value="admin" />
                <div>
                  <p className="font-medium">Administrator Access</p>
                  <p className="text-xs text-muted-foreground">Full laboratory management permissions</p>
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
                placeholder="Welcome to our laboratory! Here's what you need to know..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Onboarding Checklist</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Complete team member profile</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Upload professional credentials</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Complete laboratory safety training</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Sign confidentiality agreement</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Equipment orientation</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="beeline-card bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900">What happens next:</p>
              <ul className="space-y-1 text-blue-800">
                <li>✓ Invitation email will be sent to the team member</li>
                <li>✓ They'll create their account and set a password</li>
                <li>✓ You'll review their credentials before full access is granted</li>
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
          <Link href="/lab-owner/team" className="ml-auto">
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
                Drag and drop or click to select a CSV file to bulk invite team members
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              <a href="#" className="underline">Download template</a> • Max 100 team members per import
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
