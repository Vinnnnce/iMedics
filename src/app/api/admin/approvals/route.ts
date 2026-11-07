import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission, getAdminAccess } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { badRequest, notFound, conflict, forbidden } from "@/lib/errors";

/**
 * Approval workflows: configurable gates for sensitive administrative actions.
 * The requester can never approve their own request, and dual-approval
 * workflows require two distinct approvers holding the configured roles.
 */

async function holdsRoleKey(userId: string, roleKey: string) {
  const assignment = await prisma.adminRoleAssignment.findFirst({
    where: {
      userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      role: { key: roleKey, active: true },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "APPROVALS", "VIEW");
  const now = new Date();
  const [workflows, requests] = await Promise.all([
    prisma.approvalWorkflow.findMany({
      orderBy: { actionKey: "asc" },
      select: { id: true, actionKey: true, name: true, description: true, approverRoleKey: true, secondApproverRoleKey: true, requiresReauth: true, active: true, _count: { select: { requests: true } } },
    }),
    prisma.approvalRequest.findMany({
      orderBy: { createdAt: "desc" }, take: 200,
      select: {
        id: true, actionKey: true, payload: true, reason: true, status: true, createdAt: true, decidedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        workflow: { select: { name: true, approverRoleKey: true, secondApproverRoleKey: true } },
        decisions: { select: { decision: true, reason: true, createdAt: true, decider: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const actionable = await Promise.all(requests.filter((r) => r.status === "PENDING").map(async (r) => ({
    id: r.id,
    canDecide: r.requester.id !== user.id && (
      (r.decisions.length === 0 && (await holdsRoleKey(user.id, r.workflow.approverRoleKey)))
      || (r.workflow.secondApproverRoleKey && r.decisions.length === 1 && r.decisions[0].decision === "APPROVE" && (await holdsRoleKey(user.id, r.workflow.secondApproverRoleKey)))
    ),
  })));
  return NextResponse.json({ workflows, requests, actionable, now: now.toISOString() });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("UPSERT_WORKFLOW"), id: z.string().uuid().optional(), actionKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,60}$/), name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).default(""), approverRoleKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,60}$/), secondApproverRoleKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,60}$/).nullable().optional(), requiresReauth: z.boolean().default(true), active: z.boolean().default(true) }),
  z.object({ action: z.literal("DELETE_WORKFLOW"), id: z.string().uuid() }),
  z.object({ action: z.literal("SUBMIT_REQUEST"), actionKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,60}$/), payload: z.record(z.string(), z.unknown()).default({}), reason: z.string().trim().min(15).max(2000) }),
  z.object({ action: z.literal("DECIDE"), requestId: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(15).max(2000) }),
  z.object({ action: z.literal("CANCEL_REQUEST"), requestId: z.string().uuid(), reason: z.string().trim().min(5).max(2000) }),
]);

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  if (body.action === "UPSERT_WORKFLOW" || body.action === "DELETE_WORKFLOW") await requireAdminPermission(user, "APPROVALS", "MANAGE");
  else if (body.action === "SUBMIT_REQUEST") await requireAdminPermission(user, "APPROVALS", "VIEW");
  else if (body.action === "DECIDE") await requireAdminPermission(user, "APPROVALS", body.decision === "APPROVE" ? "APPROVE" : "REJECT");
  else await requireAdminPermission(user, "APPROVALS", "VIEW");
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "UPSERT_WORKFLOW": {
        if (body.secondApproverRoleKey && body.secondApproverRoleKey === body.approverRoleKey) throw badRequest("A dual-approval workflow needs two different approver roles");
        const existing = body.id ? await tx.approvalWorkflow.findUnique({ where: { id: body.id } }) : await tx.approvalWorkflow.findUnique({ where: { actionKey: body.actionKey } });
        if (body.id && !existing) throw notFound("Workflow not found");
        const data = { actionKey: body.actionKey, name: body.name, description: body.description, approverRoleKey: body.approverRoleKey, secondApproverRoleKey: body.secondApproverRoleKey ?? null, requiresReauth: body.requiresReauth, active: body.active };
        const wf = existing ? await tx.approvalWorkflow.update({ where: { id: existing.id }, data }) : await tx.approvalWorkflow.create({ data });
        await controlAudit(tx, user.id, null, "APPROVAL_WORKFLOW_SAVED", wf.id, { before: existing ? { name: existing.name, approverRoleKey: existing.approverRoleKey, active: existing.active } : null, after: { name: wf.name, approverRoleKey: wf.approverRoleKey, secondApproverRoleKey: wf.secondApproverRoleKey, active: wf.active } });
        return wf;
      }
      case "DELETE_WORKFLOW": {
        const wf = await tx.approvalWorkflow.findUnique({ where: { id: body.id } });
        if (!wf) throw notFound("Workflow not found");
        const pending = await tx.approvalRequest.count({ where: { workflowId: wf.id, status: "PENDING" } });
        if (pending > 0) throw conflict("The workflow still has pending requests");
        try {
          await tx.approvalWorkflow.delete({ where: { id: wf.id } });
        } catch {
          throw conflict("The workflow has historical requests and cannot be deleted. Deactivate it instead.");
        }
        await controlAudit(tx, user.id, null, "APPROVAL_WORKFLOW_DELETED", wf.id, { actionKey: wf.actionKey });
        return { deleted: true };
      }
      case "SUBMIT_REQUEST": {
        const wf = await tx.approvalWorkflow.findUnique({ where: { actionKey: body.actionKey } });
        if (!wf || !wf.active) throw notFound("No active approval workflow for this action");
        const duplicate = await tx.approvalRequest.findFirst({ where: { actionKey: body.actionKey, requesterId: user.id, status: "PENDING" } });
        if (duplicate) throw conflict("You already have a pending request for this action");
        const r = await tx.approvalRequest.create({ data: { workflowId: wf.id, actionKey: body.actionKey, requesterId: user.id, payload: body.payload as Prisma.InputJsonValue, reason: body.reason } });
        await controlAudit(tx, user.id, null, "APPROVAL_REQUEST_SUBMITTED", r.id, { actionKey: body.actionKey, reason: body.reason });
        return r;
      }
      case "DECIDE": {
        const r = await tx.approvalRequest.findUnique({ where: { id: body.requestId }, include: { workflow: true, decisions: true } });
        if (!r) throw notFound("Request not found");
        if (r.status !== "PENDING") throw conflict(`Request is already ${r.status.toLowerCase()}`);
        if (r.requesterId === user.id) throw forbidden("The requester cannot approve or reject their own request");
        if (r.decisions.some((d) => d.deciderId === user.id)) throw conflict("You have already decided on this request");
        const access = await getAdminAccess(user);
        const firstDone = r.decisions.length > 0;
        const requiredRole = firstDone ? r.workflow.secondApproverRoleKey : r.workflow.approverRoleKey;
        const allowed = access?.superAdmin || (requiredRole ? await holdsRoleKey(user.id, requiredRole) : false);
        if (!allowed) throw forbidden(`This decision requires the ${requiredRole ?? "configured"} role${firstDone ? " for the second approval" : ""}.`);
        await tx.approvalDecision.create({ data: { requestId: r.id, deciderId: user.id, decision: body.decision, reason: body.reason } });
        const complete = body.decision === "REJECT" || !r.workflow.secondApproverRoleKey || firstDone;
        const status = body.decision === "REJECT" ? "REJECTED" : complete ? "APPROVED" : "PENDING";
        await tx.approvalRequest.update({ where: { id: r.id }, data: { status, decidedAt: status === "PENDING" ? null : new Date() } });
        await controlAudit(tx, user.id, null, body.decision === "APPROVE" ? "APPROVAL_REQUEST_APPROVED" : "APPROVAL_REQUEST_REJECTED", r.id, { actionKey: r.actionKey, decision: body.decision, dualApproval: Boolean(r.workflow.secondApproverRoleKey), status, reason: body.reason });
        return { id: r.id, status };
      }
      case "CANCEL_REQUEST": {
        const r = await tx.approvalRequest.findUnique({ where: { id: body.requestId } });
        if (!r) throw notFound("Request not found");
        if (r.requesterId !== user.id) throw forbidden("Only the requester can cancel a request");
        if (r.status !== "PENDING") throw conflict("Only pending requests can be cancelled");
        await tx.approvalRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", decidedAt: new Date() } });
        await controlAudit(tx, user.id, null, "APPROVAL_REQUEST_CANCELLED", r.id, { actionKey: r.actionKey, reason: body.reason });
        return { cancelled: true };
      }
    }
  }) }, { status: 201 });
});
