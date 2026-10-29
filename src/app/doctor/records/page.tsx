import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/lib/documents";

/**
 * Documents a doctor can see: those attached for their assigned patients and
 * those patients shared with them. Download links are presigned per request
 * after the access check.
 */
export default async function DoctorRecordsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getVerifiedDoctorProfile(user);

  const [assignedPatients, shared] = await Promise.all([
    prisma.patient.findMany({ take: 500,
      where: { deletedAt: null, assignments: { some: { doctorId: doctor.id } } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.documentShare.findMany({ take: 500,
      where: { sharedWithUserId: user.id, revokedAt: null, document: { deletedAt: null } },
      include: { document: { include: { patient: true } } },
    }),
  ]);

  const documents = await prisma.patientDocument.findMany({
    where: { patientId: { in: assignedPatients.map((p) => p.id) }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { patient: true },
  });

  const patientName = (id: string) => {
    const p = assignedPatients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : "Patient";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Patient documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports attached for your assigned patients and documents patients shared with you. Every download is logged.
        </p>
      </div>

      {documents.length === 0 && shared.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents available yet.</p>
      )}

      <div className="space-y-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="beeline-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {patientName(doc.patientId)} · {DOCUMENT_CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category}
                  {doc.issuedOn ? ` · issued ${new Date(doc.issuedOn).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Link href={`/api/patient/documents/${doc.id}?download=1`} className="text-sm underline" prefetch={false}>
                <Download className="inline h-4 w-4" aria-hidden="true" /> Download
              </Link>
            </CardContent>
          </Card>
        ))}
        {shared.map((share) => (
          <Card key={share.id} className="beeline-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{share.document.title}</p>
                <p className="text-xs text-muted-foreground">
                  {share.document.patient.firstName} {share.document.patient.lastName} · shared with you
                </p>
              </div>
              <Badge variant="outline" className="rounded-lg">{share.role.toLowerCase()}</Badge>
              <Link href={`/api/patient/documents/${share.document.id}?download=1`} className="text-sm underline" prefetch={false}>
                <Download className="inline h-4 w-4" aria-hidden="true" /> Download
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
