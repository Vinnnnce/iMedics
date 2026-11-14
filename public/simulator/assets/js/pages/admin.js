// Master platform administration
Pages.admin = async function () {
  const [stats, users] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
  const audit = await api.get('/admin/audit');
  const roleLabels = { student: 'Medical Student', intern: 'Intern Doctor', resident: 'Resident Doctor', specialist: 'Specialist Doctor', surgeon: 'Surgeon', anaesthetist: 'Anaesthetist', nurse: 'Nurse', pharmacist: 'Pharmacist', lab_scientist: 'Lab Scientist', radiologist: 'Radiologist', instructor: 'Instructor', admin: 'Administrator' };
  return App.shell(`
  <div class="hero"><h1>Platform Administration</h1>
  <p>Master control panel for the Medic1905 virtual hospital network: users, national infrastructure, simulation activity and the audit trail.</p></div>
  <div class="grid cols-4 mb">
    <div class="card card-pad stat"><div class="n">${stats.users}</div><div class="l">Registered users</div></div>
    <div class="card card-pad stat"><div class="n">${stats.regions}</div><div class="l">Regions</div></div>
    <div class="card card-pad stat"><div class="n">${stats.hospitals}</div><div class="l">Hospitals</div></div>
    <div class="card card-pad stat"><div class="n">${stats.publishedCases}</div><div class="l">Published cases</div></div>
    <div class="card card-pad stat"><div class="n">${stats.runs}</div><div class="l">Encounters started</div></div>
    <div class="card card-pad stat"><div class="n">${stats.completedRuns}</div><div class="l">Completed</div></div>
    <div class="card card-pad stat"><div class="n">${stats.prescriptions}</div><div class="l">Prescriptions</div></div>
    <div class="card card-pad stat"><div class="n">${stats.auditEntries}</div><div class="l">Audit entries</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card card-pad">
      <h2>Users</h2>
      <div class="sub">Change roles to manage permissions across the platform.</div>
      <table>
        <tr><th>Name</th><th>Email</th><th>Role</th><th>Runs</th></tr>
        ${users.users.map(u => `
          <tr>
            <td><b>${esc(u.full_name)}</b></td>
            <td style="font-size:12.5px;">${esc(u.email)}</td>
            <td>
              <select style="padding:4px 8px;font-size:12.5px;" onchange="changeRole(${u.id}, this.value)">
                ${Object.entries(roleLabels).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </td>
            <td>${u.completedRuns}</td>
          </tr>`).join('')}
      </table>
    </div>
    <div class="card card-pad">
      <h2>Audit log</h2>
      <div class="sub">Every sensitive action is traceable — logins, case publishing, instructor overrides, role changes.</div>
      <div style="max-height:480px;overflow-y:auto;">
        <table>
          ${audit.audit.slice(0, 60).map(a => `
            <tr><td class="mono" style="font-size:11.5px;">${esc(a.ts)}</td><td><b>${esc(a.full_name || 'system')}</b></td>
            <td>${esc(a.action)}</td><td class="muted" style="font-size:12px;">${esc(a.target || '')}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  </div>`);
};
async function changeRole(userId, role) {
  try {
    await api.put(`/admin/users/${userId}/role`, { role });
    alert('Role updated.');
  } catch (e) { alert(e.message); }
}
