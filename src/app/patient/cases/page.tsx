import Link from "next/link";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CareCaseStatus, CareCaseType } from "@prisma/client";
import { FolderOpen } from "lucide-react";

const PAGE_SIZE = 20;

const TYPE_OPTIONS: CareCaseType[] = ["CONSULTATION", "LABORATORY", "DIAGNOSTIC", "REPORT", "HOSPITAL"];
const STATUS_OPTIONS: CareCaseStatus[] = [
  "OPEN", "AWAITING_CONSULTATION", "AWAITING_INVESTIGATION", "AWAITING_RESULT",
  "RESULT_AVAILABLE", "UNDER_REVIEW", "TREATMENT_ONGOING", "FOLLOW_UP_REQUIRED",
  "CLOSED", "ARCHIVED",
];

// Patient case list: unified care episodes with filters and pagination.
// Server-rendered and scoped to the signed-in patient only.
export default async function PatientCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; page?: string }>;
}) {
  const user = await requirePageRole("PATIENT");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return <p className="p-6 text-sm">No patient record is linked to your account yet.</p>;

  const typeFilter = TYPE_OPTIONS.find((t) => t === params.type?.toUpperCase());
  const statusFilter = STATUS_OPTIONS.find((s) => s === params.status?.toUpperCase());
  const q = params.q?.trim().slice(0, 100) ?? "";

  const where = {
    patientId: patient.id,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { caseNumber: { contains: q, mode: "insensitive" as const } },
            { presentingComplaint: { contains: q, mode: "insensitive" as const } },
            { diagnosisSummary: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [cases, total] = await Promise.all([
    prisma.careCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        caseNumber: true,
        type: true,
        status: true,
        specialty: true,
        presentingComplaint: true,
        diagnosisSummary: true,
        followUpDate: true,
        createdAt: true,
        closedAt: true,
        primaryDoctor: { select: { specialty: true, user: { select: { name: true } } } },
        _count: { select: { consultations: true, labOrders: true, prescriptions: true, payments: true, facilityBookings: true, events: true } },
      },
    }),
    prisma.careCase.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Cases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every consultation, analysis, diagnostic booking and payment grouped into one care record. Case numbers follow MED1905-TYPE-YEAR-SEQUENCE.
        </p>
      </div>

      {/* Filters (server-rendered form, no JS required) */}
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="block text-xs text-muted-foreground">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Case number or keyword"
            className="ml-2 h-8 w-52 rounded-lg border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Type
          <select name="type" defaultValue={typeFilter ?? ""} className="ml-2 h-8 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{CARE_CASE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Status
          <select name="status" defaultValue={statusFilter ?? ""} className="ml-2 h-8 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{CARE_CASE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-8 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted">Filter</button>
        {(q || typeFilter || statusFilter) ? (
          <Link href="/patient/cases" className="text-sm text-muted-foreground underline">Clear</Link>
        ) : null}
      </form>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {total === 0 && !q && !typeFilter && !statusFilter
                ? "No care episodes yet. A case is created automatically when you have a consultation, lab order or facility booking."
                : "No cases match these filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/patient/cases/${c.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.caseNumber}</span>
                        <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[c.type]}</Badge>
                        <StatusChip tone={c.status === "CLOSED" || c.status === "ARCHIVED" ? "neutral" : "success"}>
                          {CARE_CASE_STATUS_LABELS[c.status]}
                        </StatusChip>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.presentingComplaint ?? c.diagnosisSummary ?? c.specialty ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opened {formatDate(c.createdAt)}
                        {c.primaryDoctor ? ` · Dr ${c.primaryDoctor.user.name}` : ""}
                        {c.followUpDate ? ` · follow-up ${formatDate(c.followUpDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground md:justify-end">
                      {c._count.consultations > 0 ? <span className="rounded-full border px-2 py-0.5">{c._count.consultations} consultation{c._count.consultations === 1 ? "" : "s"}</span> : null}
                      {c._count.labOrders > 0 ? <span className="rounded-full border px-2 py-0.5">{c._count.labOrders} lab order{c._count.labOrders === 1 ? "" : "s"}</span> : null}
                      {c._count.prescriptions > 0 ? <span className="rounded-full border px-2 py-0.5">{c._count.prescriptions} prescription{c._count.prescriptions === 1 ? "" : "s"}</span> : null}
                      {c._count.facilityBookings > 0 ? <span className="rounded-full border px-2 py-0.5">{c._count.facilityBookings} booking{c._count.facilityBookings === 1 ? "" : "s"}</span> : null}
                      {c._count.payments > 0 ? <span className="rounded-full border px-2 py-0.5">{c._count.payments} payment{c._count.payments === 1 ? "" : "s"}</span> : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages} · {total} cases</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/patient/cases?${new URLSearchParams({ ...(q ? { q } : {}), ...(typeFilter ? { type: typeFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(page - 1) })}`} className="underline">Previous</Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/patient/cases?${new URLSearchParams({ ...(q ? { q } : {}), ...(typeFilter ? { type: typeFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(page + 1) })}`} className="underline">Next</Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
