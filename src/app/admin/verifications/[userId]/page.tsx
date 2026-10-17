import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Copy } from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionPanel } from "@/components/admin/decision-panel";
import { DocumentViewer } from "@/components/admin/document-viewer";
import { PageHeader, TYPE_LABEL, UserStatusBadge, VerificationBadge, ago } from "@/components/admin/ui";
import { REJECTION_REASONS, getDossier } from "@/lib/admin/verification-review";
import { requirePageRole } from "@/lib/guards";
import { writeAudit } from "@/lib/audit";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const admin = await requirePageRole("ADMIN");
  const parsed = z.string().uuid().safeParse((await params).userId);
  if (!parsed.success) notFound();
  const dossier = await getDossier(parsed.data);
  if (!dossier) notFound();

  // Opening an application exposes identity details, so it is recorded.
  await writeAudit({ userId: admin.id, actorRole: "ADMIN", action: "ADMIN_VIEWED_USER", resourceType: "User", resourceId: dossier.user.id, details: { context: "verification" } });

  const blockers = dossier.missingDocuments.map((d) => `Missing document: ${d}`);

  return (
    <>
      <Link href="/admin/verifications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      <PageHeader
        title={dossier.user.name}
        description={`${dossier.user.accountType ? TYPE_LABEL[dossier.user.accountType] : dossier.type === "DOCTOR" ? "Doctor" : "Facility"} · registered ${formatClinicDateTime(dossier.user.createdAt)} (${ago(dossier.user.createdAt)})`}
        actions={<><VerificationBadge status={dossier.status} /><UserStatusBadge status={dossier.user.status} /></>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {(dossier.flags.length > 0 || dossier.missingFields.length > 0 || dossier.duplicates.length > 0) && (
            <Card className="beeline-card border-warning/50">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" /> Check before deciding</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {dossier.duplicates.map((d, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <Copy className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      The {d.field.toLowerCase()} <strong>{d.value}</strong> is also used by{" "}
                      <Link className="underline" href={`/admin/users/${d.other.id}`}>{d.other.name}</Link> ({d.other.status.toLowerCase()}).
                    </span>
                  </p>
                ))}
                {dossier.flags.map((f) => <p key={f}>• {f}</p>)}
                {dossier.missingFields.length > 0 && <p>• Not provided: {dossier.missingFields.join(", ")}.</p>}
              </CardContent>
            </Card>
          )}

          {dossier.sections.map((section) => (
            <Card key={section.title} className="beeline-card">
              <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <div key={f.label} className={f.label === "Biography" ? "sm:col-span-2" : undefined}>
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm font-medium">
                        {f.value ?? <span className="font-normal text-muted-foreground">Not provided</span>}
                        {f.flag && <span className="ml-2 rounded bg-warning/20 px-1.5 py-0.5 text-xs font-normal">{f.flag}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}

          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Documents ({dossier.documents.length})</CardTitle></CardHeader>
            <CardContent>
              <DocumentViewer userId={dossier.user.id} documents={dossier.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />
            </CardContent>
          </Card>

          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Terms accepted</dt><dd className="font-medium">{dossier.user.termsAcceptedAt ? `${formatClinicDateTime(dossier.user.termsAcceptedAt)} (v${dossier.user.termsVersion ?? "?"})` : "Not recorded"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Last sign-in</dt><dd className="font-medium">{dossier.user.lastLoginAt ? formatClinicDateTime(dossier.user.lastLoginAt) : "Never"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Account</dt><dd><Link className="font-medium underline" href={`/admin/users/${dossier.user.id}`}>Open full account</Link></dd></div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <DecisionPanel userId={dossier.user.id} name={dossier.user.name} status={dossier.status} checklist={dossier.checklist} blockers={blockers} reasons={REJECTION_REASONS} />

          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Review history</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {dossier.history.length === 0 && <p className="text-sm text-muted-foreground">No decisions yet.</p>}
              {dossier.history.map((h) => (
                <div key={h.id} className="space-y-0.5 border-l-2 border-border pl-3 text-sm">
                  <p className="font-medium">{h.decision === "APPROVED" ? "Approved" : "Changes requested"} by {h.reviewer.name}</p>
                  <p className="text-xs text-muted-foreground">{formatClinicDateTime(h.createdAt)}</p>
                  {h.reason && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{h.reason}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
