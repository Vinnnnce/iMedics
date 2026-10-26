import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";

// Hospital Information System hub: entry points and live counts for this facility.
export default async function HisHubPage() {
  const { facility, kind, can } = await requireHisPage(null);
  const fid = facility.id;
  const [review, signature, drafts, emergency, waiting, unverified] = await Promise.all([
    prisma.clinicalDocument.count({ where: { facilityId: fid, status: "PENDING_REVIEW" } }),
    prisma.clinicalDocument.count({ where: { facilityId: fid, status: "PENDING_SIGNATURE" } }),
    prisma.clinicalDocument.count({ where: { facilityId: fid, status: "DRAFT" } }),
    prisma.encounter.count({ where: { facilityId: fid, priority: "EMERGENCY", closedAt: null } }),
    prisma.encounter.count({ where: { facilityId: fid, closedAt: null, status: { in: ["REGISTERED", "AWAITING_TRIAGE", "AWAITING_CLINICIAN"] } } }),
    prisma.payerCoverage.count({ where: { facilityId: fid, active: true, eligibility: { in: ["NOT_VERIFIED", "PENDING"] } } }),
  ]);
  const tiles = [
    { href: "/lab/clinical-documents?status=PENDING_REVIEW", label: "Awaiting review", value: review, show: can("VIEW_PATIENT_DOCUMENTS") },
    { href: "/lab/clinical-documents?status=PENDING_SIGNATURE", label: "Awaiting signature", value: signature, show: can("VIEW_PATIENT_DOCUMENTS") },
    { href: "/lab/clinical-documents?status=DRAFT", label: "Drafts", value: drafts, show: can("VIEW_PATIENT_DOCUMENTS") },
    { href: "/lab/encounters?board=emergency", label: "Emergency (open)", value: emergency, show: kind === "HOSPITAL" && can("MANAGE_ENCOUNTERS") },
    { href: "/lab/encounters?board=waiting", label: "Waiting", value: waiting, show: kind === "HOSPITAL" && can("MANAGE_ENCOUNTERS") },
    { href: "/lab/insurance?filter=pending", label: "Unverified coverage", value: unverified, show: can("MANAGE_INSURANCE") },
  ].filter((t) => t.show);
  const links = [
    { href: "/lab/clinical-documents", label: "Medical documents", desc: "Template library (groups A–P), worklists, authoring, signatures, PDF", show: can("VIEW_PATIENT_DOCUMENTS") || can("MANAGE_DOCUMENT_TEMPLATES") },
    { href: "/lab/encounters", label: "Encounters & queues", desc: "Emergency, urgent, planned, inpatient and outpatient dashboards", show: kind === "HOSPITAL" && can("MANAGE_ENCOUNTERS") },
    { href: "/lab/media", label: "Diagnostic media", desc: "Secure multi-format uploads to the patient record", show: can("UPLOAD_MEDIA") || can("VIEW_PATIENT_DOCUMENTS") },
    { href: "/lab/insurance", label: "Payer classification", desc: "Insurance, self-pay, eligibility, authorizations and claims", show: can("MANAGE_INSURANCE") },
    { href: "/lab/hospital-settings", label: "Hospital settings", desc: "Branding, numbering, terminology, triage protocol (versioned)", show: can("MANAGE_HOSPITAL_SETTINGS") },
    { href: "/lab/his-analytics", label: "Analytics", desc: "Aggregated, de-identified operational indicators", show: can("VIEW_ANALYTICS") },
  ].filter((l) => l.show);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Hospital information system</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clinical documentation, operations and diagnostic records for {facility.laboratoryName ?? "your facility"}.</p>
      </div>
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="rounded-xl border bg-card p-4 hover:bg-muted/50" data-testid={`his-tile-${t.label}`}>
              <p className="text-2xl font-bold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {links.map((l) => (
          <Card key={l.href} className="beeline-card">
            <CardContent className="p-4">
              <Link href={l.href} className="font-semibold hover:underline">{l.label}</Link>
              <p className="mt-1 text-sm text-muted-foreground">{l.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
