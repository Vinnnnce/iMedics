import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle, Clock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { formatClinicDateTime } from "@/lib/format";
import { notFound } from "next/navigation";

interface Props { params: Promise<{ staffId: string }> }

export default async function StaffCredentialsPage({ params }: Props) {
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
      credentials: {
        select: {
          id: true,
          type: true,
          number: true,
          issueDate: true,
          expiryDate: true,
          verificationStatus: true,
          verifiedById: true,
          verifiedAt: true,
          documentKey: true,
          restrictions: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!staff) return notFound();

  const getCredentialStatus = (status: string, expiryDate: Date | null) => {
    if (!expiryDate) {
      return { color: "bg-gray-100 text-gray-800", icon: "?", label: "NO EXPIRY" };
    }
    if (expiryDate < new Date()) {
      return { color: "bg-red-100 text-red-800", icon: "❌", label: "EXPIRED" };
    }
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 30) {
      return { color: "bg-red-100 text-red-800", icon: "⚠️", label: "EXPIRING SOON" };
    }
    if (daysUntilExpiry <= 90) {
      return { color: "bg-yellow-100 text-yellow-800", icon: "⏱️", label: "EXPIRING" };
    }
    switch (status) {
      case "VERIFIED":
        return { color: "bg-green-100 text-green-800", icon: "✓", label: "VERIFIED" };
      case "PENDING":
        return { color: "bg-blue-100 text-blue-800", icon: "⏳", label: "PENDING REVIEW" };
      case "REJECTED":
        return { color: "bg-red-100 text-red-800", icon: "❌", label: "REJECTED" };
      default:
        return { color: "bg-gray-100 text-gray-800", icon: "?", label: "UNKNOWN" };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href={`/lab/staff-management/${staff.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Credential Management</h1>
          <p className="text-muted-foreground mt-1">{staff.fullName} ({staff.facilityRole})</p>
        </div>
        <Link href={`/lab/staff-management/${staff.id}/credentials/add`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </Link>
      </div>

      {/* Compliance Status Summary */}
      <Card className="beeline-card bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Credential Compliance</p>
              <p className="text-sm text-blue-800 mt-1">
                {staff.credentials.filter(c => c.verificationStatus === "VERIFIED").length} verified, {staff.credentials.filter(c => (c.verificationStatus === "PENDING_VERIFICATION" || c.verificationStatus === "UNVERIFIED")).length} pending review
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials List */}
      {staff.credentials.length === 0 ? (
        <Card className="beeline-card">
          <CardContent className="p-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-semibold">No credentials on file</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload professional credentials to verify compliance and qualifications
            </p>
            <Link href={`/lab/staff-management/${staff.id}/credentials/add`} className="mt-4">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Credential
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {staff.credentials.map((credential) => {
            const statusInfo = getCredentialStatus(credential.verificationStatus, credential.expiryDate);
            const daysUntilExpiry = Math.floor(((credential.expiryDate?.getTime() ?? 0) - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Card key={credential.id} className="beeline-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-lg">{credential.type}</h3>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {credential.number && (
                        <p className="text-sm text-muted-foreground mb-3">
                          License #: {credential.number}
                        </p>
                      )}

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Issued Date</p>
                          <p className="font-medium">{credential.issueDate ? formatClinicDateTime(credential.issueDate) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expiry Date</p>
                          <p className={`font-medium ${credential.expiryDate && credential.expiryDate < new Date() ? "text-red-600" : daysUntilExpiry <= 90 ? "text-yellow-600" : ""}`}>
                            {credential.expiryDate ? formatClinicDateTime(credential.expiryDate) : "—"}
                            {daysUntilExpiry >= 0 && ` (${daysUntilExpiry} days)`}
                          </p>
                        </div>
                      </div>

                      {(credential.verificationStatus === "PENDING_VERIFICATION" || credential.verificationStatus === "UNVERIFIED") && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                          <p className="text-blue-900">⏳ Awaiting verification review</p>
                        </div>
                      )}

                      {credential.verificationStatus === "REJECTED" && credential.restrictions && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm">
                          <p className="font-medium text-red-900">Rejection Reason:</p>
                          <p className="text-red-800">{credential.restrictions}</p>
                        </div>
                      )}

                      {credential.verificationStatus === "VERIFIED" && credential.verifiedById && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
                          <p className="text-green-900">
                            ✓ Verified by administrator on {formatClinicDateTime(credential.verifiedAt!)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {credential.documentKey && (
                        <a href={credential.documentKey} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </a>
                      )}
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Credential Verification Workflow */}
      {staff.credentials.some(c => (c.verificationStatus === "PENDING_VERIFICATION" || c.verificationStatus === "UNVERIFIED")) && (
        <Card className="beeline-card bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-900">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staff.credentials
              .filter(c => (c.verificationStatus === "PENDING_VERIFICATION" || c.verificationStatus === "UNVERIFIED"))
              .map((credential) => (
                <div key={credential.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{credential.type}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatClinicDateTime(credential.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Reject</Button>
                    <Button size="sm">Verify</Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Expiry Reminders */}
      {staff.credentials.some((c) => {
        const daysUntilExpiry = Math.floor(((c.expiryDate?.getTime() ?? 0) - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
      }) && (
        <Card className="beeline-card bg-orange-50 border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-900">Expiry Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staff.credentials
                .filter((c) => {
                  const daysUntilExpiry = Math.floor(((c.expiryDate?.getTime() ?? 0) - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
                })
                .map((credential) => {
                  const daysUntilExpiry = Math.floor(((credential.expiryDate?.getTime() ?? 0) - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={credential.id} className="text-sm">
                      <p className="text-orange-900">
                        • {credential.type} expires in {daysUntilExpiry} days
                      </p>
                    </div>
                  );
                })}
            </div>
            <Button variant="outline" size="sm" className="mt-4">
              Send Renewal Reminder
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
