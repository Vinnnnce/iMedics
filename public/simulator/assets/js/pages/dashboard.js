// Dashboard + login
Pages.login = function () {
  return `
  <div style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(140deg,#123a5c,#095c56);">
    <div style="width:100%;max-width:440px;padding:20px;">
      <div class="card card-pad" style="box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <div style="text-align:center;margin-bottom:18px;">
          <div style="width:64px;height:64px;background:#123a5c;border-radius:14px;display:grid;place-items:center;margin:0 auto 10px;color:#fff;font-size:34px;font-weight:900;">+</div>
          <h1 style="font-size:24px;">Medic1905</h1>
          <div class="muted">Virtual Teaching Hospital & Medical Simulation Platform</div>
        </div>
        <div class="sim-banner" style="border-radius:8px;margin-bottom:14px;">SIMULATED ENVIRONMENT — SYNTHETIC PATIENTS ONLY</div>
        <div class="field"><label>Email</label><input id="login-email" value="student@medic1905.sim" autocomplete="username"></div>
        <div class="field"><label>Password</label><input id="login-pass" type="password" value="medic1905" autocomplete="current-password"></div>
        <div id="login-error" class="alert critical" style="display:none;"></div>
        <button class="btn" style="width:100%;" onclick="doLogin()">Sign in</button>
        <div class="row mt" style="gap:6px;">
          <button class="btn secondary sm" style="flex:1;" onclick="quickLogin('instructor')">Instructor</button>
          <button class="btn secondary sm" style="flex:1;" onclick="quickLogin('resident')">Resident</button>
          <button class="btn secondary sm" style="flex:1;" onclick="quickLogin('nurse')">Nurse</button>
          <button class="btn secondary sm" style="flex:1;" onclick="quickLogin('admin')">Admin</button>
        </div>
        <div class="mt muted" style="font-size:12px;">Demo accounts: student / intern / resident / specialist / surgeon / anaesthetist / nurse / pharmacist / lab / radiologist / instructor / admin @medic1905.sim — password <span class="kbd">medic1905</span></div>
        <div class="mt" style="font-size:12.5px;color:var(--ink-faint);">No account? <a href="javascript:void(0)" onclick="showRegister()">Register as a learner</a></div>
        <div id="register-form" style="display:none;" class="mt">
          <div class="field"><label>Full name</label><input id="reg-name"></div>
          <div class="field"><label>Email</label><input id="reg-email"></div>
          <div class="field"><label>Password</label><input id="reg-pass" type="password"></div>
          <div class="field"><label>Role</label><select id="reg-role">
            <option value="student">Medical Student</option><option value="intern">Intern Doctor</option>
            <option value="resident">Resident Doctor</option><option value="specialist">Specialist Trainee</option>
            <option value="nurse">Nurse</option><option value="pharmacist">Pharmacist</option>
            <option value="lab_scientist">Laboratory Scientist</option><option value="radiologist">Radiologist</option>
          </select></div>
          <button class="btn secondary" style="width:100%;" onclick="doRegister()">Create account</button>
        </div>
      </div>
    </div>
  </div>`;
};

async function doLogin() {
  try {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const data = await api.post('/auth/login', { email, password });
    api.saveAuth(data.token, data.user);
    App.render();
  } catch (e) {
    const el = document.getElementById('login-error');
    el.style.display = 'block'; el.textContent = e.message;
  }
}
async function quickLogin(role) {
  document.getElementById('login-email').value = role + '@medic1905.sim';
  document.getElementById('login-pass').value = 'medic1905';
  doLogin();
}
function showRegister() { document.getElementById('register-form').style.display = 'block'; }
async function doRegister() {
  try {
    const data = await api.post('/auth/register', {
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-pass').value,
      full_name: document.getElementById('reg-name').value.trim(),
      role: document.getElementById('reg-role').value
    });
    api.saveAuth(data.token, data.user);
    App.render();
  } catch (e) { alert(e.message); }
}

Pages.dashboard = async function () {
  const [runs, country] = await Promise.all([api.get('/runs'), api.get('/country')]);
  const completed = runs.runs.filter(r => r.status === 'completed');
  const active = runs.runs.filter(r => r.status === 'active');
  const scores = completed.map(r => r.score?.percentage).filter(Boolean);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.max(...scores) : null;
  const regionCount = country.regions.length;
  const cityCount = country.regions.reduce((s, r) => s + r.cities.length, 0);
  const hospCount = country.regions.reduce((s, r) => s + r.cities.reduce((a, c) => a + c.hospitals.length, 0), 0);

  const role = api.user.role;
  const guidance = {
    student: 'Work through undergraduate cases, take histories with AI patients, and build your clinical reasoning.',
    intern: 'Focus on emergency and internship-level cases. Manage deteriorating patients and prescribe safely.',
    resident: 'Tackle resident-level cases: critical care, paediatrics, obstetrics. Aim for timeliness targets.',
    specialist: 'Specialist-level cases demand precise differential diagnosis and complex management decisions.',
    nurse: 'Practice nursing observations, fluid balance, monitoring and escalation on any case.',
    pharmacist: 'Review prescriptions on active cases and watch the safety engine flag interactions and allergies.',
    instructor: 'Author cases, monitor live runs, inject complications and grade learners.',
    admin: 'Platform oversight: users, hospitals, the nation map and audit logs.'
  }[role] || '';

  const recent = runs.runs.slice(0, 6).map(r => `
    <tr>
      <td><b>${esc(r.title)}</b><br><span class="muted">${esc(r.difficulty)} · ${esc(r.specialty)}</span></td>
      <td><span class="badge ${r.status === 'completed' ? 'green' : r.status === 'active' ? 'blue' : 'gray'}">${esc(r.status)}</span></td>
      <td>${r.score ? `<b>${r.score.percentage}%</b><br><span class="muted" style="font-size:12px;">${esc(r.score.grade.split(' — ')[0])}</span>` : '<span class="muted">—</span>'}</td>
      <td>${r.status === 'active' ? `<a class="btn sm" href="#/encounter?id=${r.id}">Continue</a>` : r.score ? `<a class="btn secondary sm" href="#/encounter?id=${r.id}&view=debrief">Debrief</a>` : ''}</td>
    </tr>`).join('');

  return App.shell(`
    <div class="hero">
      <h1>Welcome, ${esc(api.user.full_name.split(' ')[0])}</h1>
      <p>${esc(guidance)}</p>
      <div class="row mt" style="max-width:560px;">
        <a class="btn" href="#/library" style="flex:1;">Browse Clinical Cases</a>
        <a class="btn secondary" href="#/country" style="flex:1;background:#fff;color:var(--navy);">Explore the Republic</a>
      </div>
    </div>

    <div class="grid cols-4 mb">
      <div class="card card-pad stat"><div class="n">${completed.length}</div><div class="l">Cases completed</div></div>
      <div class="card card-pad stat"><div class="n">${avg !== null ? avg + '%' : '—'}</div><div class="l">Average score</div></div>
      <div class="card card-pad stat"><div class="n">${best !== null ? best + '%' : '—'}</div><div class="l">Best score</div></div>
      <div class="card card-pad stat"><div class="n">${active.length}</div><div class="l">Active encounters</div></div>
    </div>

    <div class="grid cols-2">
      <div class="card card-pad">
        <h2>Your recent encounters</h2>
        <div class="sub">Every encounter is scored across nine clinical dimensions with a full debrief.</div>
        ${runs.runs.length ? `<table><tr><th>Case</th><th>Status</th><th>Score</th><th></th></tr>${recent}</table>` : '<div class="empty">No encounters yet — open the Case Library to meet your first patient.</div>'}
      </div>
      <div class="card card-pad">
        <h2>The Medic1905 Republic</h2>
        <div class="sub">A virtual nation built for healthcare training — from single-doctor frontier clinics to the flagship teaching hospitals of Aurelia City.</div>
        <div class="grid cols-3">
          <div class="stat"><div class="n">${regionCount}</div><div class="l">Regions</div></div>
          <div class="stat"><div class="n">${cityCount}</div><div class="l">Cities</div></div>
          <div class="stat"><div class="n">${hospCount}</div><div class="l">Hospitals</div></div>
        </div>
        <div class="mt">
          <a class="btn secondary" href="#/country">Open the nation map</a>
          <a class="btn secondary" href="#/anatomy" style="margin-left:6px;">3D-style anatomy explorer</a>
        </div>
        <div class="alert info mt"><b>Training progression:</b> student → intern → resident → specialist. Your dashboard tracks performance across history taking, examination, investigation choice, diagnosis, management, safety, communication, documentation and timeliness.</div>
      </div>
    </div>`);
};
