import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import type { AcceptanceManifest } from "./his-fixtures.ts";

type ClerkApi = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
type Check = { id: number; name: string; status: "PASS" | "FAIL" | "BLOCKED"; detail: string };
class Blocked extends Error {}
function assert(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error(detail); }
const checks = [
  "Administrator custom template", "Publication, version and hospital isolation", "Author/reviewer/signature/final workflow",
  "Protected PDF generation", "Laboratory upload and verification", "Radiology patient linkage", "Patient released report",
  "Other-patient denial", "Other-hospital denial", "Unsafe upload rejection", "Consent ceremony",
  "Amendment preserves original", "Insurance change preserves encounter", "Emergency and planned boards",
  "Backend role enforcement", "Protected image viewing", "Critical audit records", "Existing-feature browser regression",
  "Nursing observation recording", "Care task lifecycle and completion stamp",
  "Medication orders with configured interaction and allergy alerts", "MAR administration recording",
  "E-prescribing outbox boundary",
];

export async function runLiveAcceptance(manifest: AcceptanceManifest, db: PrismaClient, clerk: ClerkApi, file: string) {
  if (manifest.mode !== "clerk-test" || new Date(manifest.expiresAt) <= new Date()) throw new Error("Live acceptance requires an unexpired Clerk-test manifest");
  const sessions = new Map<string, string>();
  const results: Check[] = [];
  const facility = (hospital: "a" | "b" = "a") => manifest.facilities.find((f) => f.hospital === hospital)!;
  const user = (role: string, hospital: "a" | "b" = "a") => manifest.users.find((u) => u.hospital === hospital && u.role === role)!;
  const call = async (role: string, path: string, method = "GET", body?: unknown, hospital: "a" | "b" = "a") => {
    const identity = user(role, hospital);
    assert(identity, "Missing synthetic identity");
    let session = sessions.get(identity.clerkId);
    if (!session) {
      session = (await clerk<{ id: string }>("/sessions", "POST", { user_id: identity.clerkId })).id;
      sessions.set(identity.clerkId, session);
    }
    const token = (await clerk<{ jwt: string }>(`/sessions/${encodeURIComponent(session)}/tokens`, "POST", { expires_in_seconds: 60 })).jwt;
    return fetch(new URL(path, manifest.baseUrl), {
      method, redirect: "manual", signal: AbortSignal.timeout(60_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-facility-id": facility(hospital).id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };
  const check = async (id: number, operation: () => Promise<void>) => {
    try { await operation(); results.push({ id, name: checks[id - 1], status: "PASS", detail: "Observed expected live response and scoped database state" }); }
    catch (error) { results.push({ id, name: checks[id - 1], status: error instanceof Blocked ? "BLOCKED" : "FAIL", detail: error instanceof Error ? error.message : "Check failed" }); }
    // This report contains statuses only. No JWTs, upload URLs, PDF contents,
    // clinical content or provider response bodies are serialized.
    await writeFile(file, JSON.stringify({ runId: manifest.runId, baseUrl: manifest.baseUrl, checkedAt: new Date().toISOString(), syntheticOnly: true, checks: results }, null, 2), { mode: 0o600 });
  };
  let templateId = "", docId = "", labMediaId = "", imageId = "";
  let preflightComplete = false;
  const requireDoc = () => { if (!docId) throw new Blocked("Document setup did not complete"); };
  const action = (role: string, body: unknown) => call(role, `/api/facility/his/documents/${docId}/actions`, "POST", body);
  const definition = {
    sections: [{ id: "assessment", title: "SYNTHETIC ACCEPTANCE ONLY", fields: [{ id: "note", label: "Synthetic assessment", type: "textarea", required: true, locked: true }] }],
    signatures: [{ role: "AUTHOR", label: "Synthetic authenticated author", required: true, locked: true }],
    workflow: { requiresReview: true, independentReview: true },
  };
  const upload = async (role: string, bytes: Uint8Array, name: string, mime: string, category: string) => {
    const storageHost = process.env.HIS_ACCEPTANCE_STORAGE_HOST;
    if (!storageHost) throw new Blocked("Isolated storage host is not configured/allowlisted");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const response = await call(role, "/api/facility/his/media", "POST", { patientId: facility().patientId, fileName: name, mimeType: mime, sizeBytes: bytes.length, sha256 });
    assert(response.status === 200, `Media presign returned HTTP ${response.status}`);
    const signed = await response.json() as { key: string; uploadUrl: string };
    const url = new URL(signed.uploadUrl);
    assert(url.protocol === "https:" && url.hostname === storageHost, "Storage host did not match explicit allowlist");
    const put = await fetch(url, { method: "PUT", headers: { "content-type": mime }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(60_000), redirect: "error" });
    assert(put.ok, `Storage upload returned HTTP ${put.status}`);
    const confirmed = await call(role, "/api/facility/his/media/confirm", "POST", {
      key: signed.key, patientId: facility().patientId, fileName: name, mimeType: mime, sha256, category,
      examinationType: "SYNTHETIC ACCEPTANCE ONLY", reportStatus: "UNREPORTED", sensitivity: "STANDARD",
    });
    assert(confirmed.status === 201, `Media verification returned HTTP ${confirmed.status}`);
    return (await confirmed.json() as { media: { id: string } }).media.id;
  };
  try {
    // Match the real app database before changing a clinical resource. This
    // route is unavailable in production and still enforces normal Clerk/RBAC.
    for (const hospital of ["a", "b"] as const) {
      const response = await call("owner", "/api/facility/his/acceptance", "GET", undefined, hospital);
      assert(response.status === 200, `Staging identity/database preflight returned HTTP ${response.status}`);
      const identity = await response.json() as { mode: string; userId: string; facilityId: string };
      assert(identity.mode === "isolated-test" && identity.userId === user("owner", hospital).userId && identity.facilityId === facility(hospital).id, "App database does not match the disposable manifest");
    }
    preflightComplete = true;
    await check(1, async () => {
      const response = await call("owner", "/api/facility/his/templates", "POST", { mode: "custom", name: `SYNTHETIC acceptance ${manifest.runId}`, groupCode: "B", definition });
      assert(response.status === 201, `Template create returned HTTP ${response.status}`);
      templateId = (await response.json() as { template: { id: string } }).template.id;
    });
    await check(2, async () => {
      if (!templateId) throw new Blocked("Template setup failed");
      const path = `/api/facility/his/templates/${templateId}/actions`;
      assert((await call("owner", path, "POST", { action: "submit" })).status === 200, "Template submission failed");
      assert((await call("owner", path, "POST", { action: "approve" })).status === 403, "Self-approval was not denied");
      assert((await call("reviewer", path, "POST", { action: "approve" })).status === 200, "Independent approval failed");
      assert((await call("owner", path, "POST", { action: "publish" })).status === 200, "Publication failed");
      assert((await call("owner", `/api/facility/his/templates/${templateId}`, "GET", undefined, "b")).status === 404, "Other hospital saw a template");
    });
    await check(3, async () => {
      if (!templateId) throw new Blocked("Template setup failed");
      const response = await call("author", "/api/facility/his/documents", "POST", { templateId, patientId: facility().patientId, encounterId: facility().encounterIds[0] });
      assert(response.status === 201, `Document creation returned HTTP ${response.status}`);
      docId = (await response.json() as { document: { id: string } }).document.id;
      assert((await call("author", `/api/facility/his/documents/${docId}`, "PUT", { content: { note: "SYNTHETIC ACCEPTANCE ONLY. Not a clinical record." } })).status === 200, "Draft save failed");
      assert((await action("author", { action: "submit" })).status === 200, "Document submission failed");
      assert((await action("author", { action: "review" })).status === 403, "Self-review was not denied");
      assert((await action("reviewer", { action: "review" })).status === 200, "Independent review failed");
      assert((await action("author", { action: "finalize" })).status === 400, "Unsigned finalization was not denied");
      assert((await action("author", { action: "sign", role: "AUTHOR" })).status === 200, "Authenticated synthetic-author signature failed");
      assert((await action("author", { action: "finalize" })).status === 200, "Finalization failed");
    });
    await check(4, async () => {
      requireDoc();
      const response = await call("author", `/api/facility/his/documents/${docId}/pdf`);
      assert(response.status === 200 && response.headers.get("content-type")?.includes("application/pdf"), "Protected PDF download failed");
      assert(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString() === "%PDF-", "PDF bytes were invalid");
    });
    await check(5, async () => {
      const pdf = await PDFDocument.create(); pdf.addPage().drawText("SYNTHETIC ACCEPTANCE ONLY");
      labMediaId = await upload("lab", await pdf.save(), "synthetic-report.pdf", "application/pdf", "LABORATORY_REPORT");
      assert((await call("reviewer", `/api/facility/his/media/${labMediaId}`, "PATCH", { action: "reportStatus", reportStatus: "VERIFIED" })).status === 200, "Laboratory report verification failed");
    });
    await check(6, async () => {
      imageId = await upload("radiologist", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lioAAAAASUVORK5CYII=", "base64"), "synthetic-image.png", "image/png", "XRAY");
      const media = await db.medicalMedia.findUniqueOrThrow({ where: { id: imageId } });
      assert(media.patientId === facility().patientId && media.facilityId === facility().id, "Radiology file has an incorrect patient/hospital");
    });
    await check(7, async () => {
      requireDoc(); assert((await action("reviewer", { action: "release" })).status === 200, "Patient release failed");
      assert((await call("patient", `/api/patient/clinical-documents/${docId}/pdf`)).status === 200, "Correct patient could not download released PDF");
    });
    await check(8, async () => { requireDoc(); assert((await call("patient", `/api/patient/clinical-documents/${docId}/pdf`, "GET", undefined, "b")).status === 404, "Other patient obtained a report"); });
    await check(9, async () => { requireDoc(); assert((await call("owner", `/api/facility/his/documents/${docId}`, "GET", undefined, "b")).status === 404, "Other hospital obtained a report"); });
    await check(10, async () => {
      const response = await call("lab", "/api/facility/his/media", "POST", { patientId: facility().patientId, fileName: "unsafe.exe", mimeType: "application/x-msdownload", sizeBytes: 12, sha256: "a".repeat(64) });
      assert(response.status === 400, "Executable upload was not rejected");
    });
    await check(11, async () => { throw new Blocked("A witnessed synthetic consent ceremony and legal/clinical review remain manual. No patient consent or wet-ink signature is fabricated."); });
    await check(12, async () => {
      requireDoc();
      const before = await db.clinicalDocument.findUniqueOrThrow({ where: { id: docId } });
      assert((await action("author", { action: "amend", reason: "SYNTHETIC acceptance correction" })).status === 200, "Amendment creation failed");
      const after = await db.clinicalDocument.findUniqueOrThrow({ where: { id: docId } });
      assert(before.contentHash === after.contentHash && JSON.stringify(before.content) === JSON.stringify(after.content), "Amendment overwrote original");
    });
    await check(13, async () => {
      const create = await call("insurance", "/api/facility/his/coverage", "POST", { patientId: facility().patientId, category: "SELF_PAY" });
      assert(create.status === 201, "Synthetic payer creation failed");
      const coverageId = (await create.json() as { coverage: { id: string } }).coverage.id;
      const encounter = await call("receptionist", "/api/facility/his/encounters", "POST", { patientId: facility().patientId, caseNumber: facility().caseNumber, dateOfBirth: "1990-01-01", type: "FOLLOW_UP", priority: "ROUTINE", coverageId });
      assert(encounter.status === 201, "Synthetic payer encounter failed");
      const changed = await call("insurance", `/api/facility/his/coverage/${coverageId}`, "PATCH", { action: "update", data: { category: "PRIVATE_INSURANCE" } });
      assert(changed.status === 409, "Historical payer overwrite was not denied");
    });
    await check(14, async () => {
      for (const board of ["emergency", "planned"]) {
        const response = await call("owner", `/api/facility/his/encounters?board=${board}`);
        assert(response.status === 200, `${board} board failed`);
        assert(((await response.json() as { encounters: unknown[] }).encounters).length > 0, `${board} fixture missing`);
      }
    });
    await check(15, async () => {
      requireDoc();
      assert((await call("receptionist", "/api/facility/his/documents", "POST", { templateId, patientId: facility().patientId })).status === 403, "Receptionist authoring was not denied");
      assert((await action("receptionist", { action: "release" })).status === 403, "Receptionist release was not denied");
    });
    await check(16, async () => {
      if (!imageId) throw new Blocked("Isolated image storage setup did not complete");
      assert((await call("radiologist", `/api/facility/his/media/${imageId}?action=view`)).status === 200, "Authorized image view failed");
      assert((await call("radiologist", `/api/facility/his/media/${imageId}?action=view`, "GET", undefined, "b")).status === 404, "Other hospital obtained image");
    });
    await check(17, async () => {
      requireDoc();
      const count = await db.auditLog.count({ where: { resourceId: docId, action: "HIS_DOCUMENT_FINALIZED", facilityId: facility().id, patientId: facility().patientId } });
      assert(count === 1, "Authoritative finalization audit was missing or duplicated");
    });
    await check(18, async () => { throw new Blocked("Run the authenticated desktop/mobile browser regression checklist; HTTP/DB checks do not establish browser acceptance."); });
    await check(19, async () => {
      const response = await call("nurse", "/api/facility/his/nursing/observations", "POST", {
        patientId: facility().patientId, observationType: "TEMPERATURE", value: "36.8",
      });
      assert(response.status === 201, `Observation recording returned HTTP ${response.status}`);
      const row = await db.nursingObservation.findFirstOrThrow({ where: { facilityId: facility().id, patientId: facility().patientId, observationType: "TEMPERATURE" } });
      assert(row.unit === "°C" && row.value === "36.8" && row.recordedById === user("nurse").userId, "Observation was not unit-annotated and attributed to the nurse");
    });
    await check(20, async () => {
      const created = await call("nurse", "/api/facility/his/nursing/tasks", "POST", { patientId: facility().patientId, title: "SYNTHETIC acceptance care task" });
      assert(created.status === 201, `Task creation returned HTTP ${created.status}`);
      const taskId = (await created.json() as { task: { id: string } }).task.id;
      assert((await call("nurse", `/api/facility/his/nursing/tasks/${taskId}`, "PATCH", { status: "IN_PROGRESS" })).status === 200, "Task start failed");
      assert((await call("nurse", `/api/facility/his/nursing/tasks/${taskId}`, "PATCH", { status: "COMPLETED" })).status === 200, "Task completion failed");
      const task = await db.nursingTask.findUniqueOrThrow({ where: { id: taskId } });
      assert(task.status === "COMPLETED" && task.completedAt !== null, "Completion did not stamp the time");
    });
    let aspirinOrderId = "";
    await check(21, async () => {
      // The hospital configures its own rule and formulary entry (synthetic).
      const rule = await call("pharmacist", "/api/facility/his/interaction-rules", "POST", {
        medicationA: "Aspirin", medicationB: "Warfarin", severity: "WARNING", description: "SYNTHETIC acceptance rule; hospital-configured example",
      });
      assert(rule.status === 201, `Interaction rule creation returned HTTP ${rule.status}`);
      const formulary = await call("pharmacist", "/api/facility/his/formulary", "POST", { medicationName: "Aspirin", strength: "100 mg" });
      assert(formulary.status === 201, `Formulary entry creation returned HTTP ${formulary.status}`);
      // Prescribe Aspirin, submit it, then prescribe Warfarin: the configured
      // Aspirin+Warfarin rule must surface as an advisory interaction alert.
      const aspirin = await call("author", "/api/facility/his/medication-orders", "POST", { patientId: facility().patientId, medicationName: "Aspirin", strength: "100 mg", dose: "1 tablet" });
      assert(aspirin.status === 201, `Aspirin order creation returned HTTP ${aspirin.status}`);
      const aspirinBody = await aspirin.json() as { order: { id: string }; formulary: { matched: boolean }; alerts: { kind: string }[] };
      assert(aspirinBody.formulary.matched, "Formulary match was not reported");
      aspirinOrderId = aspirinBody.order.id;
      const submitted = await call("author", `/api/facility/his/medication-orders/${aspirinOrderId}`, "PATCH", { status: "SUBMITTED" });
      assert(submitted.status === 200, `Aspirin submission returned HTTP ${submitted.status}`);
      const warfarin = await call("author", "/api/facility/his/medication-orders", "POST", { patientId: facility().patientId, medicationName: "Warfarin", dose: "1 tablet" });
      assert(warfarin.status === 201, `Warfarin order creation returned HTTP ${warfarin.status}`);
      const warfarinBody = await warfarin.json() as { alerts: { kind: string; severity?: string }[] };
      assert(warfarinBody.alerts.some((a) => a.kind === "INTERACTION" && a.severity === "WARNING"), "Configured interaction alert was not surfaced");
      // Allergy visibility: prescribing a penicillin-family synthetic entry
      // against the recorded Penicillin allergy must surface the allergy alert.
      const penicillin = await call("author", "/api/facility/his/medication-orders", "POST", { patientId: facility().patientId, medicationName: "Penicillin G", dose: "1 vial" });
      assert(penicillin.status === 201, `Penicillin order creation returned HTTP ${penicillin.status}`);
      const penicillinBody = await penicillin.json() as { alerts: { kind: string; allergen?: string }[] };
      assert(penicillinBody.alerts.some((a) => a.kind === "ALLERGY" && a.allergen === "Penicillin"), "Recorded allergy was not surfaced");
    });
    await check(22, async () => {
      if (!aspirinOrderId) throw new Blocked("Medication order setup did not complete");
      // MAR: the nurse administers the submitted order; the entry is attributed
      // and timestamped, and staff without the permission are denied.
      const administered = await call("nurse", `/api/facility/his/medication-orders/${aspirinOrderId}/administrations`, "POST", { status: "GIVEN", administeredDose: "1 tablet" });
      assert(administered.status === 201, `MAR recording returned HTTP ${administered.status}`);
      const row = await db.medicationAdministration.findFirstOrThrow({ where: { orderId: aspirinOrderId } });
      assert(row.status === "GIVEN" && row.administeredById === user("nurse").userId && row.administeredAt !== null, "MAR entry was not attributed to the nurse");
      const denied = await call("receptionist", `/api/facility/his/medication-orders/${aspirinOrderId}/administrations`, "POST", { status: "GIVEN" });
      assert(denied.status === 403, `Receptionist MAR recording was not denied (HTTP ${denied.status})`);
    });
    await check(23, async () => {
      if (!aspirinOrderId) throw new Blocked("Medication order setup did not complete");
      // E-prescribing boundary: submission enqueued an outbound snapshot; with
      // no external endpoint configured it stays PENDING — an honestly
      // reported dependency, never a claimed live transmission.
      const entry = await db.ePrescriptionOutbox.findFirst({ where: { orderId: aspirinOrderId } });
      assert(entry !== null && entry.status === "PENDING", "Submission did not enqueue a pending outbound entry");
      const queue = await call("pharmacist", "/api/facility/his/eprescribing");
      assert(queue.status === 200, `Outbox listing returned HTTP ${queue.status}`);
      const body = await queue.json() as { endpointConfigured: boolean };
      assert(body.endpointConfigured === (Boolean(process.env.EPRESCRIBING_ENDPOINT)), "Outbox did not report the endpoint dependency honestly");
    });
  } finally {
    const failures: string[] = [];
    for (const session of sessions.values()) {
      try { await clerk(`/sessions/${encodeURIComponent(session)}/revoke`, "POST", {}); } catch { failures.push("A test session could not be revoked; its JWT expires within 60 seconds"); }
    }
    const overall = failures.length || results.some((r) => r.status === "FAIL") ? "FAIL" :
      !preflightComplete || results.length !== checks.length || results.some((r) => r.status === "BLOCKED") ? "BLOCKED" : "PASS";
    await writeFile(file, JSON.stringify({ runId: manifest.runId, baseUrl: manifest.baseUrl, checkedAt: new Date().toISOString(), syntheticOnly: true, overall, preflightComplete,
      summary: { pass: results.filter((r) => r.status === "PASS").length, fail: results.filter((r) => r.status === "FAIL").length, blocked: results.filter((r) => r.status === "BLOCKED").length },
      checks: results, sessionCleanupWarnings: failures }, null, 2), { mode: 0o600 });
  }
  return results;
}
