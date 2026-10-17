import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountControls } from "@/components/admin/account-controls";
import { PageHeader, ROLE_LABEL, TYPE_LABEL, UserStatusBadge, VerificationBadge, ago } from "@/components/admin/ui";
import { getUserDetail } from "@/lib/admin/users";
import { describeAction } from "@/lib/admin/audit-labels";
import { requirePageRole } from "@/lib/guards";
import { writeAudit } from "@/lib/audit";
import { formatClinicDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium">{children ?? "—"}</dd>
  </div>
);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageRole("ADMIN");
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const detail = await getUserDetail(parsed.data);
  if (!detail) notFound();
  const { user, appointments, payments, reviews, documentCount, activity } = detail;

  await writeAudit({ userId: admin.id, actorRole: "ADMIN", action: "ADMIN_VIEWED_USER", resourceType: "User", resourceId: user.id, details: { context: "account" } });

  const doctor = user.doctorProfile;
  const facility = user.labStaffProfile;
  const professional = Boolean(doctor || facility);
  const verification = doctor?.verificationStatus ?? facility?.verificationStatus ?? null;
  const apptTotal = Object.values(appointments).reduce((a, b) => a + b, 0);

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All users</Link>
      <PageHeader
        title={user.name}
        description={`${ROLE_LABEL[user.role]}${user.accountType && user.accountType !== "PATIENT" && user.accountType !== "DOCTOR" ? ` · ${TYPE_LABEL[user.accountType]}` : ""} · registered ${formatClinicDateTime(user.createdAt)}`}
        actions={<><UserStatusBadge status={user.status} />{verification && <VerificationBadge status={verification} />}</>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Item label="Email">{user.email}</Item>
                <Item label="Phone">{user.phone}</Item>
                <Item label="Language">{user.language}</Item>
                <Item label="Onboarding">{user.onboardingComplete ? "Complete" : "Not finished"}</Item>
                <Item label="Terms accepted">{user.termsAcceptedAt ? `${formatClinicDateTime(user.termsAcceptedAt)} (v${user.termsVersion ?? "?"})` : "Not recorded"}</Item>
                <Item label="Last sign-in">{user.lastLoginAt ? `${formatClinicDateTime(user.lastLoginAt)} (${ago(user.lastLoginAt)})` : "Never"}</Item>
                {user.statusChangedAt && <Item label="Status last changed">{formatClinicDateTime(user.statusChangedAt)}</Item>}
              </dl>
            </CardContent>
          </Card>

          {professional && (
            <Card className="beeline-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Professional profile</CardTitle>
                <Link href={`/admin/verifications/${user.id}`} className="inline-flex items-center gap-1 text-xs underline"><ShieldCheck className="h-3.5 w-3.5" /> Open verification file ({documentCount} document{documentCount === 1 ? "" : "s"})</Link>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {doctor && (
                    <>
                      <Item label="Specialty">{[doctor.specialty, doctor.subSpecialty].filter(Boolean).join(" · ")}</Item>
                      <Item label="Affiliation">{doctor.affiliation}</Item>
                      <Item label="Location">{doctor.location}</Item>
                      <Item label="Experience">{doctor.yearsOfExperience ? `${doctor.yearsOfExperience} years` : null}</Item>
                      <Item label="Consultation fee">{doctor.consultationFee === null ? "Not set" : formatMoney(Number(doctor.consultationFee), doctor.currency)}{doctor.followUpFee !== null && ` · follow-up ${formatMoney(Number(doctor.followUpFee), doctor.currency)}`}</Item>
                      <Item label="Accepting patients">{doctor.acceptingPatients ? "Yes" : "No"}</Item>
                      <Item label="Rating">{doctor.ratingCount > 0 ? `${doctor.ratingAvg.toFixed(1)} (${doctor.ratingCount})` : "No reviews yet"}</Item>
                      <Item label="Verified">{doctor.verifiedAt ? `${formatClinicDateTime(doctor.verifiedAt)}${doctor.verifiedBy ? ` by ${doctor.verifiedBy.name}` : ""}` : "Not yet"}</Item>
                    </>
                  )}
                  {facility && (
                    <>
                      <Item label="Organisation">{facility.laboratoryName}</Item>
                      <Item label="Location">{[facility.city, facility.state].filter(Boolean).join(", ")}</Item>
                      <Item label="Services published">{facility._count.services}</Item>
                      <Item label="Verified">{facility.verifiedAt ? `${formatClinicDateTime(facility.verifiedAt)}${facility.verifiedBy ? ` by ${facility.verifiedBy.name}` : ""}` : "Not yet"}</Item>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {user.patient && (
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Patient account</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Item label="Case number">{user.patient.caseNumber}</Item>
                  <Item label="Appointments">{apptTotal}</Item>
                </dl>
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Administrators do not have access to patients&apos; medical records, so none are shown here.</p>
              </CardContent>
            </Card>
          )}

          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Item label="Appointments">{apptTotal}{apptTotal > 0 && <span className="block text-xs font-normal text-muted-foreground">{Object.entries(appointments).map(([k, v]) => `${v} ${k.toLowerCase().replace("_", " ")}`).join(", ")}</span>}</Item>
                <Item label="Paid by this user">{payments.paidCount} · {payments.paidTotal.toLocaleString()}</Item>
                <Item label="Received by this user">{payments.receivedCount} · {payments.receivedTotal.toLocaleString()}</Item>
              </dl>
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Recent events</p>
                {activity.length === 0 && <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
                {activity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{describeAction(a.action)}{a.userId !== user.id && a.user ? <span className="text-xs text-muted-foreground"> · by {a.user.name}</span> : null}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatClinicDateTime(a.createdAt)}</span>
                  </div>
                ))}
                <Link href={`/admin/activity?q=${user.id}`} className="inline-block text-xs underline">Open in activity log</Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <AccountControls userId={user.id} name={user.name} status={user.status} role={user.role} statusReason={user.statusReason} isSelf={user.id === admin.id} />
          {reviews.length > 0 && (
            <Card className="beeline-card">
              <CardHeader><CardTitle className="text-base">Verification decisions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="space-y-0.5 border-l-2 border-border pl-3 text-sm">
                    <p className="font-medium">{r.decision === "APPROVED" ? "Approved" : "Changes requested"} by {r.reviewer.name}</p>
                    <p className="text-xs text-muted-foreground">{formatClinicDateTime(r.createdAt)}</p>
                    {r.reason && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{r.reason}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
