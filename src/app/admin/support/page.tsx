import { PageHeader } from "@/components/admin/ui";
import { SupportQueue } from "@/components/admin/support-queue";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { SUPPORT_TYPE_LABELS, isOverdue } from "@/lib/support";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const admin = await requirePageRole("ADMIN");
  const tickets = await prisma.supportTicket.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return (
    <>
      <PageHeader title="Support" description="Contact requests and problem reports. Urgent security and patient-safety reports appear first; each has a first-response deadline." />
      <SupportQueue
        tickets={tickets.map((t) => ({
          id: t.id, reference: t.reference, type: t.type, typeLabel: SUPPORT_TYPE_LABELS[t.type], status: t.status, priority: t.priority,
          subject: t.subject, message: t.message, contactName: t.contactName, contactEmail: t.contactEmail,
          signedIn: Boolean(t.reporterUserId), assignedToMe: t.assignedToId === admin.id, assigned: Boolean(t.assignedToId),
          overdue: isOverdue(t), slaDueAt: t.slaDueAt.toISOString(), createdAt: t.createdAt.toISOString(), incidentLinked: Boolean(t.securityIncidentId),
        }))}
      />
    </>
  );
}
