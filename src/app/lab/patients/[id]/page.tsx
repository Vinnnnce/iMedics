import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordsPackage } from "@/components/his/records-package";
import { requireHisPage } from "@/lib/his/page";
import { assertPatientLinked } from "@/lib/his/access";
import { groupTitle } from "@/lib/his/catalogue";
import { PRIORITY_LABEL, STATUS_LABEL as ENC_STATUS, TYPE_LABEL } from "@/lib/his/encounters";
import { MEDIA_CATEGORY_LABEL } from "@/lib/his/media-formats";
import { STATUS_LABEL } from "@/lib/his/workflow";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { formatClinicDateTime, formatDate } from "@/lib/format";

const SECTIONS = ["Demographics", "Encounters & admissions", "Documents", "Diagnostic media", "Insurance", "Timeline", "Access history"];
const anchor = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

// Longitudinal portfolio of one patient — limited to this facility's own records.
export default async function PatientPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, facility, can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try { await assertPatientLinked(facility.id, id); } catch { notFound(); }
  const fid = facility.id;
  const [patient, encounters, admissions, documents, media, coverages, access] = await Promise.all([
    prisma.patient.findUnique({ where: { id }, select: { caseNumber: true, firstName: true, middleName: true, lastName: true, gender: true, dateOfBirth: true, bloodGroup: true, ecName: true, ecRelationship: true, ecPhone: true } }),
    prisma.encounter.findMany({ where: { facilityId: fid, patientId: id }, orderBy: { registeredAt: "desc" }, take: 50 }),
    prisma.admission.findMany({ where: { facilityId: fid, patientId: id }, orderBy: { admissionDate: "desc" }, take: 50, select: { id: true, admissionDate: true, dischargeDate: true, status: true, ward: true, workingDiagnosis: true } }),
    prisma.clinicalDocument.findMany({ where: { facilityId: fid, patientId: id }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, documentNumber: true, title: true, groupCode: true, status: true, createdAt: true, sensitivity: true, releasedToPatientAt: true } }),
    prisma.medicalMedia.findMany({ where: { facilityId: fid, patientId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, category: true, examinationType: true, createdAt: true, reportStatus: true, isTherapyRecord: true } }),
    can("MANAGE_INSURANCE") ? prisma.payerCoverage.findMany({ where: { facilityId: fid, patientId: id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    can("VIEW_AUDIT") ? prisma.auditLog.findMany({ where: { facilityId: fid, patientId: id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, createdAt: true, user: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  if (!patient) notFound();
  await writeAudit({ userId: user.id, actorRole: user.role, facilityId: fid, patientId: id, action: "HIS_PORTFOLIO_VIEWED", resourceType: "Patient", resourceId: id });
  const byGroup = new Map<string, typeof documents>();
  for (const d of documents) byGroup.set(d.groupCode, [...(byGroup.get(d.groupCode) ?? []), d]);
  const timeline = [
    ...encounters.map((e) => ({ at: e.registeredAt, text: `Encounter ${e.encounterNumber} · ${TYPE_LABEL[e.type]}` })),
    ...admissions.map((a) => ({ at: a.admissionDate, text: `Admission${a.ward ? ` · ${a.ward}` : ""}` })),
    ...documents.map((d) => ({ at: d.createdAt, text: `${d.title} (${d.documentNumber}) · ${STATUS_LABEL[d.status]}` })),
    ...media.map((m) => ({ at: m.createdAt, text: `${MEDIA_CATEGORY_LABEL[m.category]}: ${m.examinationType}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 100);
  const name = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground"><Link href="/lab/his" className="hover:underline">HIS</Link> / Patients / {patient.caseNumber}</nav>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{name}</h1><p className="text-sm text-muted-foreground">{patient.caseNumber} · DOB {formatDate(patient.dateOfBirth)} · {patient.gender.toLowerCase()}</p></div>
        {can("AUTHOR_DOCUMENTS") && <Link href={`/lab/clinical-documents/new?patientId=${id}`} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">New document</Link>}
      </div>
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Portfolio sections">{SECTIONS.map((s) => <a key={s} href={`#${anchor(s)}`} className="rounded-full border px-3 py-1 hover:bg-muted">{s}</a>)}</nav>

      <section id={anchor("Demographics")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Demographics</h2>
        <p>Blood group: {patient.bloodGroup ?? "—"} · Emergency contact: {patient.ecName ? `${patient.ecName} (${patient.ecRelationship ?? ""}) ${patient.ecPhone ?? ""}` : "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Diagnoses, allergies, medications, treatment plans, nursing charts and consents are recorded in the documents below. Potential duplicate records are never merged automatically.</p>
      </section>

      <section id={anchor("Encounters & admissions")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Encounters &amp; admissions</h2>
        <ul className="mt-2 space-y-1">{encounters.map((e) => <li key={e.id}>{formatClinicDateTime(e.registeredAt)} · {e.encounterNumber} · {TYPE_LABEL[e.type]} · {PRIORITY_LABEL[e.priority]} · {ENC_STATUS[e.status]}{e.payerCategory ? ` · payer ${e.payerCategory}` : ""}</li>)}
          {admissions.map((a) => <li key={a.id}><Link className="hover:underline" href={`/lab/admissions/${a.id}`}>Admission {formatDate(a.admissionDate)}</Link> · {a.status}{a.workingDiagnosis ? ` · ${a.workingDiagnosis}` : ""}</li>)}
          {encounters.length + admissions.length === 0 && <li className="text-muted-foreground">None.</li>}</ul>
      </section>

      <section id={anchor("Documents")} className="space-y-2 rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Documents</h2>
        {[...byGroup.entries()].map(([g, docs]) => (
          <details key={g} open><summary className="cursor-pointer font-medium">{g} · {groupTitle(g)} ({docs.length})</summary>
            <ul className="ml-4 mt-1 space-y-0.5">{docs.map((d) => <li key={d.id}><Link className="hover:underline" href={`/lab/clinical-documents/${d.id}`}>{d.title}</Link> <span className="text-xs text-muted-foreground">{d.documentNumber} · {STATUS_LABEL[d.status]} · {formatDate(d.createdAt)}{d.sensitivity !== "STANDARD" ? ` · ${d.sensitivity.toLowerCase()}` : ""}{d.releasedToPatientAt ? " · released" : ""}</span></li>)}</ul>
          </details>
        ))}
        {documents.length === 0 && <p className="text-muted-foreground">No documents.</p>}
        {can("RELEASE_DOCUMENTS") && <div className="border-t pt-2"><h3 className="text-xs font-semibold">Records package export</h3><RecordsPackage patientId={id} documents={documents.filter((d) => d.status === "FINAL" || d.status === "AMENDED").map((d) => ({ id: d.id, label: `${d.documentNumber} · ${d.title}` }))} /></div>}
      </section>

      <section id={anchor("Diagnostic media")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Diagnostic media</h2>
        <ul className="mt-2 space-y-0.5">{media.map((m) => <li key={m.id}>{formatDate(m.createdAt)} · {MEDIA_CATEGORY_LABEL[m.category]} · {m.examinationType} · {m.reportStatus}{m.isTherapyRecord ? " · therapy record" : ""}</li>)}{media.length === 0 && <li className="text-muted-foreground">None.</li>}</ul>
        <Link href="/lab/media" className="text-xs text-primary hover:underline">Open diagnostic media</Link>
      </section>

      {can("MANAGE_INSURANCE") && <section id={anchor("Insurance")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Insurance &amp; billing classification</h2>
        <ul className="mt-2 space-y-0.5">{coverages.map((c) => <li key={c.id}>{c.category}{c.rank === 2 ? " (secondary)" : ""} · {c.providerName ?? ""} · {c.eligibility} · claim {c.claimStatus}{c.active ? "" : ` · ended ${c.endedAt ? formatDate(c.endedAt) : ""}`}</li>)}{coverages.length === 0 && <li className="text-muted-foreground">No classification recorded.</li>}</ul>
      </section>}

      <section id={anchor("Timeline")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Document timeline</h2>
        <ol className="mt-2 space-y-0.5">{timeline.map((t, i) => <li key={i}>{formatClinicDateTime(t.at)} · {t.text}</li>)}</ol>
      </section>

      {can("VIEW_AUDIT") && <section id={anchor("Access history")} className="rounded-xl border bg-card p-4 text-sm"><h2 className="font-semibold">Audit &amp; access history</h2>
        <ul className="mt-2 space-y-0.5 text-xs">{access.map((a) => <li key={a.id}>{formatClinicDateTime(a.createdAt)} · {a.user?.name ?? "system"} · {a.action}</li>)}</ul>
      </section>}
    </div>
  );
}
