// Assessment & scoring engine.
// Produces the learner report: dimension scores, missed findings,
// diagnostic accuracy, medication safety, timeliness and a full debrief.
// Scores are educational feedback only — NOT a licence or certification.

function scoreRun(scenario, state, run) {
  const rubric = scenario.rubric;
  const events = state.events || [];
  const askedQuestions = (run.chatLog || []).filter(m => m.role === 'learner').map(m => m.content);
  const coveredTags = run.tagsCovered || [];

  const dims = [];
  const totalPossible = Object.values(rubric).reduce((s, d) => s + d.points, 0);
  let total = 0;

  // ——— History: fraction of interview tags covered ———
  const allTags = new Set();
  (scenario.interview || []).forEach(i => (i.tags || []).forEach(t => allTags.add(t)));
  const histCovered = [...allTags].filter(t => coveredTags.includes(t)).length;
  const histRatio = allTags.size ? histCovered / allTags.size : 1;
  const pretty = (t) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  dims.push({ dimension: 'History taking', score: Math.round(rubric.history.points * histRatio), max: rubric.history.points,
    detail: `${histCovered}/${allTags.size} key history areas covered (${[...allTags].filter(t => !coveredTags.includes(t)).map(pretty).join(', ') || 'complete'})` });

  // ——— Examination ———
  const examDone = (run.examsPerformed || []).length;
  const systemsAvailable = Object.keys(scenario.exam.systems || {}).length;
  const examRatio = systemsAvailable ? Math.min(1, examDone / systemsAvailable) : 1;
  dims.push({ dimension: 'Clinical examination', score: Math.round(rubric.examination.points * examRatio), max: rubric.examination.points,
    detail: `${examDone}/${systemsAvailable} systems examined` });

  // ——— Investigations: expected vs ordered ———
  // An expected investigation counts as ordered when its management entry was
  // credited by the engine (matched by item key, or any order of that kind for
  // item-less expectations like "bloods").
  const expectedInv = (scenario.management || []).filter(m => m.type === 'lab' || m.type === 'imaging' || m.label.toLowerCase().includes('test'));
  const creditedInv = expectedInv.filter(m => (state.completedManagement || {})[m.id]).length;
  const invRatio = expectedInv.length ? Math.min(1, creditedInv / expectedInv.length) : 1;
  dims.push({ dimension: 'Investigation selection', score: Math.round(rubric.investigations.points * invRatio), max: rubric.investigations.points,
    detail: `${expectedInv.length} expected investigations, ${creditedInv} appropriate ordered` });

  // ——— Diagnosis ———
  const submitted = (run.finalDiagnosis || '').toLowerCase();
  const aliases = scenario.hidden.aliases.map(a => a.toLowerCase());
  const dxMatch = aliases.some(a => submitted.includes(a));
  let dxScore = 0;
  if (dxMatch) dxScore = rubric.diagnosis.points * 0.75;
  if (dxMatch && submitted.length > 15) dxScore += rubric.diagnosis.points * 0.25; // some reasoning shown
  dims.push({ dimension: 'Diagnostic accuracy', score: Math.round(dxScore), max: rubric.diagnosis.points,
    detail: dxMatch ? `Correct diagnosis identified: ${scenario.hidden.diagnosis}` : `Submitted: "${run.finalDiagnosis || 'none'}" — correct answer was ${scenario.hidden.diagnosis}` });

  // ——— Management: completed management steps ———
  const mgmt = scenario.management || [];
  const done = mgmt.filter(m => state.completedManagement[m.id]);
  const mgmtRatio = mgmt.length ? done.length / mgmt.length : 1;
  const onTimeCritical = mgmt.filter(m => m.critical && state.completedManagement[m.id]?.onTime).length;
  const criticalTotal = mgmt.filter(m => m.critical).length;
  let mgmtScore = rubric.management.points * mgmtRatio * 0.7;
  if (criticalTotal) mgmtScore += rubric.management.points * 0.3 * (onTimeCritical / criticalTotal);
  dims.push({ dimension: 'Clinical management', score: Math.round(mgmtScore), max: rubric.management.points,
    detail: `${done.length}/${mgmt.length} management steps completed; ${onTimeCritical}/${criticalTotal} critical steps on time` });

  // ——— Safety: blocked prescriptions / unsafe acts ———
  const unsafeActs = (run.safetyEvents || []).filter(e => e.severity === 'critical').length;
  const blockedGiven = (run.safetyEvents || []).filter(e => e.blocked && e.administeredAnyway).length;
  let safetyScore = rubric.safety.points;
  safetyScore -= (unsafeActs * rubric.safety.points * 0.25 + blockedGiven * rubric.safety.points * 0.5);
  safetyScore = Math.max(0, Math.round(safetyScore));
  dims.push({ dimension: 'Medication safety', score: safetyScore, max: rubric.safety.points,
    detail: blockedGiven ? `${blockedGiven} blocked/unsafe medication attempts` : (unsafeActs ? `${unsafeActs} safety alerts encountered` : 'No unsafe prescribing events') });

  // ——— Communication: questions asked + reassurance ———
  const qCount = askedQuestions.length;
  const commRatio = Math.min(1, qCount / 8);
  const reassured = askedQuestions.some(q => /don.t worry|fine|safe|help you|here for you/i.test(q));
  let commScore = rubric.communication.points * commRatio * (reassured ? 1 : 0.8);
  dims.push({ dimension: 'Communication', score: Math.round(commScore), max: rubric.communication.points,
    detail: `${qCount} questions asked${reassured ? ', reassurance given' : ', no reassurance detected'}` });

  // ——— Documentation ———
  const noteCount = (run.notes || []).length;
  const docScore = Math.min(rubric.documentation.points, Math.round(rubric.documentation.points * noteCount / 2));
  dims.push({ dimension: 'Documentation', score: docScore, max: rubric.documentation.points,
    detail: `${noteCount} clinical note(s) written` });

  // ——— Timeliness ———
  const lateCritical = mgmt.filter(m => m.critical && state.completedManagement[m.id] && !state.completedManagement[m.id].onTime).length;
  let timeScore = rubric.timeliness.points;
  if (criticalTotal) timeScore -= rubric.timeliness.points * 0.3 * (lateCritical / criticalTotal);
  timeScore = Math.max(0, Math.round(timeScore));
  dims.push({ dimension: 'Timeliness', score: timeScore, max: rubric.timeliness.points,
    detail: lateCritical ? `${lateCritical} critical action(s) delayed` : 'All critical actions within target time' });

  total = dims.reduce((s, d) => s + d.score, 0);
  const pct = totalPossible ? Math.round(100 * total / totalPossible) : 0;
  const grade = pct >= 85 ? 'Excellent — consultant-level performance' : pct >= 70 ? 'Good — safe and thorough, refine details' : pct >= 55 ? 'Satisfactory — core skills present, gaps to close' : pct >= 40 ? 'Borderline — significant gaps identified' : 'Unsatisfactory — structured review recommended';
  const outcome = state.dead ? 'Patient died' : state.recovered ? 'Patient recovered' : `Simulation ended in phase: ${(scenario.phases.find(p => p.id === state.phase) || {}).name || state.phase}`;

  const missed = mgmt.filter(m => !state.completedManagement[m.id]).map(m => m.label);
  const missedFindings = [...allTags].filter(t => !coveredTags.includes(t));

  return {
    total, totalPossible, percentage: pct, grade, outcome,
    dimensions: dims,
    missedManagement: missed,
    missedHistory: missedFindings,
    debrief: {
      summary: scenario.debrief.summary,
      learningPoints: scenario.debrief.learningPoints,
      references: scenario.debrief.references,
      correctDiagnosis: scenario.hidden.diagnosis,
      expectedDifferentials: scenario.hidden.differentials
    }
  };
}

module.exports = { scoreRun };
