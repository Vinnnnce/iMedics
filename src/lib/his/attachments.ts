import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { mediaVisibility } from "./visibility";
import { sectionVisible, type DocumentContent, type TemplateDefinition } from "./template-schema";

/** References, never public URLs or storage keys, are stored in document JSON. */
export async function validateAttachments(
  definition: TemplateDefinition,
  content: DocumentContent,
  context: { facilityId: string; patientId: string; sensitivity: string; canReview: boolean },
): Promise<void> {
  const fields = definition.sections.filter((s) => sectionVisible(s, content))
    .flatMap((s) => s.fields).filter((f) => (f.type === "image" || f.type === "attachment") && content[f.id]);
  if (!fields.length) return;
  const ids = [...new Set(fields.map((f) => String(content[f.id])))];
  const files = await prisma.medicalMedia.findMany({
    where: {
      id: { in: ids }, facilityId: context.facilityId, patientId: context.patientId,
      deletedAt: null, scanStatus: { not: "INFECTED" }, ...mediaVisibility(context.canReview),
    },
    select: { id: true, mimeType: true, sensitivity: true },
  });
  const byId = new Map(files.map((f) => [f.id, f]));
  const rank: Record<string, number> = { STANDARD: 0, RESTRICTED: 1, SPECIALLY_PROTECTED: 2 };
  for (const field of fields) {
    const file = byId.get(String(content[field.id]));
    if (!file || (field.type === "image" && !file.mimeType.startsWith("image/")) ||
        rank[file.sensitivity] > (rank[context.sensitivity] ?? 0)) {
      // Do not distinguish another patient's file from an unknown id.
      throw badRequest(`"${field.label}" must reference an available file of this patient with compatible type and sensitivity`);
    }
  }
}
