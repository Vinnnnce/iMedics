import Link from "next/link";
import { ArrowRight, Calendar, FileText, Pill, AlertCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { formatClinicDateTime, formatDate } from "@/lib/format";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { patientSuggestions } from "@/lib/suggestions";

export default async function PatientDashboard() {
  const user = await requirePageRole("PATIENT");

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      bloodGroup: true,
      gender: true,
    },
  });

  if (!patient) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No patient record found. Please complete your profile.</p>
      </div>
    );
  }

  // Fetch upcoming appointments
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      patient: { userId: user.id, deletedAt: null },
      scheduledAt: { gte: new Date() },
      status: { in: ["BOOKED", "CONFIRMED"] },
    },
    orderBy: { scheduledAt: "asc" },
    take: 3,
    include: {
      doctor: { select: { id: true, user: { select: { name: true } }, specialty: true } },
    },
  });

  // Fetch recent lab results
  const recentResults = await prisma.labResult.findMany({
    where: { patient: { userId: user.id, deletedAt: null } },
    orderBy: { testDate: "desc" },
    take: 3,
    include: {
      values: { take: 3 },
    },
  });

  // Fetch active prescriptions
  const activePrescriptions = await prisma.prescription.findMany({
    where: {
      patient: { userId: user.id, deletedAt: null },
      status: "ACTIVE",
    },
    orderBy: { issuedAt: "desc" },
    take: 3,
    include: {
      items: { select: { drugName: true, dose: true, frequency: true } },
    },
  });

  // Fetch active care cases
  const activeCases = await prisma.careCase.findMany({
    where: {
      patient: { userId: user.id, deletedAt: null },
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      primaryDoctor: { select: { user: { select: { name: true } } } },
    },
  });

  // Fetch medication reminders
  const medicationReminders = await prisma.medicationReminder.findMany({
    where: {
      patient: { userId: user.id, deletedAt: null },
      active: true,
    },
    take: 2,
  });

  // Fetch admissions
  const activeAdmission = await prisma.admission.findFirst({
    where: {
      patient: { userId: user.id, deletedAt: null },
      status: "ACTIVE",
    },
    select: {
      id: true,
      facility: { select: { laboratoryName: true } },
      ward: true,
      bed: true,
      admissionDate: true,
    },
  });

  // Fetch payment info for suggestions
  const [unpaidPayments, failedPayments, pendingResults] = await Promise.all([
    prisma.payment.count({
      where: { payeeId: user.id, status: "PENDING" },
    }),
    prisma.payment.count({
      where: { payeeId: user.id, status: "FAILED" },
    }),
    prisma.labResult.count({
      where: { patient: { userId: user.id, deletedAt: null }, status: "PENDING" },
    }),
  ]);

  const suggestionItems = patientSuggestions({
    hasUpcomingAppointment: upcomingAppointments.length > 0,
    unpaidPayments,
    failedPayments,
    pendingResults,
    unreadMessages: 0,
    hasBloodGroup: Boolean(patient.bloodGroup),
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {patient.firstName}!</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s your health overview</p>
      </div>

      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Blood Group */}
        <Card className="beeline-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blood Type</p>
                <p className="text-2xl font-bold">{patient.bloodGroup || "—"}</p>
              </div>
              <Heart className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Active Appointments */}
        <Card className="beeline-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
                <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Active Prescriptions */}
        <Card className="beeline-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Medications</p>
                <p className="text-2xl font-bold">{activePrescriptions.length}</p>
              </div>
              <Pill className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Active Cases */}
        <Card className="beeline-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Cases</p>
                <p className="text-2xl font-bold">{activeCases.length}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Admission Alert */}
      {activeAdmission && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Currently Admitted</p>
                <p className="text-sm text-blue-800">
                  {activeAdmission.facility?.laboratoryName} • {activeAdmission.ward} {activeAdmission.bed && `• Bed ${activeAdmission.bed}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account-specific suggestions */}
      <SuggestionsCard items={suggestionItems} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card className="beeline-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
              <Link href="/patient/appointments">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition">
                    <div className="flex items-start gap-3 flex-1">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{apt.doctor?.user?.name || "Doctor"}</p>
                        <p className="text-sm text-muted-foreground">{apt.doctor?.specialty || "Consultation"}</p>
                        <p className="text-sm text-muted-foreground mt-1">{formatClinicDateTime(apt.scheduledAt)}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{apt.mode}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm py-4">No upcoming appointments</p>
              )}
              <Link href="/patient/appointments">
                <Button className="w-full mt-2" variant="outline">
                  Schedule Appointment
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Medication Reminders */}
        <Card className="beeline-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Medication Reminders</CardTitle>
            <Link href="/patient/reminders">
              <Button variant="ghost" size="sm">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {medicationReminders.length > 0 ? (
              medicationReminders.map((reminder) => (
                <div key={reminder.id} className="p-2 border rounded bg-muted/30">
                  <p className="text-sm font-medium">{reminder.label}</p>
                  <p className="text-xs text-muted-foreground">{reminder.times?.join(", ") || "Set times"}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm py-4">No active reminders</p>
            )}
            <Link href="/patient/reminders">
              <Button className="w-full" variant="outline" size="sm">
                Manage
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Results & Active Prescriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lab Results */}
        <Card className="beeline-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Recent Lab Results</CardTitle>
            <Link href="/patient/results">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentResults.length > 0 ? (
              recentResults.map((result) => (
                <Link key={result.id} href={`/patient/results`}>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 transition cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{result.panelType}</p>
                      <Badge variant={result.status === "VERIFIED" ? "success" : "secondary"}>{result.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(result.testDate)}</p>
                    {result.values.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{result.values.length} test values</p>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm py-4">No lab results yet</p>
            )}
          </CardContent>
        </Card>

        {/* Active Prescriptions */}
        <Card className="beeline-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Active Prescriptions</CardTitle>
            <Link href="/patient/prescriptions">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePrescriptions.length > 0 ? (
              activePrescriptions.map((rx) => (
                <Link key={rx.id} href={`/patient/prescriptions`}>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 transition cursor-pointer">
                    <div className="mb-1">
                      <p className="font-medium text-sm">
                        {rx.items[0]?.drugName || "Prescription"}
                        {rx.items.length > 1 && ` +${rx.items.length - 1}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rx.items[0]?.dose && `${rx.items[0].dose} • `}
                      {rx.items[0]?.frequency || "As directed"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Issued {formatDate(rx.issuedAt)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm py-4">No active prescriptions</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Care Cases */}
      {activeCases.length > 0 && (
        <Card className="beeline-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Active Cases</CardTitle>
            <Link href="/patient/cases">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeCases.map((caseItem) => (
                <Link key={caseItem.id} href={`/patient/cases/${caseItem.id}`}>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 transition cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{caseItem.caseNumber}</p>
                        <p className="text-xs text-muted-foreground">{caseItem.type}</p>
                        {caseItem.primaryDoctor && (
                          <p className="text-xs text-muted-foreground">with {caseItem.primaryDoctor.user?.name}</p>
                        )}
                      </div>
                      <Badge>{caseItem.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card className="beeline-card bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link href="/patient/appointments">
              <Button variant="ghost" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Appointments
              </Button>
            </Link>
            <Link href="/patient/prescriptions">
              <Button variant="ghost" className="w-full justify-start">
                <Pill className="h-4 w-4 mr-2" />
                Medications
              </Button>
            </Link>
            <Link href="/patient/results">
              <Button variant="ghost" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Results
              </Button>
            </Link>
            <Link href="/patient/documents">
              <Button variant="ghost" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
