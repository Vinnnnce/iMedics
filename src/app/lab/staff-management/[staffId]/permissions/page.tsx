import Link from "next/link";
import { ArrowLeft, Save, RotateCcw, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ staffId: string }>;
}

const PERMISSION_GROUPS = {
  patient_data: {
    name: "Patient Data",
    description: "Access to view and manage patient information",
    permissions: [
      { id: "view_patient_list", name: "View Patient List", description: "View all patients in the facility" },
      { id: "view_patient_details", name: "View Patient Details", description: "Access patient medical records and history" },
      { id: "edit_patient_info", name: "Edit Patient Information", description: "Modify patient demographics and contact info" },
      { id: "manage_patient_documents", name: "Manage Patient Documents", description: "Upload and manage patient medical documents" },
    ],
  },
  appointments: {
    name: "Appointments & Scheduling",
    description: "Schedule and manage appointments",
    permissions: [
      { id: "view_appointments", name: "View Appointments", description: "View all appointments" },
      { id: "create_appointment", name: "Create Appointments", description: "Schedule new appointments" },
      { id: "modify_appointment", name: "Modify Appointments", description: "Reschedule or cancel appointments" },
      { id: "bulk_schedule", name: "Bulk Scheduling", description: "Import and schedule appointments in bulk" },
    ],
  },
  lab_orders: {
    name: "Lab Orders & Results",
    description: "Manage laboratory orders and results",
    permissions: [
      { id: "view_orders", name: "View Orders", description: "View lab orders" },
      { id: "create_order", name: "Create Lab Orders", description: "Create new lab test orders" },
      { id: "upload_results", name: "Upload Results", description: "Upload lab test results" },
      { id: "modify_results", name: "Modify Results", description: "Edit test results" },
      { id: "approve_results", name: "Approve Results", description: "Verify and approve lab results" },
    ],
  },
  staff_management: {
    name: "Staff Management",
    description: "Manage staff and permissions",
    permissions: [
      { id: "view_staff", name: "View Staff", description: "View staff directory" },
      { id: "manage_staff_roles", name: "Manage Staff Roles", description: "Assign roles and permissions to staff" },
      { id: "invite_staff", name: "Invite Staff", description: "Send invitations to new staff members" },
      { id: "manage_credentials", name: "Manage Credentials", description: "Review and verify staff credentials" },
      { id: "suspend_staff", name: "Suspend Staff", description: "Suspend or terminate staff members" },
    ],
  },
  organization: {
    name: "Organization Settings",
    description: "Manage facility-wide settings",
    permissions: [
      { id: "view_organization", name: "View Organization", description: "View facility information" },
      { id: "edit_organization", name: "Edit Organization", description: "Modify facility information and settings" },
      { id: "manage_departments", name: "Manage Departments", description: "Create and manage departments" },
      { id: "manage_services", name: "Manage Services", description: "Add and manage facility services" },
      { id: "view_analytics", name: "View Analytics", description: "Access facility analytics and reports" },
    ],
  },
  billing: {
    name: "Billing & Payments",
    description: "Manage billing and financial information",
    permissions: [
      { id: "view_invoices", name: "View Invoices", description: "View facility invoices and billing" },
      { id: "manage_payments", name: "Manage Payments", description: "Process and manage payments" },
      { id: "export_financial", name: "Export Financial Data", description: "Export financial reports and data" },
    ],
  },
};

export default async function StaffPermissionsPage({ params }: Props) {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;

  const { staffId } = await params;
  const staff = await prisma.facilityStaff.findFirst({
    where: { id: staffId, facilityId: facility.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      facilityRole: true,
      permissionOverrides: true,
    },
  });

  const customPermissions = Array.isArray(staff?.permissionOverrides)
    ? (staff.permissionOverrides as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  if (!staff) return notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href={`/lab/staff-management/${staff.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Manage Permissions</h1>
          <p className="text-muted-foreground mt-1">{staff.fullName} ({staff.facilityRole})</p>
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
                <Button size="sm" variant="outline">Clinician</Button>
                <Button size="sm" variant="outline">Administrator</Button>
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
                      defaultChecked={customPermissions.includes(perm.id)}
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
          <Link href={`/lab/staff-management/${staff.id}`} className="ml-auto">
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
