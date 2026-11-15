/**
 * Postgres row-level security as the last line of defence between facilities.
 *
 * Connects as an ordinary (non-superuser, non-BYPASSRLS) role through the same pool wrapper the
 * application uses, and proves that once a request has a facility context the database itself
 * refuses to read or change another facility's rows, with no help from application filters.
 *
 * Skipped unless RLS_TEST_DATABASE_URL points at a migrated, disposable, empty database whose name
 * ends in _test, using a role allowed to create roles.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { acceptanceRoster } from "./his/acceptance-config";
import { createAcceptanceFixtures, type AcceptanceManifest } from "../../scripts/lib/his-fixtures";
import { FacilityContextPool } from "./db-pool";
import { runWithRlsContext, setFacilityContext } from "./rls-context";

const ownerUrl = process.env.RLS_TEST_DATABASE_URL;
if (ownerUrl && !new URL(ownerUrl).pathname.endsWith("_test")) throw new Error("RLS tests require a disposable *_test database");

describe.skipIf(!ownerUrl)("facility row-level security", () => {
  const runId = randomBytes(6).toString("hex");
  const password = `rls-${runId}`;
  let owner: PrismaClient;
  let app: PrismaClient;
  let pool: FacilityContextPool;
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(), instanceId: null,
    databaseHost: "localhost", databaseName: "rls_test", users: [], facilities: [],
  };
  const facility = (h: "a" | "b") => manifest.facilities.find((f) => f.hospital === h)!;
  const inFacility = <T,>(h: "a" | "b" | null, fn: () => Promise<T>) =>
    runWithRlsContext(async () => { if (h) setFacilityContext(facility(h).id); return fn(); });

  beforeAll(async () => {
    owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: ownerUrl }) });
    await owner.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_runtime') THEN CREATE ROLE rls_test_runtime LOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$`);
    await owner.$executeRawUnsafe(`ALTER ROLE rls_test_runtime PASSWORD '${password}'`);
    await owner.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO rls_test_runtime`);
    await owner.$executeRawUnsafe(`GRANT ALL ON ALL TABLES IN SCHEMA public TO rls_test_runtime`);
    await owner.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rls_test_runtime`);
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(owner, manifest, identities);

    const url = new URL(ownerUrl!);
    url.username = "rls_test_runtime";
    url.password = password;
    pool = new FacilityContextPool({ connectionString: url.toString(), max: 5 });
    app = new PrismaClient({ adapter: new PrismaPg(pool) });
  }, 120_000);

  afterAll(async () => { await app?.$disconnect(); await pool?.end(); await owner?.$disconnect(); });

  it("the test role really is subject to row-level security", async () => {
    const [row] = await owner.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rls_test_runtime'`;
    expect(row).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("is inert without a facility context", async () => {
    const [all, seen] = [await owner.encounter.count(), await inFacility(null, () => app.encounter.count())];
    expect(all).toBeGreaterThan(1);
    expect(seen).toBe(all);
  });

  it("shows a facility only its own rows", async () => {
    const [a, b] = [facility("a"), facility("b")];
    const rows = await inFacility("a", () => app.encounter.findMany({ select: { id: true, facilityId: true } }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.facilityId === a.id)).toBe(true);
    expect(await inFacility("a", () => app.encounter.findUnique({ where: { id: b.encounterIds[0] } }))).toBeNull();
    expect(await inFacility("a", () => app.encounter.findFirst({ where: { id: b.encounterIds[0] } }))).toBeNull();
    expect(await inFacility("a", () => app.encounter.count({ where: { facilityId: b.id } }))).toBe(0);
    expect(await inFacility("a", () => app.encounter.findUnique({ where: { id: a.encounterIds[0] } }))).not.toBeNull();
  });

  it("applies to raw SQL, joins and nested reads as well", async () => {
    const b = facility("b");
    const [{ count }] = await inFacility("a", () => app.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM encounters WHERE facility_id = ${b.id}::uuid`);
    expect(Number(count)).toBe(0);
    const viaPatient = await inFacility("a", () => app.patient.findMany({ where: { id: b.patientId }, select: { encounters: { select: { id: true } } } }));
    expect(viaPatient.flatMap((p) => p.encounters)).toEqual([]);
  });

  it("refuses to change or delete another facility's rows, even when the application forgets its filter", async () => {
    const b = facility("b");
    const target = b.encounterIds[0];
    await expect(inFacility("a", () => app.encounter.update({ where: { id: target }, data: { chiefComplaint: "tampered" } }))).rejects.toThrow();
    expect((await inFacility("a", () => app.encounter.updateMany({ where: { id: target }, data: { chiefComplaint: "tampered" } }))).count).toBe(0);
    await expect(inFacility("a", () => app.encounter.delete({ where: { id: target } }))).rejects.toThrow();
    expect((await inFacility("a", () => app.encounter.deleteMany({ where: { id: target } }))).count).toBe(0);
    const untouched = await owner.encounter.findUniqueOrThrow({ where: { id: target } });
    expect(untouched.chiefComplaint).not.toBe("tampered");
  });

  it("refuses to move a row into another facility", async () => {
    const [a, b] = [facility("a"), facility("b")];
    await expect(inFacility("a", () => app.$executeRaw`UPDATE encounters SET facility_id = ${b.id}::uuid WHERE id = ${a.encounterIds[0]}::uuid`)).rejects.toThrow();
    expect((await owner.encounter.findUniqueOrThrow({ where: { id: a.encounterIds[0] } })).facilityId).toBe(a.id);
  });

  it("lets a facility change its own rows and commits the change", async () => {
    const a = facility("a");
    const marker = `committed-${runId}`;
    await inFacility("a", () => app.encounter.update({ where: { id: a.encounterIds[0] }, data: { chiefComplaint: marker } }));
    expect((await owner.encounter.findUniqueOrThrow({ where: { id: a.encounterIds[0] } })).chiefComplaint).toBe(marker);
  });

  it("confines interactive transactions and batches too", async () => {
    const [a, b] = [facility("a"), facility("b")];
    const inTx = await inFacility("a", () => app.$transaction(async (tx) => tx.encounter.findMany({ select: { facilityId: true } })));
    expect(inTx.length).toBeGreaterThan(0);
    expect(inTx.every((r) => r.facilityId === a.id)).toBe(true);
    const [encounters, admissions] = await inFacility("b", () => app.$transaction([app.encounter.count(), app.admission.count({ where: { facilityId: a.id } })]));
    expect(encounters).toBe(await owner.encounter.count({ where: { facilityId: b.id } }));
    expect(admissions).toBe(0);
  });

  it("keeps concurrent requests for different facilities apart", async () => {
    const [a, b] = [facility("a"), facility("b")];
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => {
      const h = i % 2 === 0 ? "a" : "b";
      return inFacility(h, async () => ({ h, rows: await app.encounter.findMany({ select: { facilityId: true } }) }));
    }));
    for (const { h, rows } of results) expect(rows.every((r) => r.facilityId === (h === "a" ? a.id : b.id))).toBe(true);
  });

  it("does not leak a facility context to the next request on a reused connection", async () => {
    const total = await owner.encounter.count();
    for (let i = 0; i < 10; i += 1) {
      await inFacility(i % 2 ? "a" : "b", () => app.encounter.count());
      expect(await inFacility(null, () => app.encounter.count())).toBe(total);
    }
  });

  it("leaves cross-facility tables (staff memberships) readable, by design", async () => {
    const all = await owner.facilityStaff.count();
    expect(await inFacility("a", () => app.facilityStaff.count())).toBe(all);
  });
});
