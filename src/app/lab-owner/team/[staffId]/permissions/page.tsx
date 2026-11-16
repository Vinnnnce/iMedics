import Link from "next/link";
import { ArrowLeft, Save, RotateCcw, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { notFound } from "next/navigation";

interface Props {
  params: { staffId: string };
}

const PERMISSION_GROUPS = {
  sample_management: {
    name: "Sample Management",
    description: "Manage laboratory samples and tracking",
    permissions: [
      { id: "view_samples", name: "View Samples", description: "View all laboratory samples" },
      { id: "create_sample", name: "Create Samples", description: "Register new samples" },
      { id: "modify_sample", name: "Modify Samples", description: "Edit sample information" },
      { id: "archive_sample", name: "Archive Samples", description: "Archive completed samples" },
    ],
  },
  test_operations: {
    name: "Test Operations",
    description: "Conduct and manage laboratory tests",
    permissions: [
      { id: "view_tests", name: "View Tests", description: "View all test orders" },
      { id: "conduct_test", name: "Conduct Tests", description: "Perform laboratory tests" },
      { id: "upload_results", name: "Upload Results", description: "Upload test results" },
      { id: "approve_results", name: "Approve Results", description: "Verify and approve test results" },
      { id: "quality_check", name: "Quality Check", description: "Perform QA on results" },
    ],
  },
  reports: {
    name: "Reports & Documentation",
    description: "Generate and manage reports",
    permissions: [
      { id: "view_reports", name: "View Reports", description: "View generated reports" },
      { id: "generate_report", name: "Generate Reports", description: "Create new reports" },
      { id: "export_data", name: "Export Data", description: "Export laboratory data" },
      { id: "manage_documents", name: "Manage Documents", description: "Handle documentation" },
    ],
  },
  equipment: {
    name: "Equipment Management",
    description: "Manage laboratory equipment",
    permissions: [
      { id: "view_equipment", name: "View Equipment", description: "View equipment inventory" },
      { id: "log_usage", name: "Log Equipment Usage", description: "Record equipment usage" },
      { id: "schedule_maintenance", name: "Schedule Maintenance", description: "Plan maintenance schedules" },
      { id: "equipment_reports", name: "Equipment Reports", description: "View maintenance history" },
    ],
  },
  staff_coordination: {
    name: "Staff Coordination",
    description: "Coordinate with team members",
    permissions: [
      { id: "view_team", name: "View Team", description: "See team member information" },
      { id: "assign_tasks", name: "Assign Tasks", description: "Delegate work to team members" },
      { id: "manage_schedule", name: "Manage Schedule", description: "Manage team schedules" },
      { id: "view_performance", name: "View Performance", description: "Track team performance metrics" },
    ],
  },
  billing_finance: {
    name: "Billing & Finance",
    description: "Manage laboratory billing",
    permissions: [
      { id: "view_billing", name: "View Billing", description: "View invoices and billing" },
      { id: "manage_payments", name: "Manage Payments", description: "Process payments" },
      { id: "export_financial", name: "Export Financial Data", description: "Export financial reports" },
    ],
  },
};

export default async function TeamMemberPermissionsPage({ params }: Props) {
  const user = await requirePageRole("LABORATORY");
  const lab = await getLaboratoryProfile(user.id);
  if (!lab) return null;

  const staff = await prisma.laboratoryStaff.findUnique({
    where: { id: params.staffId, laboratoryId: lab.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      permissions: true,
      customPermissions: true,
    },
  });

  if (!staff) return notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href={`/lab-owner/team/${staff.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Manage Permissions</h1>
          <p className="text-muted-foreground mt-1">{staff.fullName} ({staff.role})</p>
        </div>
      </div>

      {/* Quick Role Selection */}
      <Card className="beeline-card bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">Quick Role Templates</p>
              <p className="text-sm text-blue-800 mt-1">Select a template to apply predefined permissions, then customize as needed</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="outline">View Only</Button>
                <Button size="sm" variant="outline">Technician</Button>
                <Button size="sm" variant="outline">Senior Technician</Button>
                <Button size="sm" variant="outline">Custom</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Groups */}
      <form className="space-y-4">
        {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
          <Card key={groupKey} className="beeline-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                {group.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">{group.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.permissions.map((perm) => (
                  <label key={perm.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      className="mt-1"
                      defaultChecked={staff.customPermissions?.includes(perm.id)}
                      name={perm.id}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{perm.name}</p>
                      <p className="text-sm text-muted-foreground">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-6 sticky bottom-6 bg-background rounded-lg p-4 border">
          <Button>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Link href={`/lab-owner/team/${staff.id}`} className="ml-auto">
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>

      {/* Permission Audit Trail */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle>Permission History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 text-muted-foreground">
            <p>Permission changes are logged for audit purposes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
