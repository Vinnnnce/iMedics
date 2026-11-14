// Medic1905 Virtual Hospital — simulator API.
// Faithful port of the standalone Express simulator (simulator/) onto the
// Next.js platform: same routes, same engines, same JSON shapes — now backed
// by Prisma + Neon Postgres instead of SQLite.
//
// SIMULATED ENVIRONMENT — ALL PATIENTS ARE SYNTHETIC. FOR MEDICAL EDUCATION
// ONLY. NOT CLINICAL DECISION SUPPORT. The simulator keeps its own session
// auth (synthetic learner accounts in sim_* tables) and is completely
// separated from real EMR patient records.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const physiology = require("../../../simulator/engines/physiology") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conversation = require("../../../simulator/engines/conversation") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safety = require("../../../simulator/engines/safety") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scoring = require("../../../simulator/engines/scoring") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const theatreEngine = require("../../../simulator/engines/theatre") as any;

export const SIM_ROLES = [
  "student", "intern", "resident", "specialist", "surgeon", "anaesthetist",
  "nurse", "pharmacist", "lab_scientist", "radiologist", "instructor", "admin",
] as const;

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

// ——— helpers ———
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const fail = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

async function body(req: NextRequest): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

type SimUserRow = { id: number; email: string; fullName: string; role: string; level: string; cityId: number | null };

async function currentUser(req: NextRequest): Promise<SimUserRow | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const session = await prisma.simSession.findUnique({ where: { token } });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const user = await prisma.simUser.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  return user;
}

async function requireUser(req: NextRequest, roles?: readonly string[]) {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "Authentication required");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Insufficient permissions");
  return user;
}

class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message); this.status = status; this.extra = extra;
  }
}

async function audit(userId: number | null, action: string, target?: string | null, detail?: string) {
  await prisma.simAuditLog.create({ data: { userId, action, target: target ?? undefined, detail } });
}

// ——— mappers (DB camelCase -> original snake_case JSON shapes) ———
const userJson = (u: any) => ({ id: u.id, email: u.email, full_name: u.fullName, role: u.role, level: u.level, city_id: u.cityId, created_at: u.createdAt });
const regionJson = (r: any) => ({ id: r.id, code: r.code, name: r.name, tier: r.tier, population: r.population, description: r.description });
const cityJson = (c: any) => ({ id: c.id, region_id: c.regionId, name: c.name, tier: c.tier, population: c.population });
const hospitalJson = (h: any) => ({ id: h.id, city_id: h.cityId, name: h.name, tier: h.tier, beds: h.beds, has_ed: h.hasEd ? 1 : 0, has_icu: h.hasIcu ? 1 : 0, has_theatre: h.hasTheatre ? 1 : 0 });
const departmentJson = (d: any) => ({ id: d.id, key: d.key, name: d.name, category: d.category });
const drugJson = (d: any) => ({
  id: d.id, name: d.name, generic: d.generic, drug_class: d.drugClass, forms: d.forms,
  adult_dose: d.adultDose, max_dose: d.maxDose, renal_note: d.renalNote, hepatic_note: d.hepaticNote,
  pregnancy_category: d.pregnancyCategory, interactions: d.interactions, contraindications: d.contraindications,
  allergy_tags: d.allergyTags, high_alert: d.highAlert ? 1 : 0,
});
const labJson = (l: any) => ({ id: l.id, key: l.key, name: l.name, category: l.category, unit: l.unit, ref_range: l.refRange, turnaround_min: l.turnaroundMin, container: l.container });
const imagingJson = (i: any) => ({ id: i.id, key: i.key, name: i.name, modality: i.modality, category: i.category, turnaround_min: i.turnaroundMin, requires_justify: i.requiresJustify ? 1 : 0 });
const caseJson = (c: any) => ({ id: c.id, key: c.key, title: c.title, specialty: c.specialty, difficulty: c.difficulty, scenario_type: c.scenarioType, description: c.description, status: c.status, author_id: c.authorId, created_at: c.createdAt, updated_at: c.updatedAt });
const runJson = (r: any) => ({ id: r.id, case_id: r.caseId, learner_id: r.learnerId, status: r.status, started_at: r.startedAt, ended_at: r.endedAt, score: r.score ? JSON.parse(r.score) : null });
const orderJson = (o: any) => ({ id: o.id, run_id: o.runId, kind: o.kind, item_key: o.itemKey, justification: o.justification, status: o.status, requested_at: o.requestedAt, resulted_at: o.resultedAt, result: o.result ? JSON.parse(o.result) : null, urgent: o.urgent ? 1 : 0 });
const prescriptionJson = (p: any) => ({ id: p.id, run_id: p.runId, drug_key: p.drugKey, dose: p.dose, route: p.route, frequency: p.frequency, duration: p.duration, checks: p.checks ? JSON.parse(p.checks) : null, status: p.status, prescribed_at: p.prescribedAt });
const noteJson = (n: any) => ({ id: n.id, run_id: n.runId, author_id: n.authorId, type: n.type, content: n.content, created_at: n.createdAt });
const observationJson = (o: any) => ({ id: o.id, run_id: o.runId, author_id: o.authorId, hr: o.hr, sbp: o.sbp, dbp: o.dbp, rr: o.rr, temp: o.temp, spo2: o.spo2, pain_score: o.painScore, gcs: o.gcs, consciousness: o.consciousness, urine_output: o.urineOutput, fluid_balance: o.fluidBalance, wound: o.wound, notes: o.notes, recorded_at: o.recordedAt });
const messageJson = (m: any) => ({ id: m.id, run_id: m.runId, role: m.role, content: m.content, ts: m.ts });

function caseForLearner(row: any) {
  const s = JSON.parse(row.scenario);
  return {
    id: row.id, key: row.key, title: row.title, specialty: row.specialty, difficulty: row.difficulty,
    scenario_type: row.scenarioType, description: row.description, status: row.status,
    patient: { name: s.patient.name, age: s.patient.age, sex: s.patient.sex },
    presentation: s.presentation,
    examSystems: Object.keys(s.exam.systems || {}),
    theatre: s.theatre ? { procedure: s.theatre.procedure, anaesthesia: s.theatre.anaesthesia, steps: s.theatre.steps.length } : null,
    labCatalogAvailable: true,
  };
}

async function loadRun(id: number) {
  const run = await prisma.simCaseRun.findUnique({ where: { id } });
  if (!run) return null;
  const caseRow = await prisma.simCase.findUnique({ where: { id: run.caseId } });
  if (!caseRow) return null;
  return { run, caseRow, scenario: JSON.parse(caseRow.scenario) };
}

async function persistState(runId: number, state: any) {
  await prisma.simCaseRun.update({ where: { id: runId }, data: { state: JSON.stringify(state) } });
}

async function addEvent(runId: number, state: any, type: string, data: any) {
  await prisma.simRunEvent.create({ data: { runId, actorId: null, actorRole: "system", type, data: JSON.stringify(data) } });
  state.events.push({ ...data, type, at: new Date().toISOString() });
}

function viewState(ctx: NonNullable<Awaited<ReturnType<typeof loadRun>>>, state: any, live: boolean) {
  const phase = (ctx.scenario.phases || []).find((p: any) => p.id === state.phase) || {};
  const activeComplication = state.pendingComplication
    ? (ctx.scenario.complications || []).find((c: any) => c.id === state.pendingComplication) : null;
  return {
    runId: ctx.run.id,
    status: ctx.run.status,
    live,
    paused: !!state.paused,
    dead: !!state.dead,
    recovered: !!state.recovered,
    phase: { id: state.phase, name: phase.name || "—", description: phase.description || "" },
    vitals: state.vitals,
    news2: physiology.news2(state.vitals || {}),
    minutesElapsed: Math.round(physiology.minutesSince(state.startedAt) * 10) / 10,
    events: (state.events || []).slice(-30),
    complication: activeComplication ? { name: activeComplication.name, description: activeComplication.description, requires: activeComplication.requires } : null,
    completedManagementCount: Object.keys(state.completedManagement || {}).length,
  };
}

// ——— Simulated PACS / DICOM identifiers ———
const MODALITY_MAP: Record<string, { modality: string; bodyPart: string }> = {
  cxr: { modality: "CR", bodyPart: "CHEST" }, ct_head: { modality: "CT", bodyPart: "HEAD" },
  "ct_abdo": { modality: "CT", bodyPart: "ABDOMEN" }, "ct_pa": { modality: "CT", bodyPart: "CHEST" },
  ecg: { modality: "ECG", bodyPart: "CHEST" }, us: { modality: "US", bodyPart: "ABDOMEN" },
  us_abdo: { modality: "US", bodyPart: "ABDOMEN" }, echo: { modality: "US", bodyPart: "HEART" },
  mri: { modality: "MR", bodyPart: "HEAD" }, axr: { modality: "CR", bodyPart: "ABDOMEN" },
  mammography: { modality: "MG", bodyPart: "BREAST" }, nuclear_medicine: { modality: "NM", bodyPart: "WHOLEBODY" },
};
function pacsMetadata(order: any, cat: any, result: any) {
  const m = MODALITY_MAP[order.itemKey] || { modality: ((cat && cat.modality) || "OT").toUpperCase().slice(0, 2), bodyPart: "UNKNOWN" };
  const seed = order.runId * 7919 + order.id * 104729;
  const uidRoot = "1.2.826.0.1.3680043.10.1905"; // Medic1905 simulated root
  return {
    accessionNumber: "M1905-" + String(100000 + seed % 900000),
    studyInstanceUID: `${uidRoot}.${seed}.1`,
    seriesInstanceUID: `${uidRoot}.${seed}.2`,
    patientID: "M1905-SIM-" + String(order.runId).padStart(5, "0"),
    modality: m.modality,
    bodyPart: m.bodyPart,
    studyDescription: result.name,
    seriesDescription: `${m.modality} ${m.bodyPart}`,
    seed,
    instanceCount: 1,
    simulated: true, // never confuse with real clinical imaging
  };
}

async function buildResult(scenario: any, state: any, order: any): Promise<any> {
  const cat: any = order.kind === "lab"
    ? await prisma.simLabItem.findUnique({ where: { key: order.itemKey } })
    : await prisma.simImagingItem.findUnique({ where: { key: order.itemKey } });
  const name = cat ? cat.name : order.itemKey;
  if (order.kind === "imaging") {
    const defined = (scenario.imaging || {})[order.itemKey];
    const finding = defined ? defined.finding : "Unremarkable study. No acute pathology identified.";
    const result: any = { name, modality: cat ? cat.modality : "—", finding, phaseVisible: defined ? defined.phases.includes(state.phase) : true, critical: /occlusion|active|rupture|embol|elevat/i.test(finding) && !!defined };
    result.pacs = pacsMetadata(order, cat, result);
    return result;
  }
  const labs = scenario.labs || {};
  const base = (labs.baseline || {})[order.itemKey];
  const phaseMod = ((labs.phases || {})[state.phase] || {})[order.itemKey];
  let value = base !== undefined ? base : null;
  if (value === null) {
    value = cat && cat.refRange ? `Within reference range (${cat.refRange})` : "No abnormality detected";
    return { name, category: cat ? cat.category : "—", unit: cat ? cat.unit : "", value, normal: true, critical: false };
  }
  if (phaseMod !== undefined) value = phaseMod;
  const criticalPatterns = /k\s*[>=]\s*6|glucose\s*[>=]?\s*(2[5-9]|3\d)|ph\s*7\.[01]|troponin\s*[>=]?\s*(5\d|[6-9]\d|\d{3})|platelets?\s*<\s*\d|h\s*b\s*<\s*80|inr\s*[>=]\s*4/i;
  return { name, category: cat ? cat.category : "—", unit: cat ? cat.unit : "", value: String(value), normal: false, critical: criticalPatterns.test(String(value)) };
}

// ——— main router ———
export async function handleSim(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const method = req.method;
  const p = segments;
  const q = (key: string) => req.nextUrl.searchParams.get(key);
  const idParam = (s?: string) => (s && /^\d+$/.test(s) ? parseInt(s, 10) : NaN);

  try {
    // ——— health ———
    if (p[0] === "health" && method === "GET") {
      return json({ ok: true, platform: "Medic1905 Virtual Hospital", simulation: true });
    }

    // ——— auth ———
    if (p[0] === "auth" && p[1] === "register" && method === "POST") {
      const { email, password, full_name, role } = await body(req);
      if (!email || !password || !full_name || !SIM_ROLES.includes(role)) {
        return fail(400, "Valid email, password, full name and role are required", { roles: SIM_ROLES });
      }
      const existing = await prisma.simUser.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) return fail(409, "An account with this email already exists");
      const user = await prisma.simUser.create({
        data: { email: email.toLowerCase(), passwordHash: bcrypt.hashSync(password, 10), fullName: full_name, role },
      });
      await audit(user.id, "register", user.email);
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.simSession.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) } });
      return json({ token, user: { id: user.id, email: user.email, full_name: user.fullName, role: user.role } });
    }

    if (p[0] === "auth" && p[1] === "login" && method === "POST") {
      const { email, password } = await body(req);
      if (!email || !password) return fail(400, "Email and password required");
      const user = await prisma.simUser.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) return fail(401, "Invalid credentials");
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.simSession.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) } });
      await audit(user.id, "login");
      return json({ token, user: { id: user.id, email: user.email, full_name: user.fullName, role: user.role, level: user.level } });
    }

    if (p[0] === "auth" && p[1] === "logout" && method === "POST") {
      const header = req.headers.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (token) await prisma.simSession.deleteMany({ where: { token } });
      return json({ ok: true });
    }

    if (p[0] === "auth" && p[1] === "me" && method === "GET") {
      const user = await requireUser(req);
      return json({ user: { id: user.id, email: user.email, full_name: user.fullName, role: user.role, level: user.level, city_id: user.cityId } });
    }

    // ——— country / departments / hospitals ———
    if (p[0] === "country" && method === "GET") {
      const regions = await prisma.simRegion.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] });
      const cities = await prisma.simCity.findMany();
      const hospitals = await prisma.simHospital.findMany();
      const byRegion: Record<number, any> = {};
      for (const r of regions) byRegion[r.id] = { ...regionJson(r), cities: [] };
      const cityMap: Record<number, any> = {};
      for (const c of cities) {
        cityMap[c.id] = { ...cityJson(c), hospitals: [] };
        if (byRegion[c.regionId]) byRegion[c.regionId].cities.push(cityMap[c.id]);
      }
      for (const h of hospitals) if (cityMap[h.cityId]) cityMap[h.cityId].hospitals.push(hospitalJson(h));
      return json({ country: { name: "Medic1905 Republic", tagline: "The virtual nation of the Medic1905 teaching hospital network", emergencyNumber: "1905" }, regions: Object.values(byRegion) });
    }

    if (p[0] === "departments" && method === "GET") {
      const departments = await prisma.simDepartment.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
      return json({ departments: departments.map(departmentJson) });
    }

    if (p[0] === "hospitals" && p[1] && method === "GET") {
      const id = idParam(p[1]);
      if (Number.isNaN(id)) return fail(404, "Hospital not found");
      const h = await prisma.simHospital.findUnique({ where: { id } });
      if (!h) return fail(404, "Hospital not found");
      const hds = await prisma.simHospitalDepartment.findMany({ where: { hospitalId: h.id }, include: { department: true } });
      const depts = hds.map((hd: any) => hd.department).sort((a: any, b: any) => (a.category + a.name).localeCompare(b.category + b.name));
      const city = await prisma.simCity.findUnique({ where: { id: h.cityId }, include: { region: true } });
      const cityOut = city ? { ...cityJson(city), region_name: city.region.name, region_tier: city.region.tier } : null;
      return json({ hospital: hospitalJson(h), city: cityOut, departments: depts.map(departmentJson) });
    }

    // ——— case library ———
    if (p[0] === "cases") {
      if (method === "GET" && !p[1]) {
        const user = await requireUser(req);
        let rows = await prisma.simCase.findMany({ orderBy: [{ difficulty: "asc" }, { specialty: "asc" }] });
        if (user.role !== "instructor" && user.role !== "admin") rows = rows.filter((r: any) => r.status === "published");
        const difficulty = q("difficulty"), specialty = q("specialty"), type = q("type");
        if (difficulty) rows = rows.filter((r: any) => r.difficulty === difficulty);
        if (specialty) rows = rows.filter((r: any) => r.specialty === specialty);
        if (type) rows = rows.filter((r: any) => r.scenarioType === type);
        return json({ cases: rows.map(caseForLearner) });
      }
      if (method === "GET" && p[1]) {
        await requireUser(req);
        const row = await prisma.simCase.findFirst({ where: { OR: [{ id: idParam(p[1]) }, { key: p[1] }] } });
        if (!row) return fail(404, "Case not found");
        const user = await requireUser(req);
        if (user.role === "instructor" || user.role === "admin") {
          return json({ case: { ...caseJson(row), scenario: JSON.parse(row.scenario) } });
        }
        return json({ case: caseForLearner(row) });
      }
      if (method === "POST" && !p[1]) {
        const user = await requireUser(req, ["instructor", "admin"]);
        const { key, title, specialty, difficulty, scenario_type, description, scenario } = await body(req);
        if (!key || !title || !scenario) return fail(400, "key, title and scenario are required");
        const existing = await prisma.simCase.findUnique({ where: { key } });
        if (existing) return fail(409, "Case key already exists");
        const created = await prisma.simCase.create({
          data: {
            key, title, specialty: specialty || "general-medicine", difficulty: difficulty || "undergraduate",
            scenarioType: scenario_type || "clinical", description: description || title,
            status: "draft", authorId: user.id, scenario: JSON.stringify(scenario),
          },
        });
        await audit(user.id, "case_create", key);
        return json({ id: created.id, ok: true });
      }
      if (method === "PUT" && p[1]) {
        await requireUser(req, ["instructor", "admin"]);
        const row = await prisma.simCase.findUnique({ where: { id: idParam(p[1]) } });
        if (!row) return fail(404, "Case not found");
        const { title, specialty, difficulty, scenario_type, description, scenario, status } = await body(req);
        await prisma.simCase.update({
          where: { id: row.id },
          data: {
            title: title || row.title, specialty: specialty || row.specialty, difficulty: difficulty || row.difficulty,
            scenarioType: scenario_type || row.scenarioType, description: description || row.description,
            scenario: scenario ? JSON.stringify(scenario) : row.scenario, status: status || row.status,
          },
        });
        return json({ ok: true });
      }
      if (method === "POST" && p[2] === "duplicate") {
        const user = await requireUser(req, ["instructor", "admin"]);
        const row = await prisma.simCase.findUnique({ where: { id: idParam(p[1]) } });
        if (!row) return fail(404, "Case not found");
        const newKey = row.key + "-v" + Date.now().toString(36);
        await prisma.simCase.create({
          data: { key: newKey, title: row.title + " (copy)", specialty: row.specialty, difficulty: row.difficulty, scenarioType: row.scenarioType, description: row.description, status: "draft", authorId: user.id, scenario: row.scenario },
        });
        return json({ ok: true, key: newKey });
      }
      if (method === "POST" && p[2] === "publish") {
        const user = await requireUser(req, ["instructor", "admin"]);
        const id = idParam(p[1]);
        await prisma.simCase.update({ where: { id }, data: { status: "published" } });
        await audit(user.id, "case_publish", String(id));
        return json({ ok: true });
      }
    }

    // ——— catalogs ———
    if (p[0] === "catalog" && method === "GET") {
      await requireUser(req);
      if (p[1] === "labs") return json({ labs: (await prisma.simLabItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] })).map(labJson) });
      if (p[1] === "imaging") return json({ imaging: (await prisma.simImagingItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] })).map(imagingJson) });
      if (p[1] === "drugs") return json({ drugs: (await prisma.simDrug.findMany({ orderBy: { name: "asc" } })).map(drugJson) });
    }

    // ——— runs (the encounter engine) ———
    if (p[0] === "runs") {
      const user = await requireUser(req);

      if (method === "POST" && !p[1]) {
        const { caseId } = await body(req);
        const c = await prisma.simCase.findUnique({ where: { id: caseId } });
        if (!c || c.status !== "published") return fail(404, "Case not found or not published");
        const scenario = JSON.parse(c.scenario);
        const state = physiology.newState(scenario, Date.now());
        state.theatre = theatreEngine.createTheatre(scenario);
        const run = await prisma.simCaseRun.create({
          data: { caseId: c.id, learnerId: user.id, status: "active", state: JSON.stringify(state) },
        });
        await prisma.simRunParticipant.create({ data: { runId: run.id, userId: user.id, roleInCase: "learner" } });
        await prisma.simChatMessage.create({ data: { runId: run.id, role: "patient", content: scenario.presentation.initial } });
        await audit(user.id, "run_start", String(run.id));
        return json({ runId: run.id });
      }

      if (method === "GET" && !p[1]) {
        const rows = await prisma.simCaseRun.findMany({
          where: { learnerId: user.id }, orderBy: { startedAt: "desc" }, include: { case: true },
        });
        return json({ runs: rows.map((r: any) => ({ ...runJson(r), title: r.case.title, difficulty: r.case.difficulty, specialty: r.case.specialty })) });
      }

      const runId = idParam(p[1]);
      if (Number.isNaN(runId)) return fail(404, "Run not found");
      const ctx = await loadRun(runId);
      if (!ctx) return fail(404, "Run not found");

      if (method === "GET" && !p[2]) {
        const state = JSON.parse(ctx.run.state);
        physiology.tick(ctx.scenario, state, ctx.run.id);
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        const chat = await prisma.simChatMessage.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "asc" } });
        const orders = await prisma.simOrder.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "asc" } });
        const prescriptions = await prisma.simPrescription.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "asc" } });
        const notes = await prisma.simClinicalNote.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "desc" } });
        const observations = await prisma.simNursingObservation.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "desc" }, take: 50 });
        const authorIds = [...new Set(notes.map((n: any) => n.authorId).filter(Boolean))] as number[];
        const authors = authorIds.length ? await prisma.simUser.findMany({ where: { id: { in: authorIds } } }) : [];
        const authorNames = new Map(authors.map((a: any) => [a.id, a.fullName]));
        return json({
          run: { id: ctx.run.id, status: ctx.run.status, started_at: ctx.run.startedAt, ended_at: ctx.run.endedAt, score: ctx.run.score ? JSON.parse(ctx.run.score) : null },
          case: { id: ctx.caseRow.id, title: ctx.caseRow.title, difficulty: ctx.caseRow.difficulty, specialty: ctx.caseRow.specialty },
          patient: ctx.scenario.patient,
          allergies: ctx.scenario.history.allergies || [],
          hasTheatre: !!(ctx.scenario.theatre && state.theatre),
          theatre: state.theatre || null,
          state: viewState(ctx, state, true),
          examsPerformed: state.examsPerformed || [],
          chat: chat.map((m: any) => ({ role: m.role, content: m.content, ts: m.ts })),
          orders: orders.map(orderJson),
          prescriptions: prescriptions.map(prescriptionJson),
          notes: notes.map((n: any) => ({ ...noteJson(n), author_name: n.authorId ? authorNames.get(n.authorId) || null : null })),
          observations: observations.map(observationJson),
        });
      }

      if (method === "GET" && p[2] === "state") {
        const state = JSON.parse(ctx.run.state);
        if (state.paused) return json(viewState(ctx, state, false));
        physiology.tick(ctx.scenario, state, ctx.run.id);
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json(viewState(ctx, state, true));
      }

      if (method === "POST" && p[2] === "chat") {
        const message = String((await body(req)).message || "").trim();
        if (!message) return fail(400, "Message required");
        const state = JSON.parse(ctx.run.state);
        if (state.dead) return fail(400, "Patient has died. Complete the debrief.");
        physiology.tick(ctx.scenario, state, ctx.run.id);
        const turn = await prisma.simChatMessage.count({ where: { runId: ctx.run.id, role: "learner" } });
        await prisma.simChatMessage.create({ data: { runId: ctx.run.id, role: "learner", content: message } });
        const reply = conversation.reply(ctx.scenario, state, message, turn);
        await prisma.simChatMessage.create({ data: { runId: ctx.run.id, role: "patient", content: reply } });
        const learnerMsgs = await prisma.simChatMessage.findMany({ where: { runId: ctx.run.id, role: "learner" }, orderBy: { id: "asc" } });
        state.tagsCovered = conversation.tagsCovered(ctx.scenario, learnerMsgs.map((m: any) => m.content));
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json({ reply });
      }

      if (method === "POST" && p[2] === "exam") {
        const system = String((await body(req)).system || "").trim();
        const systems = ctx.scenario.exam.systems || {};
        if (!systems[system]) return fail(400, "Unknown examination system", { available: Object.keys(systems) });
        const state = JSON.parse(ctx.run.state);
        state.examsPerformed = state.examsPerformed || [];
        if (!state.examsPerformed.includes(system)) {
          state.examsPerformed.push(system);
          await addEvent(ctx.run.id, state, "examination", { system });
          await persistState(ctx.run.id, state);
        }
        const findings = system === "general" ? ctx.scenario.exam.general : systems[system];
        return json({ system, findings });
      }

      if (p[2] === "orders" && method === "POST") {
        const { kind, item, justification, urgent } = await body(req);
        if (!["lab", "imaging"].includes(kind) || !item) return fail(400, "kind (lab|imaging) and item required");
        const state = JSON.parse(ctx.run.state);
        if (state.dead) return fail(400, "Patient has died.");
        const cat = kind === "lab"
          ? await prisma.simLabItem.findFirst({ where: { OR: [{ key: item }, { name: item }] } })
          : await prisma.simImagingItem.findFirst({ where: { OR: [{ key: item }, { name: item }] } });
        if (!cat) return fail(400, "Unknown investigation: " + item);
        const turnaround = cat.turnaroundMin || 30;
        // Real-time compression: ECG ~20s, CXR ~30s, CT ~40s, cultures ~3min
        const processingMs = 15000 + Math.min(turnaround, 240) * 600;
        const order = await prisma.simOrder.create({
          data: {
            runId: ctx.run.id, kind, itemKey: cat.key, justification: justification || "",
            status: "processing", urgent: !!urgent, resultedAt: new Date(Date.now() + processingMs),
          },
        });
        const mgmts = ctx.scenario.management.filter((m: any) => (m.type === "lab" || m.type === "imaging") && (m.item === cat.key || (!m.item && m.type === kind)));
        if (mgmts.length) physiology.completeManagement(state, mgmts[0].id, ctx.scenario);
        await addEvent(ctx.run.id, state, "order", { kind, item: cat.name, urgent: !!urgent, justification: justification || null });
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json({ orderId: order.id, status: "processing", resultedAt: new Date(Date.now() + processingMs).toISOString() });
      }

      if (p[2] === "orders" && method === "GET") {
        const state = JSON.parse(ctx.run.state);
        const pending = await prisma.simOrder.findMany({ where: { runId: ctx.run.id, status: "processing" }, orderBy: { id: "asc" } });
        for (const o of pending) {
          if (o.resultedAt && o.resultedAt.getTime() <= Date.now()) {
            const result = await buildResult(ctx.scenario, state, o);
            await prisma.simOrder.update({ where: { id: o.id }, data: { status: "resulted", result: JSON.stringify(result) } });
            if (result.critical) await addEvent(ctx.run.id, state, "critical_result", { item: result.name, value: result.value || result.finding });
            await persistState(ctx.run.id, state);
          }
        }
        const orders = await prisma.simOrder.findMany({ where: { runId: ctx.run.id }, orderBy: { id: "asc" } });
        return json({ orders: orders.map(orderJson) });
      }

      if (method === "POST" && p[2] === "prescribe") {
        const { drug, dose, route, frequency, duration } = await body(req);
        const d = await prisma.simDrug.findFirst({ where: { OR: [{ name: drug }, { generic: { contains: drug } }] } });
        if (!d) return fail(400, "Unknown drug in formulary: " + drug);
        const state = JSON.parse(ctx.run.state);
        if (state.dead) return fail(400, "Patient has died.");
        const existingRx = await prisma.simPrescription.findMany({ where: { runId: ctx.run.id, status: { not: "cancelled" } } });
        const allergies = ctx.scenario.history.allergies || [];
        const eGFR = 90; // baseline unless case says otherwise
        const check = safety.checkPrescription({ drug: d, prescribed: { dose, route }, patientAllergies: allergies, existingPrescriptions: existingRx.map((x: any) => x.drugKey), eGFR });
        const rx = await prisma.simPrescription.create({
          data: { runId: ctx.run.id, drugKey: d.name, dose: dose || d.adultDose, route: route || "oral", frequency: frequency || "once daily", duration: duration || "", checks: JSON.stringify(check) },
        });
        state.safetyEvents = state.safetyEvents || [];
        state.safetyEvents.push({ drug: d.name, ...check });
        if (check.blocked) {
          await addEvent(ctx.run.id, state, "prescription_blocked", { drug: d.name, reason: check.issues.filter((i: any) => i.severity === "critical").map((i: any) => i.message).join("; ") });
          await persistState(ctx.run.id, state);
          return json({ blocked: true, prescriptionId: rx.id, checks: check.issues, message: "PHARMACY SAFETY: prescription flagged. " + check.issues.filter((i: any) => i.severity === "critical").map((i: any) => i.message).join(" ") });
        }
        const key = d.name.toLowerCase();
        physiology.applyIntervention(ctx.scenario, state, key);
        const mgmt = ctx.scenario.management.find((m: any) => m.type === "drug" && (m.drugs || []).map((x: string) => x.toLowerCase()).includes(key));
        if (mgmt) physiology.completeManagement(state, mgmt.id, ctx.scenario);
        await prisma.simPrescription.update({ where: { id: rx.id }, data: { status: "administered" } });
        await addEvent(ctx.run.id, state, "medication", { drug: d.name, dose: dose || d.adultDose, route: route || "oral" });
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json({ blocked: false, prescriptionId: rx.id, checks: check.issues, message: `${d.name} administered.`, vitals: state.vitals });
      }

      if (method === "POST" && p[2] === "actions") {
        const reqBody = await body(req);
        const { type, value, system } = reqBody;
        const state = JSON.parse(ctx.run.state);
        if (state.dead && type !== "note") return fail(400, "Patient has died. Proceed to debrief.");
        switch (type) {
          case "oxygen": {
            physiology.applyIntervention(ctx.scenario, state, "oxygen");
            const mgmt = ctx.scenario.management.find((m: any) => m.type === "oxygen");
            if (mgmt) physiology.completeManagement(state, mgmt.id, ctx.scenario);
            await addEvent(ctx.run.id, state, "oxygen", { target: value || "94-98%" });
            break;
          }
          case "procedure": {
            const text = (value || "").toLowerCase();
            const mgmts = ctx.scenario.management.filter((m: any) => m.type === "procedure" && !state.completedManagement[m.id]);
            const match = mgmts.find((m: any) => {
              const words = m.label.toLowerCase().split(/\W+/).filter((w: string) => w.length > 4);
              return words.some((w: string) => text.includes(w));
            });
            if (match) {
              physiology.completeManagement(state, match.id, ctx.scenario);
              await addEvent(ctx.run.id, state, "procedure", { label: match.label });
            } else {
              await addEvent(ctx.run.id, state, "procedure_attempt", { label: value || "unspecified procedure", matched: false });
            }
            break;
          }
          case "defib": {
            physiology.completeManagement(state, "defib", ctx.scenario);
            await addEvent(ctx.run.id, state, "defibrillation", { energy: value || "200J" });
            break;
          }
          case "diagnosis": {
            state.finalDiagnosis = value || "";
            await addEvent(ctx.run.id, state, "diagnosis_submitted", { diagnosis: value });
            break;
          }
          case "admit": {
            const mgmt = ctx.scenario.management.find((m: any) => m.type === "admit");
            if (mgmt) physiology.completeManagement(state, mgmt.id, ctx.scenario);
            await addEvent(ctx.run.id, state, "admission", { destination: value || "ward" });
            break;
          }
          case "note": {
            await prisma.simClinicalNote.create({ data: { runId: ctx.run.id, authorId: user.id, type: system || "ward_round", content: value || "" } });
            state.notes = await prisma.simClinicalNote.count({ where: { runId: ctx.run.id } });
            await addEvent(ctx.run.id, state, "documentation", { system: system || "note" });
            break;
          }
          case "observation": {
            const o = reqBody;
            await prisma.simNursingObservation.create({
              data: {
                runId: ctx.run.id, authorId: user.id, hr: o.hr ?? null, sbp: o.sbp ?? null, dbp: o.dbp ?? null,
                rr: o.rr ?? null, temp: o.temp ?? null, spo2: o.spo2 ?? null, painScore: o.pain_score ?? null,
                gcs: o.gcs ?? null, consciousness: o.consciousness ?? null, urineOutput: o.urine_output ?? null,
                fluidBalance: o.fluid_balance ?? null, wound: o.wound ?? null, notes: o.notes || "",
              },
            });
            await addEvent(ctx.run.id, state, "nursing_observation", { recorded: true });
            break;
          }
          default:
            return fail(400, "Unknown action type");
        }
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json({ ok: true, state: viewState(ctx, state, true) });
      }

      if (method === "POST" && p[2] === "end") {
        const state = JSON.parse(ctx.run.state);
        if (!state.finalDiagnosis && (await body(req)).diagnosis) state.finalDiagnosis = (await body(req)).diagnosis;
        const learnerMsgs = await prisma.simChatMessage.findMany({ where: { runId: ctx.run.id, role: "learner" } });
        state.tagsCovered = conversation.tagsCovered(ctx.scenario, learnerMsgs.map((m: any) => m.content));
        const notes = await prisma.simClinicalNote.count({ where: { runId: ctx.run.id } });
        const orders = await prisma.simOrder.findMany({ where: { runId: ctx.run.id } });
        const chatLog = await prisma.simChatMessage.findMany({ where: { runId: ctx.run.id } });
        const run = {
          chatLog: chatLog.map((m: any) => ({ role: m.role, content: m.content })),
          tagsCovered: state.tagsCovered,
          examsPerformed: state.examsPerformed || [],
          finalDiagnosis: state.finalDiagnosis || "",
          safetyEvents: state.safetyEvents || [],
          notes: new Array(notes),
          orders: orders.map((o: any) => ({ item_key: o.itemKey, item: o.itemKey })),
        };
        const score = scoring.scoreRun(ctx.scenario, state, run);
        await prisma.simCaseRun.update({ where: { id: ctx.run.id }, data: { status: "completed", endedAt: new Date(), score: JSON.stringify(score) } });
        await audit(user.id, "run_complete", String(ctx.run.id));
        return json({ score });
      }

      if (method === "POST" && p[2] === "theatre") {
        if (!ctx.scenario.theatre) return fail(400, "This case has no surgical theatre component");
        const state = JSON.parse(ctx.run.state);
        if (!state.theatre) state.theatre = theatreEngine.createTheatre(ctx.scenario);
        const theatre = state.theatre;
        const block = ctx.scenario.theatre;
        const { action, data } = await body(req);
        let response: any = { ok: true };
        switch (action) {
          case "preop": {
            if (theatre.stage !== "preop") return fail(400, "Preoperative assessment already completed");
            theatre.preop = data || null;
            const s = theatreEngine.scorePreop(block, theatre.preop);
            theatre.stage = "consent";
            await addEvent(ctx.run.id, state, "theatre_preop", { score: s.score, asa: (data || {}).asaClass || null });
            response = { ok: s.ok, score: s.score, feedback: s.feedback };
            break;
          }
          case "consent": {
            if (theatre.stage !== "consent") return fail(400, "Consent already completed");
            theatre.consent = data || null;
            const s = theatreEngine.scoreConsent(block, theatre.consent);
            theatre.stage = "signin";
            await addEvent(ctx.run.id, state, "theatre_consent", { score: s.score });
            response = { ok: s.ok, score: s.score, feedback: s.feedback };
            break;
          }
          case "team": {
            theatre.team = { ...theatre.team, ...(data || {}) };
            await addEvent(ctx.run.id, state, "theatre_team", data || {});
            break;
          }
          case "signin": {
            if (!theatre.signIn) {
              theatre.signIn = data || {};
              const s = theatreEngine.scoreChecklist("signIn", theatre.signIn);
              await addEvent(ctx.run.id, state, "theatre_signin", { score: s.score });
              response = { ok: s.ok, score: s.score, feedback: s.feedback };
            }
            break;
          }
          case "timeout": {
            if (!theatre.timeOut) {
              theatre.timeOut = data || {};
              const s = theatreEngine.scoreChecklist("timeOut", theatre.timeOut);
              await addEvent(ctx.run.id, state, "theatre_timeout", { score: s.score });
              response = { ok: s.ok, score: s.score, feedback: s.feedback };
            }
            break;
          }
          case "signout": {
            if (!theatre.signOut) {
              theatre.signOut = data || {};
              const s = theatreEngine.scoreChecklist("signOut", theatre.signOut);
              await addEvent(ctx.run.id, state, "theatre_signout", { score: s.score });
              response = { ok: s.ok, score: s.score, feedback: s.feedback };
            }
            break;
          }
          case "step": {
            const stepId = (data || {}).stepId;
            const r = theatreEngine.applyStep(theatre, stepId);
            await addEvent(ctx.run.id, state, r.ok ? "theatre_step" : "theatre_step_failed", { stepId, error: r.error });
            response = r;
            if (r.complete) {
              theatre.stage = theatre.signOut ? "report" : "signout";
              await addEvent(ctx.run.id, state, "theatre_procedure_complete", { procedure: theatre.procedure });
            }
            break;
          }
          case "report": {
            theatre.report = data || null;
            const s = theatreEngine.scoreReport(theatre, theatre.report);
            theatre.stage = "complete";
            theatre.score = theatreEngine.scoreTheatre(theatre, block);
            const procWords = theatre.procedure.toLowerCase().split(/\W+/).filter((w: string) => w.length > 5);
            for (const m of ctx.scenario.management) {
              if (state.completedManagement[m.id]) continue;
              if (m.type !== "procedure") continue; // only hands-on procedural work is credited by theatre completion
              const labelWords = m.label.toLowerCase().split(/\W+/).filter((w: string) => w.length > 5);
              if (procWords.some((w: string) => labelWords.includes(w)) || labelWords.some((w: string) => procWords.includes(w))) {
                physiology.completeManagement(state, m.id, ctx.scenario);
              }
            }
            await addEvent(ctx.run.id, state, "theatre_complete", { procedure: theatre.procedure, score: theatre.score.total });
            response = { ok: s.ok, score: s.score, feedback: s.feedback, theatreScore: theatre.score };
            break;
          }
          default:
            return fail(400, "Unknown theatre action");
        }
        state.vitals = physiology.computeVitals(ctx.scenario, state, ctx.run.id);
        await persistState(ctx.run.id, state);
        return json({ ...response, stage: theatre.stage });
      }

      if (method === "GET" && p[2] === "studies") {
        const orders = await prisma.simOrder.findMany({
          where: { runId: ctx.run.id, kind: "imaging", status: "resulted" }, orderBy: { id: "asc" },
        });
        const studies = orders.map((o: any) => {
          const result = JSON.parse(o.result || "{}");
          return {
            orderId: o.id,
            accessionNumber: result.pacs ? result.pacs.accessionNumber : null,
            studyInstanceUID: result.pacs ? result.pacs.studyInstanceUID : null,
            seriesInstanceUID: result.pacs ? result.pacs.seriesInstanceUID : null,
            modality: result.pacs ? result.pacs.modality : "OT",
            bodyPart: result.pacs ? result.pacs.bodyPart : "—",
            studyDescription: result.name,
            seriesDescription: result.pacs ? result.pacs.seriesDescription : "—",
            seed: result.pacs ? result.pacs.seed : 1,
            finding: result.finding,
            critical: !!result.critical,
            simulated: true,
          };
        });
        return json({ studies, pacsNode: "MEDIC1905-PACS-SIM", simulated: true });
      }
    }

    // ——— instructor console ———
    if (p[0] === "instructor" && p[1] === "runs") {
      if (method === "GET" && !p[2]) {
        await requireUser(req, ["instructor", "admin"]);
        const rows = await prisma.simCaseRun.findMany({
          where: { status: { in: ["active", "paused"] } },
          orderBy: { startedAt: "desc" },
          include: { case: true, learner: true },
        });
        const runs = [];
        for (const r of rows) {
          const state = JSON.parse(r.state);
          const scenario = JSON.parse(r.case.scenario);
          const phase = (scenario.phases || []).find((ph: any) => ph.id === state.phase) || {};
          runs.push({
            runId: r.id, caseTitle: r.case.title, learner: r.learner.fullName, started: r.startedAt,
            paused: !!state.paused, phase: phase.name, news2: physiology.news2(state.vitals || {}),
            vitals: state.vitals, dead: !!state.dead,
            completedManagement: Object.keys(state.completedManagement || {}).length,
          });
        }
        return json({ runs });
      }
      if (method === "POST" && p[3] === "control") {
        const user = await requireUser(req, ["instructor", "admin"]);
        const ctx = await loadRun(idParam(p[2]));
        if (!ctx) return fail(404, "Run not found");
        const state = JSON.parse(ctx.run.state);
        const { action, complicationId, phaseId } = await body(req);
        switch (action) {
          case "pause":
            if (!state.paused) { state.paused = true; state.pausedAt = Date.now(); }
            break;
          case "resume":
            if (state.paused) { state.phaseEnteredAt += Date.now() - (state.pausedAt || Date.now()); state.paused = false; }
            break;
          case "inject": {
            const c = (ctx.scenario.complications || []).find((x: any) => x.id === complicationId);
            if (!c) return fail(400, "Unknown complication");
            state.pendingComplication = c.id;
            state.events.push({ type: "complication", name: c.name, description: c.description, at: new Date().toISOString(), injected: true });
            break;
          }
          case "set_phase": {
            const ph = (ctx.scenario.phases || []).find((x: any) => x.id === phaseId);
            if (!ph) return fail(400, "Unknown phase");
            state.phase = ph.id; state.phaseEnteredAt = Date.now();
            if (ph.recovery) state.recovered = true;
            break;
          }
          default:
            return fail(400, "Unknown control action");
        }
        await audit(user.id, "instructor_" + action, String(ctx.run.id), JSON.stringify({ complicationId, phaseId }));
        await persistState(ctx.run.id, state);
        return json({ ok: true, state: viewState(ctx, state, true) });
      }
    }

    // ——— master administration ———
    if (p[0] === "admin") {
      const user = await requireUser(req, ["admin"]);
      if (p[1] === "stats" && method === "GET") {
        const [users, regions, cities, hospitals, departments, cases, publishedCases, runs, completedRuns, prescriptions, auditEntries] = await Promise.all([
          prisma.simUser.count(), prisma.simRegion.count(), prisma.simCity.count(), prisma.simHospital.count(),
          prisma.simDepartment.count(), prisma.simCase.count(), prisma.simCase.count({ where: { status: "published" } }),
          prisma.simCaseRun.count(), prisma.simCaseRun.count({ where: { status: "completed" } }),
          prisma.simPrescription.count(), prisma.simAuditLog.count(),
        ]);
        return json({ users, regions, cities, hospitals, departments, cases, publishedCases, runs, completedRuns, prescriptions, auditEntries });
      }
      if (p[1] === "users" && method === "GET") {
        const users = await prisma.simUser.findMany({ orderBy: { createdAt: "desc" } });
        const runs = await prisma.simCaseRun.groupBy({ by: ["learnerId"], where: { status: "completed" }, _count: { learnerId: true } });
        const runMap = Object.fromEntries(runs.map((r: any) => [r.learnerId, r._count.learnerId]));
        return json({ users: users.map((u: any) => ({ ...userJson(u), created_at: u.createdAt, completedRuns: runMap[u.id] || 0 })) });
      }
      if (p[1] === "users" && p[2] && p[3] === "role" && method === "PUT") {
        const { role } = await body(req);
        if (!SIM_ROLES.includes(role)) return fail(400, "Invalid role");
        await prisma.simUser.update({ where: { id: idParam(p[2]) }, data: { role } });
        await audit(user.id, "role_change", p[2], role);
        return json({ ok: true });
      }
      if (p[1] === "audit" && method === "GET") {
        const entries = await prisma.simAuditLog.findMany({ orderBy: { id: "desc" }, take: 200 });
        const userIds = [...new Set(entries.map((a: any) => a.userId).filter(Boolean))] as number[];
        const users = userIds.length ? await prisma.simUser.findMany({ where: { id: { in: userIds } } }) : [];
        const nameMap: Map<number, string> = new Map(users.map((u: any) => [u.id, u.fullName] as [number, string]));
        return json({ audit: entries.map((a: any) => ({ id: a.id, ts: a.ts, user_id: a.userId, action: a.action, target: a.target, detail: a.detail, full_name: a.userId ? nameMap.get(a.userId) || null : null })) });
      }
      if (p[1] === "learners" && p[3] === "report" && method === "GET") {
        const learnerId = idParam(p[2]);
        const runs = await prisma.simCaseRun.findMany({
          where: { learnerId, status: "completed" }, orderBy: { endedAt: "desc" }, include: { case: true },
        });
        const scores = runs.map((r: any) => r.score ? JSON.parse(r.score) : null).filter(Boolean);
        const avg = scores.length ? Math.round(scores.reduce((s: number, x: any) => s + x.percentage, 0) / scores.length) : null;
        return json({
          runs: runs.map((r: any) => ({ id: r.id, title: r.case.title, difficulty: r.case.difficulty, ended: r.endedAt, score: r.score ? JSON.parse(r.score) : null })),
          averageScore: avg,
          weakest: avg ? scores.flatMap((s: any) => s.dimensions).reduce((acc: any, d: any) => {
            const key = d.dimension;
            const ratio = d.score / d.max;
            if (!acc[key]) acc[key] = { total: 0, max: 0 };
            acc[key].total += d.score; acc[key].max += d.max;
            return acc;
          }, {}) : null,
        });
      }
    }

    return fail(404, "Not found");
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message, err.extra);
    console.error("[simulator] route error", err);
    return fail(500, "Internal simulator error");
  }
}
