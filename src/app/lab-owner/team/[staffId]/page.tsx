import Link from "next/link";
import { ArrowLeft, Mail, Phone, Briefcase, Shield, FileText, AlertCircle, Trash2, Lock, Unlock, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { getLaboratoryProfile } from "@/lib/laboratory-auth";
import { formatClinicDateTime } from "@/lib/format";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ staffId: string }>;
}

export default async function TeamMemberProfilePage({ params }: Props) {
  const { staffId } = await params;
  const user = await requirePageRole("LAB_SCIENTIST");
  const lab = await getLaboratoryProfile(user.id);
  if (!lab) return null;

  const staff = await prisma.facilityStaff.findFirst({
    where: { id: staffId, facilityId: lab.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      facilityRole: true,
      status: true,
      specialty: true,
      createdAt: true,
      lastLoginAt: true,
      credentials: {
        select: {
          id: true,
          type: true,
          number: true,
          issueDate: true,
          expiryDate: true,
          verificationStatus: true,
          documentKey: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!staff) return notFound();

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

  const getCredentialStatus = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "EXPIRED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isCredentialExpiring = (expiryDate: Date | null) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  };

  const isCredentialExpired = (expiryDate: Date | null) => {
    return expiryDate !== null && expiryDate < new Date();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex gap-4 items-center">
        <Link href="/lab-owner/team">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{staff.fullName}</h1>
          <p className="text-muted-foreground mt-1">{staff.facilityRole}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/lab-owner/team/${staff.id}/permissions`}>
            <Button variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex gap-2">
        <Badge className={getStatusColor(staff.status)}>
          {staff.status}
        </Badge>
        {staff.specialty && (
          <Badge variant="outline">
            <Briefcase className="h-3 w-3 mr-1" />
            {staff.specialty}
          </Badge>
        )}
      </div>

      {/* Personal Information */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${staff.email}`} className="font-medium hover:underline">
                  {staff.email}
                </a>
              </div>
            </div>
            {staff.phoneNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${staff.phoneNumber}`} className="font-medium hover:underline">
                    {staff.phoneNumber}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date Joined</p>
                <p className="font-medium mt-1">{formatClinicDateTime(staff.createdAt)}</p>
              </div>
              {staff.lastLoginAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium mt-1">{formatClinicDateTime(staff.lastLoginAt)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card className="beeline-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Professional Credentials</CardTitle>
            <Link href={`/lab-owner/team/${staff.id}/credentials`}>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {staff.credentials.length === 0 ? (
            <div className="text-center p-6">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No credentials uploaded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staff.credentials.map((cred) => {
                const isExpiring = isCredentialExpiring(cred.expiryDate);
                const isExpired = isCredentialExpired(cred.expiryDate);

                return (
                  <div key={cred.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{cred.type}</p>
                        {cred.number && (
                          <p className="text-sm text-muted-foreground"># {cred.number}</p>
                        )}
                      </div>
                      <Badge className={getCredentialStatus(cred.verificationStatus)}>
                        {cred.verificationStatus}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      <div>
                        <p className="text-muted-foreground">Issued</p>
                        <p className="font-medium">{cred.issueDate ? formatClinicDateTime(cred.issueDate) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p className={`font-medium ${isExpired ? "text-red-600" : isExpiring ? "text-yellow-600" : ""}`}>
                          {cred.expiryDate ? formatClinicDateTime(cred.expiryDate) : "—"}
                          {isExpired && " (EXPIRED)"}
                          {isExpiring && " (EXPIRING SOON)"}
                        </p>
                      </div>
                    </div>

                    {cred.documentKey && (
                      <a href={cred.documentKey} target="_blank" rel="noopener noreferrer">
                        <Button variant="link" size="sm" className="mt-3">
                          View Document
                        </Button>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Management */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle>Access Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-semibold">Account Access</p>
              <p className="text-sm text-muted-foreground">
                {staff.status === "ACTIVE" ? "Team member has active access" : "Team member access is restricted"}
              </p>
            </div>
            {staff.status === "ACTIVE" ? (
              <Button variant="destructive" size="sm">
                <Lock className="h-4 w-4 mr-2" />
                Disable Access
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                <Unlock className="h-4 w-4 mr-2" />
                Enable Access
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-semibold">Reset Password</p>
              <p className="text-sm text-muted-foreground">
                Send a password reset link to {staff.email}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="beeline-card border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-800">
            These actions cannot be undone. Please proceed with caution.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Team Member
            </Button>
            <Button variant="outline" size="sm">
              Archive Record
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
