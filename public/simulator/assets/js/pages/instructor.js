// Instructor console — live monitoring, controls, case management
Pages.instructor = async function () {
  const [runs, cases] = await Promise.all([api.get('/instructor/runs'), api.get('/cases')]);
  window._instrRuns = runs.runs;
  window._instrCases = cases.cases;
  return App.shell(`
  <div class="hero"><h1>Instructor Console</h1>
  <p>Monitor live learner encounters, inject complications, pause and steer simulations, and manage the case library.</p></div>
  <div class="card card-pad mb">
    <h2>Live encounters</h2>
    <div class="sub">Auto-refreshes every 5 seconds. Click a row to open control actions.</div>
    <div id="live-runs">${liveRunsHtml(runs.runs)}</div>
  </div>
  <div class="card card-pad">
    <h2>Case library management</h2>
    <div class="sub">Author, duplicate, publish and edit cases. Scenario JSON format is documented in docs/ARCHITECTURE.md.</div>
    <table>
      <tr><th>Case</th><th>Level</th><th>Type</th><th>Status</th><th>Actions</th></tr>
      ${cases.cases.map(c => `
        <tr>
          <td><b>${esc(c.title)}</b><br><span class="muted" style="font-size:12px;">${esc(c.key)}</span></td>
          <td><span class="badge blue">${esc(c.difficulty)}</span></td>
          <td>${esc(c.scenario_type)}</td>
          <td><span class="badge ${c.status === 'published' ? 'green' : 'gray'}">${esc(c.status)}</span></td>
          <td>
            ${c.status !== 'published' ? `<button class="btn sm" onclick="publishCase(${c.id})">Publish</button>` : ''}
            <button class="btn secondary sm" onclick="duplicateCase(${c.id})">Duplicate</button>
            <button class="btn secondary sm" onclick="exportCase(${c.id})">Export JSON</button>
          </td>
        </tr>`).join('')}
    </table>
    <div class="mt alert info"><b>Authoring:</b> create new cases via <span class="kbd">POST /api/cases</span> with the scenario schema (interview script, exam findings, phase-linked vitals/labs/imaging, hidden diagnosis, management targets, rubric, debrief). Duplicate an existing case and edit the JSON as a starting point.</div>
  </div>`);
};

function liveRunsHtml(runs) {
  if (!runs.length) return '<div class="empty">No active encounters right now.</div>';
  return `<table>
    <tr><th>Learner</th><th>Case</th><th>Phase</th><th>NEWS2</th><th>Vitals</th><th>Progress</th><th>Controls</th></tr>
    ${runs.map(r => `
      <tr id="run-row-${r.runId}">
        <td><b>${esc(r.learner)}</b></td>
        <td>${esc(r.caseTitle)}</td>
        <td>${esc(r.phase)}${r.dead ? ' <span class="badge red">DECEASED</span>' : ''}</td>
        <td><span class="news-chip ${r.news2 >= 7 ? 'news-5plus' : r.news2 >= 5 ? 'news-1-4' : 'news-0'}">${r.news2}</span></td>
        <td class="mono" style="font-size:12px;">HR ${r.vitals?.hr} BP ${r.vitals?.sbp}/${r.vitals?.dbp} SpO2 ${r.vitals?.spo2}</td>
        <td>${r.completedManagement} steps</td>
        <td>
          <button class="btn secondary sm" onclick="togglePause(${r.runId})">${r.paused ? 'Resume' : 'Pause'}</button>
          <button class="btn danger sm" onclick="showInject(${r.runId})">Inject</button>
        </td>
      </tr>`).join('')}
  </table>`;
}

async function togglePause(runId) {
  const r = window._instrRuns.find(x => x.runId === runId);
  await api.post(`/instructor/runs/${runId}/control`, { action: r.paused ? 'resume' : 'pause' });
  refreshInstructor();
}
function showInject(runId) {
  const complication = prompt('Complication to inject (e.g. vf_arrest, seizure, septic_shock — depends on case definition). Leave the run to see case-specific ids:');
  if (complication === null) return;
  if (!complication.trim()) return alert('Enter a complication id from the case definition.');
  api.post(`/instructor/runs/${runId}/control`, { action: 'inject', complicationId: complication.trim() })
    .then(() => { alert('Complication injected.'); refreshInstructor(); })
    .catch(e => alert(e.message));
}
async function publishCase(id) {
  await api.post(`/cases/${id}/publish`);
  refreshInstructor();
}
async function duplicateCase(id) {
  await api.post(`/cases/${id}/duplicate`);
  refreshInstructor();
}
async function exportCase(id) {
  const c = await api.get('/cases/' + id);
  const blob = new Blob([JSON.stringify(c.case, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = c.case.key + '.json';
  a.click();
}
async function refreshInstructor() {
  try {
    const runs = await api.get('/instructor/runs');
    window._instrRuns = runs.runs;
    const el = document.getElementById('live-runs');
    if (el) el.innerHTML = liveRunsHtml(runs.runs);
  } catch (e) { /* ignore */ }
}
setInterval(() => { if (location.hash.includes('/instructor')) refreshInstructor(); }, 5000);
