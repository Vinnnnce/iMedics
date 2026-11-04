import type { User } from "@prisma/client";
import { assertPlatformPolicy } from "@/lib/platform/access";
import { getStaffMembership, assertStaffCanReachPatient } from "@/lib/staff-access";
import type { DocumentRow } from "@/lib/his/documents";
/** Called after tenant selection and before returning document content or files. */
export async function assertScopedDocumentAccess(user: User, doc: DocumentRow, action = "VIEW") {
  await assertStaffCanReachPatient(await getStaffMembership(user, doc.facilityId), doc.patientId);
  await assertPlatformPolicy(user, "FEATURE", "CLINICAL_DOCUMENTS", action, doc.facilityId);
  await assertPlatformPolicy(user, "DOCUMENT", doc.templateVersion.template.code, action, doc.facilityId);
}
