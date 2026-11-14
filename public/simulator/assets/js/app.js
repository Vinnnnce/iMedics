// Medic1905 SPA — hash router, auth gate, navigation
const App = {
  routes: {
    '': () => Pages.dashboard(),
    'dashboard': () => Pages.dashboard(),
    'country': () => Pages.country(),
    'library': () => Pages.library(),
    'encounter': () => Pages.encounter(),
    'anatomy': () => Pages.anatomy(),
    'equipment': () => Pages.equipment(),
    'instructor': () => Pages.instructor(),
    'admin': () => Pages.admin()
  },

  async render() {
    const app = document.getElementById('app');
    if (!api.token) { app.innerHTML = Pages.login(); return; }
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
    const route = this.routes[hash] || this.routes[''];
    try {
      app.innerHTML = await route();
    } catch (e) {
      app.innerHTML = `<div class="wrap"><div class="alert critical">Error: ${esc(e.message)}</div></div>`;
    }
    window.scrollTo(0, 0);
  },

  navLinks() {
    const role = api.user?.role;
    const links = [['dashboard', 'Dashboard'], ['library', 'Case Library'], ['country', 'The Republic'], ['anatomy', 'Anatomy'], ['equipment', 'Equipment']];
    if (role === 'instructor' || role === 'admin') links.push(['instructor', 'Instructor Console']);
    if (role === 'admin') links.push(['admin', 'Administration']);
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
    return links.map(([h, label]) => `<a href="#/${h}" class="${hash === h ? 'active' : ''}">${label}</a>`).join('');
  },

  shell(content, active = '') {
    const u = api.user || {};
    const roleLabels = { student: 'Medical Student', intern: 'Intern Doctor', resident: 'Resident Doctor', specialist: 'Specialist Doctor', surgeon: 'Surgeon', anaesthetist: 'Anaesthetist', nurse: 'Nurse', pharmacist: 'Pharmacist', lab_scientist: 'Laboratory Scientist', radiologist: 'Radiologist', instructor: 'Clinical Instructor', admin: 'Platform Administrator' };
    return `
    <div class="topbar"><div class="topbar-inner">
      <a href="#/dashboard" class="brand"><span class="cross">+</span><span>Medic1905<small>VIRTUAL TEACHING HOSPITAL</small></span></a>
      <nav class="nav">${this.navLinks()}</nav>
      <div class="user-chip"><b>${esc(u.full_name)}</b><br>${esc(roleLabels[u.role] || u.role)}</div>
      <button class="btn secondary sm" onclick="doLogout()">Sign out</button>
    </div></div>
    <div class="sim-banner">SIMULATED ENVIRONMENT — ALL PATIENTS ARE SYNTHETIC. FOR MEDICAL EDUCATION ONLY. NOT CLINICAL DECISION SUPPORT.</div>
    <div class="wrap">${content}</div>
    <footer class="foot">Medic1905 Virtual Hospital & Training Ecosystem — Republic of Medic1905 (36 regions) · Emergency number 1905<br>
    Educational simulation platform. Scores are learning feedback, not qualifications or licences. Never use for real patient care.</footer>`;
  }
};

function doLogout() { api.post('/auth/logout').catch(() => {}); api.logout(); location.hash = ''; App.render(); }

window.addEventListener('hashchange', () => App.render());
window.addEventListener('DOMContentLoaded', () => App.render());
