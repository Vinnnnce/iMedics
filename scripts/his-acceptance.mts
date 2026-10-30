import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { acceptanceRoster, assertAcceptanceDatabase, assertAcceptanceEnvironment } from "../src/lib/his/acceptance-config.ts";
import { createAcceptanceFixtures, type AcceptanceManifest } from "./lib/his-fixtures.ts";

const command = process.argv[2] ?? "plan";
const runId = process.env.HIS_ACCEPTANCE_RUN_ID ?? randomBytes(6).toString("hex");
const file = resolve("qa/his-acceptance", `${runId}.json`);
const api = async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
  if (process.env.HIS_ACCEPTANCE_CLERK_PROXY === "true") {
    // Saved HTTP credentials are injected by the approved host proxy, never
    // read or copied into this process's headers or command-line arguments.
    const { stdout } = await promisify(execFile)("curl", [
      "--silent", "--show-error", "--max-time", "20", "--request", method,
      "--header", "Content-Type: application/json", "--write-out", "\n%{http_code}",
      ...(body === undefined ? [] : ["--data-binary", JSON.stringify(body)]),
      `https://api.clerk.com/v1${path}`,
    ], { maxBuffer: 2 * 1024 * 1024 });
    const split = stdout.lastIndexOf("\n");
    const status = Number(stdout.slice(split + 1));
    if (status < 200 || status >= 300) throw new Error(`Clerk operation failed (HTTP ${status})`);
    return JSON.parse(stdout.slice(0, split)) as T;
  }
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
  });
  // Do not log provider response bodies: they may contain secrets or identities.
  if (!response.ok) throw new Error(`Clerk operation failed (HTTP ${response.status})`);
  return response.json() as Promise<T>;
};
const save = async (manifest: AcceptanceManifest) => {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(manifest, null, 2), { mode: 0o600 });
};

async function main() {
  if (command === "plan") {
    console.log(JSON.stringify({ runId, mode: "plan-only", roster: acceptanceRoster(runId), noAccountsCreated: true }, null, 2));
    return;
  }
  if (!["provision", "local", "deactivate", "check", "run"].includes(command)) throw new Error("Commands: plan, local, provision, check, run, deactivate");
  const local = command === "local";
  const config = local ? assertAcceptanceDatabase(process.env) : assertAcceptanceEnvironment(process.env);
  const database = new URL(config.databaseUrl);
  if (local && (!["localhost", "127.0.0.1"].includes(database.hostname) || !["localhost", "127.0.0.1"].includes(new URL(config.baseUrl).hostname))) {
    throw new Error("Database-only fixtures are restricted to loopback hosts and cannot authenticate");
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  try {
    if (command === "deactivate" || command === "check" || command === "run") {
      if (!process.env.HIS_ACCEPTANCE_RUN_ID) throw new Error("An explicit HIS_ACCEPTANCE_RUN_ID is required");
      const manifest = JSON.parse(await readFile(file, "utf8")) as AcceptanceManifest;
      if (manifest.version !== 1 || manifest.runId !== runId || manifest.baseUrl !== config.baseUrl ||
        manifest.databaseHost !== database.hostname || manifest.databaseName !== decodeURIComponent(database.pathname.slice(1))) {
        throw new Error("Manifest does not match this isolated environment");
      }
      const instance = await api<{ id: string; environment_type: string }>("/instance");
      if (instance.environment_type !== "development" || instance.id !== manifest.instanceId) throw new Error("Clerk test instance mismatch");
      if (command === "run") {
        if (manifest.incomplete) throw new Error("An incomplete provisioning run cannot perform acceptance checks; deactivate it first");
        const { runLiveAcceptance } = await import("./lib/his-live-acceptance.ts");
        const results = await runLiveAcceptance(manifest, db, api, file.replace(/\.json$/, ".results.json"));
        console.log(JSON.stringify({ runId, pass: results.filter((r) => r.status === "PASS").length, fail: results.filter((r) => r.status === "FAIL").length, blocked: results.filter((r) => r.status === "BLOCKED").length }));
        if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
        return;
      }
      if (command === "check") {
        // The live suite is a separate command, so partial configuration is
        // never presented as successful acceptance.
        console.log(JSON.stringify({ runId, identities: manifest.users.length, expiresAt: manifest.expiresAt, liveAcceptance: "NOT_RUN" }));
        return;
      }
      const owned = new Map((manifest.createdIdentities ?? []).map((u) => [u.id, { clerkId: u.id, email: u.email, userId: undefined as string | undefined }]));
      for (const user of manifest.users) owned.set(user.clerkId, user);
      for (const user of owned.values()) {
        const actual = await api<{ private_metadata: { imedics_acceptance_run?: string }; email_addresses: { email_address: string }[] }>(`/users/${encodeURIComponent(user.clerkId)}`);
        if (!acceptanceRoster(runId).some((r) => r.email === user.email) || actual.private_metadata.imedics_acceptance_run !== runId || !actual.email_addresses.some((e) => e.email_address === user.email)) throw new Error("Refusing to deactivate an identity outside this run");
        await api(`/users/${encodeURIComponent(user.clerkId)}/ban`, "POST", {});
        const record = await db.user.findFirst({ where: { clerkId: user.clerkId, email: user.email, testAccountExpiresAt: { not: null } }, select: { id: true } });
        if (!record) continue;
        await db.$transaction([
          db.user.updateMany({ where: { id: record.id, clerkId: user.clerkId, email: user.email, testAccountExpiresAt: { not: null } }, data: { status: "SUSPENDED", testAccountExpiresAt: new Date() } }),
          db.facilityStaff.updateMany({ where: { userId: record.id, facilityId: { in: manifest.facilities.map((f) => f.id) } }, data: { status: "TERMINATED" } }),
        ]);
      }
      console.log(JSON.stringify({ runId, deactivated: manifest.users.length, clinicalRecordsRetained: true }));
      return;
    }
    // Refuse overwriting a manifest; this makes retries safe and recoverable.
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const reservation = await import("node:fs/promises").then((fs) => fs.open(file, "wx", 0o600));
    await reservation.close();
    const manifest: AcceptanceManifest = {
      version: 1, runId, mode: local ? "local-database-only" : "clerk-test", baseUrl: config.baseUrl,
      expiresAt: new Date(Date.now() + config.ttlHours * 3_600_000).toISOString(), instanceId: null,
      databaseHost: database.hostname, databaseName: decodeURIComponent(database.pathname.slice(1)), users: [], facilities: [],
    };
    const identities = new Map<string, string>();
    const created: { id: string; email: string }[] = [];
    try {
      if (!local) {
        const instance = await api<{ id: string; environment_type: string }>("/instance");
        if (instance.environment_type !== "development") throw new Error("Clerk must confirm environment_type=development");
        manifest.instanceId = instance.id;
        await save(manifest);
      }
      for (const identity of acceptanceRoster(runId)) {
        const user = local ? { id: `local_test_${runId}_${identity.hospital}_${identity.role}` } :
          await api<{ id: string }>("/users", "POST", {
            email_address: [identity.email], first_name: "SYNTHETIC TEST", last_name: `${identity.hospital.toUpperCase()} ${identity.role}`,
            skip_password_requirement: true, private_metadata: { imedics_acceptance_run: runId, expires_at: manifest.expiresAt },
          });
        identities.set(identity.email, user.id);
        created.push({ id: user.id, email: identity.email });
        manifest.createdIdentities = [...created];
        manifest.incomplete = true;
        await save(manifest);
      }
      await createAcceptanceFixtures(db, manifest, identities);
      manifest.incomplete = false;
      await save(manifest);
      console.log(JSON.stringify({ runId, mode: manifest.mode, accounts: manifest.users.length, facilities: manifest.facilities.length, expiresAt: manifest.expiresAt, manifest: file, liveAcceptance: "NOT_RUN" }));
    } catch (error) {
      // Keep IDs for recovery even if DB provisioning fails. Never delete data
      // or silently leave external identities usable after a partial run.
      const rollbackFailures: string[] = [];
      if (!local) for (const user of created) {
        try { await api(`/users/${encodeURIComponent(user.id)}/ban`, "POST", {}); } catch { rollbackFailures.push(user.id); }
      }
      await writeFile(file, JSON.stringify({ ...manifest, incomplete: true, createdIdentities: created, rollbackFailures }, null, 2), { mode: 0o600 });
      throw error;
    }
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Acceptance operation failed");
  process.exitCode = 1;
});
