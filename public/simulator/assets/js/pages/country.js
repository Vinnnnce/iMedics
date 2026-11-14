// The Medic1905 Republic — nation explorer
Pages.country = async function () {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const hospitalId = params.get('hospital');
  const data = await api.get('/country');

  if (hospitalId) {
    const h = await api.get('/hospitals/' + hospitalId);
    const catLabels = { emergency: 'Emergency & Trauma', outpatient: 'Outpatient', inpatient: 'Inpatient Wards', 'critical-care': 'Critical Care', 'women-children': 'Women & Children', surgical: 'Surgical', medical: 'Medical Specialties', perioperative: 'Perioperative', diagnostics: 'Diagnostics', support: 'Support Services', administration: 'Administration' };
    const byCat = {};
    for (const d of h.departments) (byCat[d.category] = byCat[d.category] || []).push(d);
    const beds = h.hospital.beds;
    return App.shell(`
      <a href="#/country" class="muted">← Back to the Republic</a>
      <div class="hero" style="margin-top:12px;">
        <h1>${esc(h.hospital.name)}</h1>
        <p>${esc(h.hospital.tier.replace(/-/g, ' ').toUpperCase())} · ${esc(h.city.name)}, ${esc(h.city.region_name)} region · ${beds} beds</p>
        <p style="font-size:13px;">
          <span class="badge" style="background:rgba(255,255,255,.2);color:#fff;">${h.hospital.has_ed ? 'ED open 24/7' : 'No emergency department'}</span>
          <span class="badge" style="background:rgba(255,255,255,.2);color:#fff;">${h.hospital.has_icu ? 'ICU on site' : 'No ICU'}</span>
          <span class="badge" style="background:rgba(255,255,255,.2);color:#fff;">${h.hospital.has_theatre ? 'Operating theatres' : 'No theatres'}</span>
        </p>
      </div>
      <div class="card card-pad mb">
        <h2>Departments & services</h2>
        <div class="sub">Every department in the Medic1905 network has its own workflows, staff roles and simulated patient activities.</div>
        ${Object.entries(byCat).map(([cat, depts]) => `
          <h3 style="margin-top:14px;">${catLabels[cat] || cat}</h3>
          <div class="pill-row">${depts.map(d => `<span class="badge teal">${esc(d.name)}</span>`).join('')}</div>
        `).join('')}
      </div>
      <div class="alert info">This hospital is part of the Medic1905 simulated healthcare network. Patients, staff and activity here are synthetic and exist for training only.</div>`);
  }

  const tierInfo = {
    metropolitan: { label: 'Metropolitan', desc: 'Flagship teaching hospitals, specialist centres and research campuses' },
    urban: { label: 'Urban', desc: 'Large general hospitals with full specialty rotas' },
    suburban: { label: 'Suburban', desc: 'District hospitals and community health networks' },
    rural: { label: 'Rural', desc: 'Clinics and health centres supported by telemedicine and air ambulance' }
  };

  const regionHtml = data.regions.map(r => {
    const hospitals = r.cities.reduce((a, c) => a + c.hospitals.length, 0);
    const cities = r.cities.map(c => `
      <div style="margin:8px 0 4px;">
        <b style="font-size:13.5px;">${esc(c.name)}</b>
        <span class="badge ${c.tier === 'major-city' ? 'blue' : c.tier === 'city' ? 'teal' : c.tier === 'town' ? 'amber' : 'gray'}" style="margin-left:6px;">${esc(c.tier)}</span>
        <span class="muted" style="font-size:12px;"> · pop ${c.population.toLocaleString()}</span>
      </div>
      <div class="pill-row">${c.hospitals.map(h => `<a class="badge ${h.tier === 'teaching-hospital' ? 'red' : h.tier === 'specialist-centre' ? 'amber' : h.tier === 'general-hospital' ? 'teal' : 'blue'}" style="cursor:pointer;text-decoration:none;" href="#/country?hospital=${h.id}">${esc(h.name)}</a>`).join('')}</div>
    `).join('');
    return `
    <div class="card card-pad" style="border-top:3px solid ${r.tier === 'metropolitan' ? 'var(--red)' : r.tier === 'urban' ? 'var(--amber)' : r.tier === 'suburban' ? 'var(--blue)' : 'var(--green)'};">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;">
        <h2><span class="tier-dot tier-${r.tier}"></span>${esc(r.name)}</h2>
        <span class="muted" style="font-size:12.5px;">${r.cities.length} cities · ${hospitals} hospitals · pop ${r.population.toLocaleString()}</span>
      </div>
      <div class="sub">${esc(r.description)}</div>
      ${cities}
    </div>`;
  }).join('');

  return App.shell(`
    <div class="hero">
      <h1>The Medic1905 Republic</h1>
      <p>A virtual nation of 36 regions and 72 cities — from the frontier clinics of Old Frontier to the flagship teaching hospitals of Aurelia City. Emergency number: <b>1905</b>. Click any hospital to explore its departments.</p>
    </div>
    <div class="grid cols-4 mb">
      ${Object.entries(tierInfo).map(([k, v]) => `
        <div class="card card-pad stat">
          <div class="l" style="margin-bottom:2px;"><span class="tier-dot tier-${k}"></span>${v.label}</div>
          <div style="font-size:12.5px;color:var(--ink-soft);">${v.desc}</div>
          <div class="n" style="margin-top:6px;">${data.regions.filter(r => r.tier === k).length}</div>
          <div class="l">regions</div>
        </div>`).join('')}
    </div>
    <div class="grid cols-2">${regionHtml}</div>`);
};
