// Medical equipment simulators — ECG, defibrillator trainer, infusion pump calculator
const RHYTHMS = {
  sinus: { label: 'Normal sinus rhythm', note: 'Rate 60-100, regular P before every QRS.' },
  tach: { label: 'Sinus tachycardia', note: 'Rate >100 — pain, sepsis, hypovolaemia, anxiety, PE.' },
  stemi: { label: 'STEMI pattern', note: 'ST elevation with reciprocal depression — call for reperfusion.' },
  af: { label: 'Atrial fibrillation', note: 'Irregularly irregular, no P waves — stroke risk, rate/rhythm control.' },
  vf: { label: 'Ventricular fibrillation', note: 'SHOCKABLE — CPR + defibrillation immediately.' },
  asystole: { label: 'Asystole', note: 'Non-shockable — high-quality CPR, adrenaline, find reversible causes.' }
};

function ecgBeat(x, type, i) {
  // returns path fragment for one beat starting at x
  const s = 14; // beat width scale
  switch (type) {
    case 'sinus': case 'tach':
      return `M${x} 0 L${x} -3 L${x + 3} 0 L${x + 3} 2 L${x + 4.5} 0 L${x + 6} -16 L${x + 7.5} 22 L${x + 9} 0 L${x + 11} 3 L${x + 12} 0 L${x + 14} 0`;
    case 'stemi':
      return `M${x} 0 L${x} -3 L${x + 3} 0 L${x + 3} 8 L${x + 4.5} 8 L${x + 6} -14 L${x + 7.5} 8 L${x + 9} 8 L${x + 11} 3 L${x + 12} 0 L${x + 14} 0`;
    case 'af':
      return `M${x} 0 q1 -1.5 2 0 q1 1.5 2 0 L${x + 5} -2 L${x + 5.5} -1 L${x + 6} -14 L${x + 7.5} 20 L${x + 9} 1 L${x + 9.5} 2 L${x + 10} 0 q1 1 2 -0.5 q1 -1.5 2 0 L${x + 14} 0`;
    default:
      return `M${x} 0 L${x + 14} 0`;
  }
}

function drawEcg(canvas, type, offset) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0d1f14';
  ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(60,160,110,.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // trace
  ctx.strokeStyle = '#4dff9e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const base = H / 2;
  const beatW = 90;
  let d = '';
  if (type === 'vf') {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = base + Math.sin((x + offset * 8) * 0.35) * 14 + Math.sin((x + offset * 5) * 0.11) * 18;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }
  if (type === 'asystole') {
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(W, base);
    ctx.stroke();
    return;
  }
  const scale = 2.6;
  const path = new Path2D();
  path.moveTo(0, base);
  for (let x = -((offset * 40) % beatW); x < W + beatW; x += beatW) {
    const frag = ecgBeat(0, type, 0);
    // build with transforms
    const pts = [];
    const m = frag.match(/[ML][^ML]+/g) || [];
    for (const seg of m) {
      const nums = seg.slice(1).trim().split(/\s+/).map(Number);
      if (nums.length >= 2 && !nums.some(isNaN)) pts.push([x + nums[0] * scale, base + nums[1] * scale]);
    }
    if (pts.length) { path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); }
  }
  ctx.stroke(path);
}

Pages.equipment = function () {
  window._ecgType = window._ecgType || 'sinus';
  window._pumpResult = null;
  setTimeout(() => { const c = document.getElementById('ecg-canvas'); if (c) ecgLoop(); }, 60);
  const rhythm = window._ecgType;
  return App.shell(`
  <div class="hero"><h1>Medical Equipment Simulators</h1>
  <p>Interactive device trainers that respond to your input and scenario states — the same devices used inside patient encounters. Framework ready for haptic device integration.</p></div>
  <div class="grid cols-2">
    <div class="card card-pad">
      <h2>ECG monitor</h2>
      <div class="sub">Select a rhythm to render a live trace. Learn to recognise shockable and non-shockable rhythms instantly.</div>
      <div class="pill-row mb">
        ${Object.entries(RHYTHMS).map(([k, r]) => `<button class="badge ${k === rhythm ? 'teal' : 'gray'}" style="cursor:pointer;" onclick="setRhythm('${k}')">${r.label}</button>`).join('')}
      </div>
      <canvas id="ecg-canvas" class="ecg-canvas" width="640" height="180"></canvas>
      <div class="alert info mt"><b>${RHYTHMS[rhythm].label}:</b> ${RHYTHMS[rhythm].note}</div>
    </div>
    <div class="card card-pad">
      <h2>Defibrillator trainer</h2>
      <div class="sub">Practise the shock decision. Charge, confirm rhythm, clear, shock — then resume CPR immediately.</div>
      <div class="field"><label>Select underlying rhythm</label>
        <select id="defib-rhythm">${Object.entries(RHYTHMS).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select>
      </div>
      <div class="row">
        <button class="btn secondary" onclick="defibCharge()">Charge 200J</button>
        <button class="btn danger" onclick="defibShock()">⚡ SHOCK</button>
      </div>
      <div id="defib-log" class="mt"></div>
    </div>
    <div class="card card-pad">
      <h2>Infusion pump calculator</h2>
      <div class="sub">Convert dosing prescriptions into pump rates. Double-check high-alert infusions with a colleague.</div>
      <div class="row">
        <div class="field"><label>Drug dose (mg)</label><input id="pump-dose" type="number" value="1000"></div>
        <div class="field"><label>Volume (mL)</label><input id="pump-vol" type="number" value="50"></div>
        <div class="field"><label>Rate (mL/h)</label><input id="pump-rate" type="number" value="10"></div>
      </div>
      <button class="btn" onclick="calcPump()">Calculate</button>
      <div id="pump-result" class="mt">${window._pumpResult || ''}</div>
    </div>
    <div class="card card-pad">
      <h2>Patient monitor quick reference</h2>
      <div class="sub">Normal adult ranges and escalation thresholds (NEWS2).</div>
      <table>
        <tr><th>Parameter</th><th>Normal range</th><th>Escalate when</th></tr>
        <tr><td>Heart rate</td><td>60-100 bpm</td><td>&lt;50 or &gt;130</td></tr>
        <tr><td>Blood pressure</td><td>90-140 systolic</td><td>&lt;90 (shock) or &gt;180 (hypertensive crisis)</td></tr>
        <tr><td>Respiratory rate</td><td>12-20 /min</td><td>&lt;10 or &gt;25</td></tr>
        <tr><td>SpO2</td><td>94-98% (88-92% COPD)</td><td>&lt;92%</td></tr>
        <tr><td>Temperature</td><td>36.1-38.0 °C</td><td>&lt;36 or &gt;38.5 with signs of sepsis</td></tr>
        <tr><td>GCS</td><td>15</td><td>Any drop — recheck pupils and glucose</td></tr>
      </table>
      <div class="alert warning mt"><b>NEWS2 ≥5</b> is an urgent escalation threshold — review the patient and call for senior help.</div>
    </div>
  </div>`);
};

function setRhythm(k) { window._ecgType = k; App.render(); }
let _ecgOffset = 0;
function ecgLoop() {
  const canvas = document.getElementById('ecg-canvas');
  if (!canvas) return;
  drawEcg(canvas, window._ecgType || 'sinus', _ecgOffset++);
  requestAnimationFrame(() => setTimeout(ecgLoop, 60));
}

function defibCharge() {
  document.getElementById('defib-log').innerHTML = '<div class="alert info">Charging… 200J ready. Confirm rhythm is shockable before clearing and shocking.</div>';
}
function defibShock() {
  const r = document.getElementById('defib-rhythm').value;
  const shockable = r === 'vf';
  document.getElementById('defib-log').innerHTML = shockable
    ? '<div class="alert success"><b>Shock delivered.</b> VF is a shockable rhythm — correct decision. Resume CPR immediately for 2 minutes, then reassess rhythm.</div>'
    : `<div class="alert critical"><b>Shock delivered on a non-shockable rhythm.</b> ${RHYTHMS[r].label} requires CPR and adrenaline, not electricity. In VF/VT: shock. In asystole/PEA: compressions and drugs.</div>`;
}

function calcPump() {
  const dose = +document.getElementById('pump-dose').value;
  const vol = +document.getElementById('pump-vol').value;
  const rate = +document.getElementById('pump-rate').value;
  if (!dose || !vol || !rate) return;
  const conc = dose / vol; // mg/mL
  const mgPerH = conc * rate;
  const result = `
    <table>
      <tr><th>Concentration</th><td class="mono">${conc} mg/mL</td></tr>
      <tr><th>Infusion rate</th><td class="mono">${rate} mL/h = ${mgPerH} mg/h = ${(mgPerH / 60).toFixed(2)} mg/min</td></tr>
      <tr><th>Bag duration</th><td class="mono">${(vol / rate).toFixed(1)} hours per ${vol} mL bag</td></tr>
    </table>
    <div class="alert warning mt">High-alert infusion — independent double-check before starting. Label the line. ${dose >= 100 ? 'This is a concentrated solution: consider central line access.' : ''}</div>`;
  document.getElementById('pump-result').innerHTML = result;
}
requestAnimationFrame(() => setTimeout(ecgLoop, 100));
