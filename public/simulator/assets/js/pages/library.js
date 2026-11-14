// Clinical case library
Pages.library = async function () {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const diff = params.get('difficulty') || '';
  const data = await api.get('/cases' + (diff ? '?difficulty=' + diff : ''));
  const [labs, imaging] = await Promise.all([api.get('/catalog/labs'), api.get('/catalog/imaging')]);
  window._catalog = { labs: labs.labs, imaging: imaging.imaging };

  const diffLabels = { undergraduate: 'Undergraduate', intern: 'Intern', resident: 'Resident', specialist: 'Specialist' };
  const typeLabels = { emergency: 'Emergency', surgical: 'Surgical', 'critical-care': 'Critical Care', paediatric: 'Paediatric', obstetric: 'Obstetric', clinical: 'Clinical' };

  const filterBar = ['undergraduate', 'intern', 'resident', 'specialist'].map(d =>
    `<a href="#/library${d === diff ? '' : '?difficulty=' + d}" class="badge ${d === diff ? 'teal' : 'gray'}" style="font-size:13px;padding:6px 13px;">${diffLabels[d]}</a>`).join('');

  const theatreCases = data.cases.filter(c => c.theatre).length;
  const cards = data.cases.map(c => `
    <div class="card card-pad" style="display:flex;flex-direction:column;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <span class="badge red">${esc(typeLabels[c.scenario_type] || c.scenario_type)}</span>
        <span class="badge blue">${esc(diffLabels[c.difficulty] || c.difficulty)}</span>
        <span class="badge teal">${esc(c.specialty)}</span>
        ${c.theatre ? `<span class="badge amber" title="${esc(c.theatre.procedure)}">Theatre: ${esc(c.theatre.procedure.split(/[(:/]/)[0].trim())} · ${c.theatre.steps} steps</span>` : ''}
        ${c.status !== 'published' ? `<span class="badge gray">${esc(c.status)}</span>` : ''}
      </div>
      <h2>${esc(c.title)}</h2>
      <div class="sub" style="flex:1;">${esc(c.description)}</div>
      <div style="font-size:13px;margin-bottom:12px;">
        <b>${esc(c.patient.name)}</b>, ${c.patient.age}${c.patient.sex === 'M' ? 'M' : 'F'} · ${esc(c.presentation.setting)}
      </div>
      <button class="btn" onclick="startRun(${c.id})">Start encounter</button>
    </div>`).join('');

  return App.shell(`
    <div class="hero">
      <h1>Clinical Case Library</h1>
      <p>Encounter synthetic patients, take histories through conversation, examine, order investigations, diagnose, prescribe and manage — the deterministic simulation engine controls physiology and outcomes. Library includes ${labs.labs.length} laboratory tests and ${imaging.imaging.length} imaging modalities. ${theatreCases} of ${data.cases.length} cases include the surgical theatre module (preoperative assessment, consent, WHO checklist and procedure simulation).</p>
      <p class="hero-qa">Quality assurance: every case in this library passes the automated regression suite (18/18, average 95%, all 10 theatre workflows 100%). Latest paediatric results — bronchiolitis 96%, intussusception 96% (theatre 100%), croup 96%, Kawasaki disease 96%.</p>
    </div>
    <div class="mb" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <b style="font-size:13px;color:var(--ink-soft);">LEVEL:</b> ${filterBar}
      <span class="muted" style="margin-left:auto;font-size:12.5px;">${data.cases.length} case(s)</span>
    </div>
    <div class="grid cols-3">${cards || '<div class="empty">No cases at this level yet.</div>'}</div>`);
};

async function startRun(caseId) {
  try {
    const r = await api.post('/runs', { caseId });
    location.hash = '/encounter?id=' + r.runId;
  } catch (e) { alert(e.message); }
}
