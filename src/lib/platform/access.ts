import type { User } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { forbidden, badRequest } from "@/lib/errors";
import { moduleForPath, policyAllows, type PolicyContext } from "./policy";

export function freshMfa(fva: unknown): boolean {
  return Array.isArray(fva) && typeof fva[0] === "number" && typeof fva[1] === "number"
    && fva[0] >= 0 && fva[0] <= 15 && fva[1] >= 0 && fva[1] <= 10;
}
export async function requireSuperAdmin(user: User) {
  if (user.role !== "ADMIN" || user.status !== "ACTIVE" || user.deletedAt) throw forbidden("Super Administrator authorization required");
  const grant = await prisma.superAdminGrant.findUnique({ where: { userId: user.id } });
  if (!grant || grant.revokedAt || (grant.expiresAt && grant.expiresAt <= new Date())) throw forbidden("Explicit Super Administrator grant required");
  const session = await auth();
  if (!freshMfa(session.sessionClaims?.fva)) throw forbidden("Fresh multi-factor authentication required. Reauthenticate with MFA before using master control.");
  return grant;
}

export async function policyContext(user: User, facilityId?: string): Promise<PolicyContext> {
  let facilityType: string | null = null;
  let facilityRole: string | null = null;
  if (facilityId) {
    const membership = await prisma.facilityStaff.findFirst({ where: { userId: user.id, facilityId, status: "ACTIVE" }, select: { facilityRole: true, facility: { select: { kind: true } } } });
    if (!membership) throw forbidden("Active membership required for this facility");
    facilityType = membership.facility.kind;
    facilityRole = membership.facilityRole;
  }
  const subscription = facilityId ? null : await prisma.doctorSubscription.findFirst({ where: { doctor: { userId: user.id }, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, select: { planId: true } });
  return { accountType: user.accountType, role: user.role, country: user.country, facilityId, facilityType, facilityRole, subscriptionPlanId: subscription?.planId };
}

export async function assertPlatformPolicy(user: User, kind: string, resource: string, action: string, facilityId?: string) {
  const policies = await prisma.platformPolicy.findMany({
    where: { kind, resource: { in: [resource, "*"] } }, orderBy: { revision: "desc" },
    distinct: ["key"],
  });
  if (!policies.length) return;
  const context = await policyContext(user, facilityId);
  if (policies.some((p) => !policyAllows(p, context, action))) throw forbidden("Access restricted by platform policy. Check your role, subscription or availability dates.");
}

export async function enforceRequestPolicy(user: User, req: Request, selectedFacilityId?: string) {
  const path = new URL(req.url).pathname;
  // Policy administration must remain reachable so restrictions can be reversed.
  if (path.startsWith("/api/admin/")) return;
  const featureModule = moduleForPath(path);
  if (!featureModule) return;
  const facilityId = selectedFacilityId ?? new URL(req.url).searchParams.get("facilityId") ?? req.headers.get("x-facility-id") ?? undefined;
  const action = /\/(pdf|download|export|files?)(\/|$)/.test(path) || new URL(req.url).searchParams.get("download") === "1" || (path.includes("/workspace/documents") && new URL(req.url).searchParams.has("id")) || (path.startsWith("/api/patient/media/") && req.method === "GET") ? "DOWNLOAD" : /\/print(\/|$)/.test(path) ? "PRINT" : req.method === "GET" ? "VIEW" : req.method === "POST" ? "CREATE" : "EDIT";
  await assertPlatformPolicy(user, "FEATURE", featureModule, action, facilityId);
  if (featureModule === "CLINICAL_DOCUMENTS" || featureModule === "DOCUMENT_TEMPLATES" || path.startsWith("/api/files/") || path.startsWith("/api/patient/media/")) {
    let documentAction = action;
    let resource = "*";
    if (req.method === "POST" || req.method === "PATCH") {
      const body = await req.clone().json().catch(() => null) as { action?: string; templateId?: string } | null;
      if (body?.action === "sign") documentAction = "SIGN";
      if (["approve", "finalize", "review"].includes(body?.action ?? "")) documentAction = "APPROVE";
      if (body?.templateId && /^[0-9a-f-]{36}$/i.test(body.templateId)) {
        const template = await prisma.clinicalDocumentTemplate.findUnique({ where: { id: body.templateId }, select: { code: true } });
        if (template) resource = template.code;
      }
    }
    const documentId = path.match(/\/(?:documents|clinical-documents|hospital-documents)\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
    if (documentId && /(?:clinical-documents|his\/documents|hospital-documents)/.test(path)) {
      const doc = await prisma.clinicalDocument.findUnique({ where: { id: documentId }, select: { templateVersion: { select: { template: { select: { code: true } } } } } });
      if (doc) resource = doc.templateVersion.template.code;
    }
    if (resource !== "*") await assertPlatformPolicy(user, "DOCUMENT", resource, documentAction, facilityId);
    else {
      // Fail closed for list/export/batch/legacy paths lacking a template identity:
      // never leak restricted records through a collection or alternate file endpoint.
      const all = await prisma.platformPolicy.findMany({ where: { kind: "DOCUMENT" }, orderBy: { revision: "desc" }, distinct: ["key"] });
      if (all.length) {
        const context = await policyContext(user, facilityId);
        if (all.some((p) => !policyAllows(p, context, documentAction))) throw forbidden("Document collection restricted by platform policy. Request an individually authorized document.");
      }
    }
  }
}

export function confirmSensitive(input: { confirmation: string; reason: string }, expected: string) {
  if (input.confirmation !== expected || input.reason.trim().length < 15) throw badRequest(`Type ${expected} and provide a reason of at least 15 characters`);
}
