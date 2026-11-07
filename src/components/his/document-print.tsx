import type { DocumentView } from "@/lib/his/documents";
import { displayValue } from "@/lib/his/documents";
import { formatClinicDateTime } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = {
  AUTHOR: "Author / responsible clinician", CO_SIGNER: "Co-signatory", REVIEWER: "Reviewer", VERIFIER: "Verifying clinician",
  DEPARTMENT_HEAD: "Head of department", PATIENT: "Patient", AUTHORIZED_REPRESENTATIVE: "Authorized representative",
  CLINICIAN_OBTAINING_CONSENT: "Clinician obtaining consent", WITNESS: "Witness", INTERPRETER: "Interpreter",
};

/** Print-friendly rendering of a clinical document (A4, letterhead, signature block, watermark). */
export function DocumentPrint({ view }: { view: DocumentView }) {
  const valid = view.signatures.filter((s) => s.valid);
  return (
    <article className="relative mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow print:max-w-none print:p-0 print:shadow-none" data-testid="document-print">
      {view.watermark && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-30 text-4xl font-bold text-red-500/20">{view.watermark}</span>
        </div>
      )}
      <header className="border-b pb-3">
        {view.facility.logoUrl && /^https:\/\//.test(view.facility.logoUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.facility.logoUrl} alt="" className="mb-2 h-12 w-auto" />
        )}
        <h1 className="text-lg font-bold">{view.facility.name}</h1>
        {view.facility.letterhead.map((l) => <p key={l} className="text-xs text-neutral-600">{l}</p>)}
        {view.facility.address && <p className="text-xs text-neutral-600">{view.facility.address}</p>}
        {view.facility.contact && <p className="text-xs text-neutral-600">{view.facility.contact}</p>}
        <p className="mt-2 text-xs">
          Patient: <strong>{view.patient.name}</strong> · {view.patient.caseNumber} · DOB {view.patient.dateOfBirth} · {view.patient.gender.toLowerCase()}
          {view.encounterNumber ? ` · Encounter ${view.encounterNumber}` : ""}
        </p>
      </header>
      <h2 className="mt-4 text-xl font-bold">{view.title}</h2>
      <p className="text-xs text-neutral-600">
        {view.groupTitle} · {view.documentNumber} · revision {view.revision} · template v{view.templateVersion} · <strong>{view.statusLabel}</strong>
        {view.department ? ` · ${view.department}` : ""}
      </p>
      {view.supersedes && <p className="mt-1 text-xs font-semibold text-amber-700">Amendment of {view.supersedes.documentNumber}. Reason: {view.amendmentReason}</p>}
      {view.supersededBy && <p className="mt-1 text-xs font-semibold text-red-700">Superseded by amendment {view.supersededBy.documentNumber}.</p>}
      {view.sections.map((s) => (
        <section key={s.id} className="mt-4 break-inside-avoid-page">
          <h3 className="border-b text-sm font-semibold">{s.title}</h3>
          <dl className="mt-1 space-y-1">
            {s.fields.map((f) => (
              <div key={f.id}>
                <dt className="text-xs font-semibold text-neutral-700">{f.label}</dt>
                <dd className="whitespace-pre-wrap">
                  {f.type === "table" ? (
                    Array.isArray(f.value) && f.value.length ? (
                      <table className="mt-1 w-full border-collapse text-xs">
                        <thead><tr>{(f.columns ?? []).map((c) => <th key={c} className="border px-1 text-left">{c}</th>)}</tr></thead>
                        <tbody>{(f.value as string[][]).map((row, i) => <tr key={i}>{(f.columns ?? []).map((_, ci) => <td key={ci} className="border px-1">{row[ci] ?? ""}</td>)}</tr>)}</tbody>
                      </table>
                    ) : "—"
                  ) : displayValue(f.value, f.unit)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className="mt-6 break-inside-avoid border-t pt-3 text-xs">
        <h3 className="text-sm font-semibold">Authorship, verification and signatures</h3>
        <p>Author: {view.author.name} · created {formatClinicDateTime(view.createdAt)}</p>
        <p>{view.reviewedAt ? `Clinically verified by ${view.reviewedByName ?? "—"} at ${formatClinicDateTime(view.reviewedAt)}` : "Clinical verification: not performed / not required"}</p>
        {valid.length === 0 && <p className="font-semibold text-red-700">No signatures recorded.</p>}
        <ul className="mt-1 space-y-1">
          {valid.map((s) => (
            <li key={s.id}>
              <strong>{ROLE_LABEL[s.role] ?? s.role}:</strong> {s.signerName}{s.signerTitle ? `, ${s.signerTitle}` : ""}{s.registrationId ? ` · Reg. ${s.registrationId}` : ""}{s.relationship ? ` · ${s.relationship}` : ""}
              <span className="block text-neutral-600">{s.method === "HANDWRITTEN_ATTESTED" ? "Handwritten signature on paper, attested by staff" : "Authenticated electronic signature"} · {formatClinicDateTime(s.signedAt)} · ref {s.id.slice(0, 8)}</span>
            </li>
          ))}
          {view.missingSignatureLabels.map((m) => <li key={m} className="text-red-700">{m}: NOT SIGNED</li>)}
        </ul>
        <p className="mt-1 text-neutral-600">{view.status === "FINAL" || view.status === "AMENDED" ? `Finalized ${formatClinicDateTime(view.finalizedAt!)} · content SHA-256 ${view.contentHash}` : "This document is not finalized."}</p>
        {view.definition.output.footerNote && <p className="text-neutral-600">{view.definition.output.footerNote}</p>}
        {view.facility.footer && <p className="text-neutral-600">{view.facility.footer}</p>}
      </section>
    </article>
  );
}
