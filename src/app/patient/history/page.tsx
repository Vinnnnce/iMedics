import Link from "next/link";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CareCaseType } from "@prisma/client";

const PAGE_SIZE = 30;

type TimelineKind =
  | "consultation"
  | "lab"
  | "prescription"
  | "appointment"
  | "payment"
  | "document";

const KIND_OPTIONS: { value: TimelineKind; label: string }[] = [
  { value: "consultation", label: "Consultations" },
  { value: "lab", label: "Lab analyses" },
  { value: "prescription", label: "Prescriptions" },
  { value: "appointment", label: "Appointments" },
  { value: "payment", label: "Payments" },
  { value: "document", label: "Documents" },
];

type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  title: string;
  date: Date;
  status: string;
  caseId: string | null;
  caseNumber: string | null;
  caseType: CareCaseType | null;
  doctorName: string | null;
  details: string[];
};

// Patient health timeline: chronological view of the longitudinal record with
// record-type, date-range, keyword and case-number filters, expandable entries
// and pagination. Every query is scoped to the signed-in patient; only records
// the patient may already see (finalized consultations, verified results,
// released documents) appear.
export default async function PatientHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; from?: string; to?: string; q?: string; case?: string; doctor?: string; page?: string }>;
}) {
  const user = await requirePageRole("PATIENT");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return <p className="p-6 text-sm">No patient record is linked to your account yet.</p>;

  const kindFilter = KIND_OPTIONS.find((k) => k.value === params.kind)?.value;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const caseFilter = params.case?.trim().slice(0, 40) ?? "";
  const doctorFilter = params.doctor?.trim().slice(0, 100) ?? "";
  const fromDate = params.from ? new Date(params.from) : null;
  const toDate = params.to ? new Date(params.to) : null;
  const from = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  // Include the whole end day.
  const to = toDate && !Number.isNaN(toDate.getTime()) ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59) : null;

  const inRange = (d: Date) => (!from || d >= from) && (!to || d <= to);
  const matches = (text: string | null | undefined) => (!q || (text ?? "").toLowerCase().includes(q.toLowerCase()));

  const [consultations, labOrders, prescriptions, appointments, payments, documents] = await Promise.all([
    prisma.consultation.findMany({
      where: { patientId: patient.id, status: "FINALIZED" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        case: { select: { id: true, caseNumber: true, type: true } },
        doctor: { select: { user: { select: { name: true } } } },
        diagnoses: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], select: { code: true, description: true, isPrimary: true } },
      },
    }),
    prisma.labOrder.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { case: { select: { id: true, caseNumber: true, type: true } }, items: { include: { labTest: true } }, results: { select: { id: true, status: true } } },
    }),
    prisma.prescription.findMany({
      where: { patientId: patient.id },
      orderBy: { issuedAt: "desc" },
      take: 200,
      include: { case: { select: { id: true, caseNumber: true, type: true } }, items: true, doctor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.appointment.findMany({
      where: { patientId: patient.id },
      orderBy: { scheduledAt: "desc" },
      take: 200,
      include: {
        consultations: { select: { case: { select: { id: true, caseNumber: true, type: true } } }, take: 1 },
        doctor: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { payerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        case: { select: { id: true, caseNumber: true, type: true } },
        appointment: { include: { consultations: { select: { case: { select: { id: true, caseNumber: true, type: true } } }, take: 1 } } },
      },
    }),
    prisma.$queryRaw<Array<{ id: string; file_name: string; created_at: Date }>>`
      SELECT d.id, d.file_name, d.created_at
      FROM workspace_documents d
      WHERE d.owner_id = ${user.id} AND d.confirmed_at IS NOT NULL
      ORDER BY d.created_at DESC
      LIMIT 200`,
  ]);

  const entries: TimelineEntry[] = [];

  for (const c of consultations) {
    entries.push({
      id: `consultation-${c.id}`,
      kind: "consultation",
      title: `Consultation · Dr ${c.doctor.user.name}`,
      date: c.createdAt,
      status: "finalized",
      caseId: c.case?.id ?? null,
      caseNumber: c.case?.caseNumber ?? null,
      caseType: c.case?.type ?? null,
      doctorName: c.doctor.user.name,
      details: [
        c.chiefComplaint ?? null,
        c.diagnosis ?? null,
        ...c.diagnoses.map((d) => `${d.code} ${d.description}${d.isPrimary ? " (primary)" : ""}`),
      ].filter((d): d is string => Boolean(d)),
    });
  }

  for (const o of labOrders) {
    entries.push({
      id: `lab-${o.id}`,
      kind: "lab",
      title: `Lab order · ${(o.panelType ?? (o.items.map((i) => i.labTest.name).join(", ") || "tests"))}`,
      date: o.createdAt,
      status: o.status.toLowerCase(),
      caseId: o.case?.id ?? null,
      caseNumber: o.case?.caseNumber ?? null,
      caseType: o.case?.type ?? null,
      doctorName: null,
      details: [
        o.items.map((i) => i.labTest.name).join(", "),
        o.results.length > 0 ? `${o.results.length} result${o.results.length === 1 ? "" : "s"} recorded` : "Results pending",
      ].filter(Boolean),
    });
  }

  for (const p of prescriptions) {
    entries.push({
      id: `prescription-${p.id}`,
      kind: "prescription",
      title: `Prescription · Dr ${p.doctor.user.name}`,
      date: p.issuedAt,
      status: p.status.toLowerCase(),
      caseId: p.case?.id ?? null,
      caseNumber: p.case?.caseNumber ?? null,
      caseType: p.case?.type ?? null,
      doctorName: p.doctor.user.name,
      details: [p.items.map((i) => `${i.drugName}${i.dose ? ` ${i.dose}` : ""}${i.frequency ? `, ${i.frequency}` : ""}`).join("; ")],
    });
  }

  for (const a of appointments) {
    const careCase = a.consultations[0]?.case ?? null;
    entries.push({
      id: `appointment-${a.id}`,
      kind: "appointment",
      title: `Appointment · Dr ${a.doctor.user.name}`,
      date: a.scheduledAt,
      status: a.status.toLowerCase().replace("_", " "),
      caseId: careCase?.id ?? null,
      caseNumber: careCase?.caseNumber ?? null,
      caseType: careCase?.type ?? null,
      doctorName: a.doctor.user.name,
      details: [
        a.reason ?? null,
        a.mode.toLowerCase(),
      ].filter((d): d is string => Boolean(d)),
    });
  }

  for (const p of payments) {
    const careCase = p.case ?? p.appointment?.consultations[0]?.case ?? null;
    entries.push({
      id: `payment-${p.id}`,
      kind: "payment",
      title: `Payment · ${p.description ?? p.kind.toLowerCase().replace(/_/g, " ")}`,
      date: p.createdAt,
      status: p.status.toLowerCase(),
      caseId: careCase?.id ?? null,
      caseNumber: careCase?.caseNumber ?? null,
      caseType: careCase?.type ?? null,
      doctorName: null,
      details: [new Intl.NumberFormat("en", { style: "currency", currency: p.currency }).format(Number(p.amount))],
    });
  }

  for (const d of documents) {
    entries.push({
      id: `document-${d.id}`,
      kind: "document",
      title: `Document · ${d.file_name}`,
      date: new Date(d.created_at),
      status: "uploaded",
      caseId: null,
      caseNumber: null,
      caseType: null,
      doctorName: null,
      details: [],
    });
  }

  const filtered = entries
    .filter((e) => (!kindFilter || e.kind === kindFilter))
    .filter((e) => inRange(e.date))
    .filter((e) => !caseFilter || (e.caseNumber ?? "").toLowerCase().includes(caseFilter.toLowerCase()))
    .filter((e) => !doctorFilter || (e.doctorName ?? "").toLowerCase().includes(doctorFilter.toLowerCase()))
    .filter((e) => !q || matches(e.title) || e.details.some(matches) || (e.caseNumber ?? "").toLowerCase().includes(q.toLowerCase()))
    // Global chronological order with a deterministic tie-breaker, applied
    // before pagination so pages interleave record types correctly.
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const query = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (kindFilter) sp.set("kind", kindFilter);
    if (caseFilter) sp.set("case", caseFilter);
    if (doctorFilter) sp.set("doctor", doctorFilter);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    sp.set("page", String(p));
    return `/patient/history?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Case History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your chronological care record. Filter by type, date range, keyword or case number.
        </p>
      </div>

      {/* Filters (server-rendered form, no JS required) */}
      <form className="grid gap-2 sm:grid-cols-2 md:grid-cols-6 md:items-end" method="get">
        <label className="block text-xs text-muted-foreground">
          Search
          <input name="q" defaultValue={q} placeholder="Keyword or case number" className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Type
          <select name="kind" defaultValue={kindFilter ?? ""} className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">All records</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Case number
          <input name="case" defaultValue={caseFilter} placeholder="MED1905-…" className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Doctor
          <input name="doctor" defaultValue={doctorFilter} placeholder="Doctor name" className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="block text-xs text-muted-foreground">
          From
          <input type="date" name="from" defaultValue={params.from ?? ""} className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="block text-xs text-muted-foreground">
          To
          <input type="date" name="to" defaultValue={params.to ?? ""} className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className="h-8 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted">Filter</button>
          <Link href="/patient/history" className="text-sm text-muted-foreground underline">Clear</Link>
        </div>
      </form>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {total === 0 && !q && !kindFilter && !caseFilter && !from && !to
              ? "Your health timeline will appear here as you have consultations, lab orders, prescriptions and payments."
              : "No records match these filters."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => (
            <li key={e.id}>
              <Card>
                <CardContent className="p-4">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-lg capitalize">{e.kind === "lab" ? "lab analysis" : e.kind}</Badge>
                        <span className="font-medium">{e.title}</span>
                        {e.caseNumber && e.caseId ? (
                          <Link href={`/patient/cases/${e.caseId}`} className="text-xs underline-offset-2 hover:underline">{e.caseNumber}</Link>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip tone={e.kind === "payment" ? (e.status.includes("succeed") ? "success" : e.status.includes("fail") ? "danger" : "neutral") : "neutral"}>{e.status}</StatusChip>
                        <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                      </div>
                    </summary>
                    {e.details.length > 0 ? (
                      <div className="mt-2 space-y-1 border-t pt-2 text-sm text-muted-foreground">
                        {e.details.map((d, i) => (
                          <p key={i}>{d}</p>
                        ))}
                      </div>
                    ) : null}
                  </details>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages} · {total} records</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={query(page - 1)} className="underline">Previous</Link>
            ) : null}
            {page < totalPages ? (
              <Link href={query(page + 1)} className="underline">Next</Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
