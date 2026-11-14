// Deterministic clinical simulation engine.
// Controls physiological states, phase transitions, intervention effects,
// complications and outcomes. Generative AI NEVER sets vitals, labs,
// diagnoses or outcomes — only this validated rule engine does.

const DAY_MS = 60 * 1000; // 1 simulated minute = 1 real second? No — realtime minutes.

function newState(scenario, runId) {
  const v = scenario.baselineVitals;
  return {
    phase: 0,
    phaseEnteredAt: Date.now(),
    startedAt: Date.now(),
    vitals: { ...v },
    interventions: [],        // [{key, at}]
    completedManagement: {},  // mgmtId -> {at, points}
    complications: [],        // fired complication ids
    pendingComplication: null,
    events: [],
    dead: false,
    recovered: false,
    lastUpdate: Date.now()
  };
}

function news2(v) {
  let s = 0;
  const hr = v.hr, rr = v.rr, spo2 = v.spo2, sbp = v.sbp, temp = v.temp;
  if (rr <= 8) s += 3; else if (rr <= 11) s += 1; else if (rr >= 25) s += 3; else if (rr >= 21) s += 2;
  if (spo2 <= 91) s += 3; else if (spo2 <= 93) s += 2; else if (spo2 <= 95) s += 1;
  if (hr <= 40) s += 3; else if (hr <= 50) s += 2; else if (hr <= 90) s += 1;
  else if (hr >= 131) s += 3; else if (hr >= 111) s += 2; else if (hr >= 91) s += 1;
  if (sbp <= 90) s += 3; else if (sbp <= 100) s += 2; else if (sbp <= 110) s += 1;
  if (temp <= 35.0) s += 3; else if (temp < 36.1) s += 1; else if (temp >= 39.1) s += 2; else if (temp >= 38.1) s += 1;
  return s;
}

function minutesSince(ts) { return (Date.now() - ts) / 60000; }

// Deterministic pseudo-jitter seeded by run + phase so repeated renders are stable
function jitter(seed, amp) {
  const x = Math.sin(seed * 99991) * 10000;
  const f = x - Math.floor(x);
  return (f - 0.5) * 2 * amp;
}

function computeVitals(scenario, state, runId) {
  if (state.dead) return state.vitals;
  const phases = scenario.phases;
  const phase = phases.find(p => p.id === state.phase);
  let target;
  if (phase && phase.vitals) target = { ...phase.vitals };
  else if (phase && phase.id === 0) target = { ...scenario.baselineVitals };
  else target = { ...state.vitals };

  // Apply cumulative intervention effects as offsets from phase target
  const v = { ...target };
  const applied = {};
  for (const iv of state.interventions) {
    const eff = (scenario.interventions || {})[iv.key];
    if (!eff) continue;
    applied[iv.key] = (applied[iv.key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(applied)) {
    const eff = scenario.interventions[key];
    for (const [metric, delta] of Object.entries(eff)) {
      // diminishing returns after first dose (0.4x per repeat)
      let d = delta;
      for (let i = 1; i < count; i++) d += delta * 0.4;
      v[metric] = (v[metric] || 0) + d;
    }
  }
  // pending complication vitals override
  if (state.pendingComplication) {
    const c = scenario.complications.find(c => c.id === state.pendingComplication);
    if (c && c.vitals) Object.assign(v, c.vitals);
  }
  // Physiological clamps
  v.spo2 = Math.max(40, Math.min(100, Math.round(v.spo2)));
  v.hr = Math.max(0, Math.min(220, Math.round(v.hr)));
  v.sbp = Math.max(0, Math.min(250, Math.round(v.sbp)));
  v.dbp = Math.max(0, Math.min(150, Math.round(v.dbp)));
  v.rr = Math.max(0, Math.min(60, Math.round(v.rr)));
  v.temp = Math.round(v.temp * 10) / 10;
  v.gcs = Math.max(3, Math.min(15, Math.round(v.gcs)));
  v.pain = Math.max(0, Math.min(10, Math.round(v.pain)));
  return v;
}

// Called on every state read. Advances phases, fires complications, resolves deaths.
function tick(scenario, state, runId) {
  if (state.dead || state.recovered) return state;
  const phases = scenario.phases;
  const phase = phases.find(p => p.id === state.phase);
  if (!phase) return state;
  const elapsed = minutesSince(state.phaseEnteredAt);

  // Fire due complications
  for (const c of scenario.complications || []) {
    if (state.complications.includes(c.id) || state.pendingComplication === c.id) continue;
    const t = c.trigger;
    if (!t) continue;
    if (t.phase !== state.phase) continue;
    if (t.afterMin && elapsed < t.afterMin) continue;
    if (t.ifNotDone && t.ifNotDone.some(id => state.completedManagement[id])) continue;
    if (t.chance !== undefined) {
      const roll = Math.abs(Math.sin(runId * 7919 + state.phase * 104729 + Math.floor(elapsed))) % 1;
      if (roll > t.chance) continue;
    }
    state.pendingComplication = c.id;
    state.events.push({ type: 'complication', name: c.name, description: c.description, at: new Date().toISOString() });
    if (c.vitals && (c.vitals.hr === 0 || c.vitals.sbp === 0)) {
      // arrest-type complication: requires resuscitation within deathAfterMin
    }
    break;
  }

  // Death from unresolved arrest-type complication
  if (state.pendingComplication) {
    const c = scenario.complications.find(c => c.id === state.pendingComplication);
    if (c && c.vitals && (c.vitals.hr === 0 || c.vitals.sbp === 0)) {
      const handled = state.completedManagement['defib'] || state.completedManagement['resuscitate'];
      if (handled) {
        state.pendingComplication = null;
        state.complications.push(c.id + '-survived');
        state.events.push({ type: 'resuscitated', name: c.name + ' — successful resuscitation', at: new Date().toISOString() });
      } else if (c.deathAfterMin && elapsed > 0) {
        const cFire = state.events.find(e => e.type === 'complication');
        const firedAt = cFire ? Date.parse(cFire.at) : Date.now();
        if (Date.now() - firedAt > c.deathAfterMin * 60000) {
          state.dead = true;
          state.events.push({ type: 'death', description: 'Patient died: ' + c.name, at: new Date().toISOString() });
        }
      }
    }
  }

  // Phase timeout progression
  if (phase.maxMin && elapsed > phase.maxMin && !state.pendingComplication) {
    if (phase.timeoutNext === 'death') {
      state.dead = true;
      state.events.push({ type: 'death', description: 'Patient died from untreated ' + phase.name, at: new Date().toISOString() });
    } else if (phase.timeoutNext !== undefined && phase.timeoutNext !== null) {
      const next = phases.find(p => p.id === phase.timeoutNext);
      state.phase = phase.timeoutNext;
      state.phaseEnteredAt = Date.now();
      if (next) {
        state.events.push({ type: 'phase', name: next.name, description: next.description, at: new Date().toISOString() });
        if (next.recovery) state.recovered = true;
        if (next.death) { state.dead = true; state.events.push({ type: 'death', description: next.description, at: new Date().toISOString() }); }
      }
    }
  }
  return state;
}

// Record an intervention (drug administration, oxygen)
function applyIntervention(scenario, state, key) {
  state.interventions.push({ key, at: Date.now() });
}

// Record management step completion
function completeManagement(state, mgmtId, scenario) {
  const mgmt = (scenario.management || []).find(m => m.id === mgmtId);
  if (!mgmt) return { ok: false, reason: 'unknown step' };
  if (state.completedManagement[mgmtId]) return { ok: false, reason: 'already done' };
  const elapsed = minutesSince(state.startedAt);
  const onTime = elapsed <= (mgmt.withinMin || Infinity);
  state.completedManagement[mgmtId] = { at: Date.now(), minutes: Math.round(elapsed * 10) / 10, onTime, points: mgmt.points, critical: !!mgmt.critical };
  state.events.push({ type: 'management', id: mgmtId, label: mgmt.label, minutes: Math.round(elapsed), onTime, at: new Date().toISOString() });
  // Check stabilization: if all critical steps of current phase are done, move to stabilizeNext
  const phase = scenario.phases.find(p => p.id === state.phase);
  if (phase && phase.stabilizeNext !== undefined && phase.stabilizeNext !== null && !phase.recovery && !phase.death) {
    const criticals = scenario.management.filter(m => m.critical);
    const allCriticals = criticals.every(m => state.completedManagement[m.id]);
    if (allCriticals || criticals.length === 0) {
      const next = scenario.phases.find(p => p.id === phase.stabilizeNext);
      if (next) {
        state.phase = phase.stabilizeNext;
        state.phaseEnteredAt = Date.now();
        state.events.push({ type: 'phase', name: next.name, description: next.description, at: new Date().toISOString() });
        if (next.recovery) state.recovered = true;
      }
    }
  }
  return { ok: true, onTime };
}

module.exports = { newState, computeVitals, news2, tick, applyIntervention, completeManagement, minutesSince };
