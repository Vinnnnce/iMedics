// Medic1905 surgical theatre simulation engine.
// Deterministic workflow state machine: preoperative assessment → consent →
// WHO surgical safety checklist (sign-in / time-out / sign-out) → procedure
// steps → operative report. No generative AI invents clinical facts here.

const ROMAN_ASA = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
function parseAsa(a) {
  if (typeof a === 'number') return a;
  const m = String(a || '').match(/ASA\s*([IVX]+)/i);
  return m && ROMAN_ASA[m[1].toUpperCase()] ? ROMAN_ASA[m[1].toUpperCase()] : 3;
}

function createTheatre(scenario) {
  const theatre = scenario.theatre || null;
  if (!theatre) return null;
  return {
    procedure: theatre.procedure,
    anaesthesia: theatre.anaesthesia,
    asa: parseAsa(theatre.asa),
    asaText: typeof theatre.asa === 'string' ? theatre.asa : 'ASA ' + parseAsa(theatre.asa),
    risks: theatre.risks,
    steps: theatre.steps.map((s, i) => typeof s === 'string'
      ? { id: 'step_' + (i + 1), name: s, detail: '' }
      : { ...s, done: false }),
    // workflow stages
    stage: 'preop',          // preop -> consent -> signin -> timeout -> procedure -> signout -> report
    preop: null,             // { asaClass, airway, fasting, comorbidities }
    consent: null,           // { discussedRisks, alternatives, signatureName, signatureRole }
    signIn: null,            // WHO sign-in answers
    timeOut: null,           // WHO time-out answers
    signOut: null,           // WHO sign-out answers
    team: { surgeon: null, anaesthetist: null, scrub: null, circulating: null },
    stepsLog: [],            // order of completed step ids
    report: null,            // { findings, procedureDone, complications, swabCount, durationMin }
    score: null,
    startedAt: new Date().toISOString()
  };
}

// ——— Preoperative assessment scoring (deterministic) ———
function scorePreop(theatreBlock, preop) {
  if (!preop) return { ok: false, score: 0, feedback: [] };
  let score = 0, feedback = [];
  // ASA class expected within ±1 of the case's ASA
  const expected = parseAsa(theatreBlock.asa);
  if (preop.asaClass) {
    if (Math.abs(preop.asaClass - expected) <= 1) { score += 25; }
    else { feedback.push(`ASA class recorded as ${preop.asaClass}; the case team graded this patient ASA ${expected}.`); }
  } else feedback.push('ASA physical status was not recorded.');
  if (preop.airway) { score += 20; }
  else feedback.push('Airway assessment (Mallampati / mouth opening) was not documented.');
  if (preop.fasting) { score += 20; }
  else feedback.push('Fasting status was not confirmed before anaesthesia.');
  if (preop.comorbidities) { score += 15; }
  else feedback.push('Comorbidities and fitness for surgery were not reviewed.');
  if (preop.allergiesConfirmed) { score += 20; }
  else feedback.push('Allergy check was not confirmed at preoperative assessment.');
  return { ok: score >= 60, score, feedback };
}

// ——— Consent validation ———
function scoreConsent(theatreBlock, consent) {
  if (!consent) return { ok: false, score: 0, feedback: [] };
  let score = 0, feedback = [];
  const discussed = consent.discussedRisks || [];
  const expectedRisks = theatreBlock.risks.slice(0, 3); // the major, must-discuss risks
  const covered = expectedRisks.filter(r => discussed.includes(r)).length;
  score += Math.round((covered / expectedRisks.length) * 50);
  if (covered < expectedRisks.length) feedback.push('Not all of the three major procedure-specific risks were discussed with the patient.');
  if (consent.alternatives) score += 15; else feedback.push('Alternative options (including conservative management) were not discussed.');
  if (consent.signatureName) score += 20; else feedback.push('The consent form was not signed by the patient (or their legal representative).');
  if (consent.signatureRole) score += 15; else feedback.push('The clinician taking consent was not recorded on the form.');
  return { ok: score >= 60, score, feedback };
}

// ——— WHO checklist validation ———
const CHECKLIST = {
  signIn: ['patient_identity', 'site', 'procedure', 'allergies', 'airway_risk', 'blood_loss'],
  timeOut: ['introduce_team', 'patient_confirm', 'site_marking', 'imaging', 'critical_events', 'antibiotic_timing'],
  signOut: ['procedure_recorded', 'instrument_count', 'specimen_labelled', 'key_concerns']
};

function scoreChecklist(phase, answers) {
  const expected = CHECKLIST[phase] || [];
  if (!answers) return { ok: false, score: 0, feedback: [`The ${phase.replace('In', ' in')} checklist was not performed.`] };
  let done = 0, feedback = [];
  for (const item of expected) {
    if (answers[item]) done++;
    else feedback.push(`Checklist item not confirmed: ${item.replace(/_/g, ' ')}.`);
  }
  const score = Math.round((done / expected.length) * 100);
  return { ok: done >= expected.length - 1, score, feedback };
}

// ——— Procedure steps: correct-order validation ———
function applyStep(theatre, stepId) {
  const idx = theatre.steps.findIndex(s => s.id === stepId);
  if (idx === -1) return { ok: false, error: 'unknown_step', message: 'That is not a step of this procedure.' };
  if (theatre.steps[idx].done) return { ok: false, error: 'already_done', message: 'That step has already been completed.' };
  const nextIdx = theatre.steps.findIndex(s => !s.done);
  if (idx !== nextIdx) {
    return {
      ok: false, error: 'out_of_order',
      message: `Out of order — the next step is "${theatre.steps[nextIdx].name}". In theatre, doing steps out of sequence endangers the patient.`
    };
  }
  theatre.steps[idx].done = true;
  theatre.stepsLog.push(stepId);
  const complete = theatre.steps.every(s => s.done);
  return { ok: true, complete, message: theatre.steps[idx].detail || 'Step completed.' };
}

// ——— Operative report scoring ———
function scoreReport(theatre, report) {
  if (!report) return { ok: false, score: 0, feedback: [] };
  let score = 0, feedback = [];
  if (report.findings) score += 30; else feedback.push('Operative findings were not documented.');
  if (report.procedureDone) score += 30; else feedback.push('The procedure performed was not documented.');
  if (report.swabCount === 'correct') score += 25;
  else if (report.swabCount === 'mismatch') { feedback.push('Swab/instrument count mismatch was recorded — correct theatre protocol requires stopping to resolve it before closure.'); score += 10; }
  else feedback.push('Swab and instrument counts were not confirmed at sign-out.');
  if (report.complications) score += 15; else feedback.push('Complications (or their absence) were not documented.');
  return { ok: score >= 60, score, feedback };
}

// ——— Full theatre completion scoring ———
function scoreTheatre(theatre, theatreBlock) {
  const preop = scorePreop(theatreBlock, theatre.preop);
  const consent = scoreConsent(theatreBlock, theatre.consent);
  const signIn = scoreChecklist('signIn', theatre.signIn);
  const timeOut = scoreChecklist('timeOut', theatre.timeOut);
  const signOut = scoreChecklist('signOut', theatre.signOut);
  const report = scoreReport(theatre, theatre.report);
  const total = Math.round(
    (preop.score * 0.2) + (consent.score * 0.2) + (signIn.score * 0.15) +
    (timeOut.score * 0.15) + (signOut.score * 0.1) + (report.score * 0.2)
  );
  const feedback = [...preop.feedback, ...consent.feedback, ...signIn.feedback, ...timeOut.feedback, ...signOut.feedback, ...report.feedback];
  return { total, breakdown: { preop: preop.score, consent: consent.score, signIn: signIn.score, timeOut: timeOut.score, signOut: signOut.score, report: report.score }, feedback };
}

module.exports = { createTheatre, scorePreop, scoreConsent, scoreChecklist, applyStep, scoreReport, scoreTheatre, CHECKLIST };
