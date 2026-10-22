import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { permissionsForRole } from "@/lib/facility-staff";
import { prisma } from "@/lib/prisma";
import { FacilityTemplateManager } from "@/components/lab/facility-template-manager";

export default async function FacilityDocumentTemplatesPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  // MANAGE_DOCUMENT_TEMPLATES is required to manage the facility's templates.
  const memberships = await prisma.facilityStaff.findMany({
    where: { userId: user.id, facilityId: profile.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { facilityRole: true },
  });
  const canManage = memberships.some(m => permissionsForRole(m.facilityRole).includes("MANAGE_DOCUMENT_TEMPLATES"));
  if (!canManage) redirect("/lab/dashboard");

  const templates = await prisma.facilityDocumentTemplate.findMany({
    where: { facilityId: profile.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, kind: true, content: true, updatedAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Document templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customise the structure of the medical documents your facility issues —
          lab reports, referral forms, case notes, imaging and diagnostic reports,
          discharge summaries, epicrises, admission and progress notes, and transfer
          summaries. Templates hold structure only (field prompts); never patient data.
        </p>
      </div>
      <FacilityTemplateManager
        templates={templates.map(t => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
          content: t.content,
          updatedAt: t.updatedAt.toISOString(),
          createdBy: t.createdBy.name,
        }))}
      />
    </div>
  );
}
