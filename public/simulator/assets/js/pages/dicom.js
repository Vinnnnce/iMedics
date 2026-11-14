// Medic1905 DICOM viewer & simulated PACS interface.
// Renders procedurally generated SYNTHETIC images from deterministic seeds —
// no real patient data. Images are simulations for education only.
let DV = { studies: [], current: null, pixels: null, window: 200, level: 128, zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 };

// Deterministic PRNG so the same seed always renders the same study
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Smooth value noise on a coarse grid — gives radiographs soft gradients
function valueNoise(rnd, N) {
  const g = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = rnd();
  return (x, y) => {
    const fx = Math.min(N - 1.001, Math.max(0, x * (N - 1)));
    const fy = Math.min(N - 1.001, Math.max(0, y * (N - 1)));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const i = y0 * N + x0;
    return g[i] * (1 - tx) * (1 - ty) + g[i + 1] * tx * (1 - ty) + g[i + N] * (1 - tx) * ty + g[i + N + 1] * tx * ty;
  };
}

// Generate the base 512x512 pixel field for a study according to modality
function generatePixels(study) {
  const S = 512, px = new Float32Array(S * S);
  const rnd = mulberry32(study.seed);
  const noise = valueNoise(rnd, 24);
  const mod = study.modality, body = study.bodyPart;
  // precompute per-study anatomy (NEVER draw random values inside the pixel loop)
  const pockets = [];
  for (let i = 0; i < 9; i++) pockets.push({ x: 60 + rnd() * 390, y: 120 + rnd() * 300, r: 12 + rnd() * 26 });
  const ctPockets = pockets.slice(0, 5).map(p => ({ x: 176 + (p.x - 60) * 0.45, y: 200 + (p.y - 120) * 0.5, r: 8 + p.r * 0.25 }));

  if (mod === 'CR') { // radiograph: dark film, bright bone
    const mix = (a, b, t) => a * (1 - t) + b * t;
    const ell = (px_, py_, ex, ey, rx, ry, edge) => Math.min(1, Math.max(0, (1 - Math.hypot((px_ - ex) / rx, (py_ - ey) / ry)) / edge));
    // chest-specific setup (loop-invariant — computed ONCE per study)
    const f = (study.finding || '').toLowerCase();
    const noPtx = /no pneumothorax|without pneumothorax|pneumothorax excluded/.test(f); // negation guard
    const ptxRight = !noPtx && ((/pneumothorax/.test(f) && /right/.test(f)) || /collapse of the right/.test(f));
    const ptxLeft = !noPtx && ((/pneumothorax/.test(f) && /left/.test(f) && !/right/.test(f)) || /collapse of the left/.test(f));
    const hyper = /hyperinfl/.test(f) || /flattened diaphragm/.test(f); // hyperinflated lungs (e.g. bronchiolitis, COPD)
    const consRight = /consolidat/.test(f) && /right/.test(f); // lobar pneumonia, right lower lobe
    const consLeft = /consolidat/.test(f) && /left/.test(f) && !/right/.test(f); // lobar pneumonia, left lower lobe
    const effusion = /effusion/.test(f) && !/no effusion|without effusion/.test(f); // basal pleural effusion
    const shift = ptxRight ? 1 : ptxLeft ? -1 : 0; // mediastinal shift direction (viewer x)
    const effPtx = ptxRight || ptxLeft; // air where a lung should be
    const noise2 = valueNoise(mulberry32((study.seed ^ 0x9E3779B9) >>> 0), 14); // pulmonary vasculature
    const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const segDist = (x_, y_, x0, y0, x1, y1) => {
      const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
      const t = L ? Math.min(1, Math.max(0, ((x_ - x0) * dx + (y_ - y0) * dy) / L)) : 0;
      return Math.hypot(x_ - (x0 + t * dx), y_ - (y0 + t * dy));
    };
    // diaphragm domes (flattened under a tension pneumothorax or in hyperinflation)
    const domeY = x_ => {
      const dl = 372 - (ptxRight ? 14 : hyper ? 16 : 46) * Math.exp(-((x_ - 176) ** 2) / 9000);
      const dr = 372 - (ptxLeft ? 14 : hyper ? 14 : 42) * Math.exp(-((x_ - 336) ** 2) / 9000);
      return Math.min(dl, dr);
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = x / S, ny = y / S;
      let v = 14 + noise(nx, ny) * 14;
      const cx = x - S / 2;
      // torso silhouette with soft edges
      const torsoX = Math.min(1, Math.max(0, (150 - Math.abs(cx)) / 14));
      const torsoY = Math.min(1, Math.max(0, Math.min(y - 60, S - 40 - y) / 14));
      const torso = torsoX * torsoY;
      if (torso > 0) {
        v = mix(v, 85 + noise(nx, ny) * 22, torso);
        if (body === 'CHEST') {
          // lung fields (taller and darker in hyperinflation)
          const lungL = ell(x, y, 176, 228, 94, hyper ? 150 : 130, 0.09);
          const lungR = ell(x, y, 336, 228, 94, hyper ? 150 : 130, 0.09);
          const lung = Math.max(lungL, lungR);
          const onAirSide = (ptxRight && lungL > 0.25) || (ptxLeft && lungR > 0.25);
          let lungVal;
          if (onAirSide) {
            lungVal = 22 + noise(nx, ny) * 5; // avascular air, fully collapsed hemithorax
          } else {
            const vessels = Math.pow(noise2(nx * 2.4, ny * 1.7), 2.6); // sparse bright branching
            const hila = ell(x, y, ptxLeft ? 210 : 302, 232, 70, hyper ? 110 : 90, 0.2); // more markings centrally (perihilar in bronchiolitis)
            lungVal = (hyper ? 36 : 44) + vessels * (30 + 34 * hila * (hyper ? 1.7 : 1)) + noise(nx, ny) * 10;
          }
          v = mix(v, lungVal, lung);
          if (effPtx) { // dense collapsed lung stump near the hilum — sharp visceral pleural edge
            const stump = ell(x, y, ptxRight ? 216 : 296, 240, 36, 52, 0.045);
            v = mix(v, 88 + noise(nx, ny) * 16, stump);
          }
          // posterior ribs — slanted arcs across BOTH hemithoraces (still visible over air)
          const cxr = x - 256;
          let ribT = 0;
          for (let i = 0; i < 7; i++) {
            const ry = 148 + i * 34 + 0.15 * cxr + 0.00032 * cxr * cxr;
            ribT = Math.max(ribT, ss(4.5, 1, Math.abs(y - ry)));
          }
          const ribZone = Math.max(lung * 0.85, onAirSide ? 0.6 : 0);
          v = mix(v, Math.max(v + 34, 96), ribT * ribZone);
          // lobar consolidation (e.g. community-acquired pneumonia) — dense lower-zone opacity with air bronchograms
          if (consRight || consLeft) {
            const cons = ell(x, y, consRight ? 176 : 336, hyper ? 316 : 306, 76, 66, 0.10);
            const fade = y > 252 ? 1 : Math.max(0, (y - 214) / 38); // lower lobe only
            const br = noise2(nx + (consRight ? 0.34 : 0.12), ny * 0.9); // stay inside noise domain
            const band = Math.abs(br - 0.5); // level-set curves of the noise read as branching airways
            const bronch = band < 0.045 ? (0.045 - band) / 0.045 : 0; // air bronchogram streaks through the opacity
            v = mix(v, 152 + noise(nx, ny) * 22 - bronch * 98, cons * fade);
          }
          // small pleural effusion — dense meniscus at the base, just above the diaphragm
          if (effusion && !effPtx) {
            const dY0 = domeY(x);
            if (y < dY0 && y > dY0 - 26) {
              const side = consRight ? Math.min(1, Math.max(0, (262 - x) / 26)) : consLeft ? Math.min(1, Math.max(0, (x - 250) / 26)) : 1;
              v = mix(v, 170 + noise(nx, ny) * 16, Math.min(1, (dY0 - y) / 22) * 0.8 * side);
            }
          }
          // diaphragm + abdomen below the domes
          const dY = domeY(x);
          if (y > dY) v = mix(v, 112 + noise(nx, ny) * 20, Math.min(1, (y - dY) / 9));
          // mediastinal column (shifted away from the pneumothorax)
          const medi = ell(x, y, 256 + shift * 34, 240, 62, 118, 0.10);
          v = mix(v, 128 + noise(nx, ny) * 20, medi);
          // trachea air column (also shifted)
          const trach = Math.min(1, Math.max(0, (11 - Math.abs(cxr - shift * 26)) / 7)) * Math.min(1, Math.max(0, Math.min(y - 128, 232 - y) / 8));
          v = mix(v, 58 + noise(nx, ny) * 8, trach);
          // cardiac silhouette within the mediastinum
          const heart = ell(x, y, 268 + shift * 30, 284, 58, 74, 0.09);
          v = mix(v, 138 + noise(nx, ny) * 24, heart);
          // thoracic spine seen through the mediastinum
          const spine = Math.min(1, Math.max(0, (12 - Math.abs(cxr)) / 9));
          v = mix(v, 152 + noise(nx, ny) * 22, spine * Math.max(medi, heart) * 0.8);
          // clavicles
          const clavL = ss(7, 3, segDist(x, y, 148, 126, 258, 150));
          const clavR = ss(7, 3, segDist(x, y, 364, 126, 254, 150));
          v = mix(v, 158 + noise(nx, ny) * 18, Math.max(clavL, clavR));
        } else { // abdomen
          v = mix(v, 92 + noise(nx, ny) * 26, torso);
          for (const p of pockets) { // bowel gas pockets, soft-edged
            const d = Math.hypot(x - p.x, y - p.y);
            if (d < p.r * 1.5) {
              const t = Math.min(1, Math.max(0, (p.r * 1.5 - d) / (p.r * 0.7)));
              v = v * (1 - t) + (38 + noise(nx, ny) * 10) * t;
            }
          }
          const liverD = Math.hypot(cx / 95, (y - 130) / 110); // soft liver ellipse
          if (liverD < 1) v = 150 + noise(nx, ny) * 22 + liverD * 12;
          // lumbar spine — bright vertebrae with disc gaps
          if (y > 340 && Math.abs(cx) < 34) {
            const disc = Math.abs(((y - 340) % 46) - 23) < 7;
            v = disc ? 120 + noise(nx, ny) * 20 : 175 + noise(nx, ny) * 25;
          }
          const pelvisBlend = Math.min(1, Math.max(0, (y - 410) / 45));
          if (pelvisBlend > 0) v = v * (1 - pelvisBlend) + (118 + noise(nx, ny) * 28) * pelvisBlend;
        }
      }
      px[y * S + x] = v;
    }
  } else if (mod === 'CT') { // axial slice: circular cross-section
    const R = body === 'HEAD' ? 150 : 190, cy = S / 2, cx = S / 2;
    const mix = (a, b, t) => a * (1 - t) + b * t;
    const ell = (px_, py_, ex, ey, rx, ry, edge) => Math.min(1, Math.max(0, (1 - Math.hypot((px_ - ex) / rx, (py_ - ey) / ry)) / edge));
    const bx = cx + Math.cos(study.seed % 6.28) * 60, by = cy + 20;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 4 + noise(x / S, y / S) * 6;
      const d = Math.hypot(x - cx, y - cy);
      if (d < R) {
        v = body === 'HEAD' ? 38 + noise(x / S, y / S) * 12 : 70 + noise(x / S, y / S) * 12; // brain / viscera
        if (body === 'HEAD') {
          if (d > R - 14) v = mix(v, 200 + noise(x / S, y / S) * 35, Math.min(1, (d - (R - 14)) / 6)); // skull
          // ventricles
          const vent = Math.max(ell(x, y, cx - 30, cy - 15, 16, 16, 0.2), ell(x, y, cx + 30, cy - 15, 16, 16, 0.2));
          v = mix(v, 18 + noise(x / S, y / S) * 8, vent);
        } else {
          if (d > R - 8) v = mix(v, 58 + noise(x / S, y / S) * 18, Math.min(1, (d - (R - 8)) / 5)); // body wall
          const liver = ell(x, y, cx - 45, cy - 40, 95, 75, 0.15);
          v = mix(v, 112 + noise(x / S, y / S) * 10, liver);
          const spleen = ell(x, y, cx + 75, cy - 55, 42, 38, 0.15);
          v = mix(v, 106 + noise(x / S, y / S) * 10, spleen);
          const spine = ell(x, y, cx, cy + 40, 48, 42, 0.12);
          v = mix(v, 170 + noise(x / S, y / S) * 20, spine);
          const canal = ell(x, y, cx, cy + 40, 14, 16, 0.25); // spinal canal
          v = mix(v, 28 + noise(x / S, y / S) * 8, canal);
          const aorta = ell(x, y, cx - 6, cy + 2, 12, 12, 0.25); // aorta
          v = mix(v, 125 + noise(x / S, y / S) * 12, aorta);
          const kidneyL = ell(x, y, cx - 85, cy + 30, 26, 34, 0.15); // kidneys
          const kidneyR = ell(x, y, cx + 85, cy + 30, 26, 34, 0.15);
          const kidney = Math.max(kidneyL, kidneyR);
          v = mix(v, 96 + noise(x / S, y / S) * 10, kidney);
          for (const p of ctPockets) { // bowel gas, small and soft-edged
            const d = Math.hypot(x - p.x, y - p.y);
            if (d < p.r * 1.4) {
              const t = Math.min(1, Math.max(0, (p.r * 1.4 - d) / (p.r * 0.6)));
              v = mix(v, 30 + noise(x / S, y / S) * 8, t);
            }
          }
          const bladder = ell(x, y, bx, by, 26, 26, 0.15);
          v = mix(v, 34 + noise(x / S, y / S) * 10, bladder);
        }
      }
      px[y * S + x] = v;
    }
  } else if (mod === 'US') { // ultrasound sector with speckle
    const apexX = S / 2, apexY = 40;
    const lesions = [];
    for (let i = 0; i < 4; i++) lesions.push({ x: 140 + rnd() * 230, y: 150 + rnd() * 260, r: 18 + rnd() * 30 });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 4;
      const ang = Math.atan2(y - apexY, x - apexX);
      const dist = Math.hypot(x - apexX, y - apexY);
      if (y > apexY && Math.abs(ang - Math.PI / 2) < 0.6 && dist < 460) {
        v = 35 + rnd() * 45; // tissue speckle
        if (body === 'HEART') {
          const chamber = Math.hypot(x - apexX, y - (apexY + 200)) < (70 + 25 * Math.sin(x / 30));
          if (chamber) v = 8 + rnd() * 8; // blood pool
        } else {
          // liver band — brighter homogeneous tissue
          const liverBand = Math.min(1, Math.max(0, 1 - Math.abs(y - 215) / 65));
          v = v * (1 - liverBand * 0.6) + (62 + rnd() * 28) * liverBand * 0.6;
          for (const L of lesions) { // anechoic fluid collections with soft edges + shadow
            const d = Math.hypot(x - L.x, y - L.y);
            if (d < L.r * 1.7) {
              const t = Math.min(1, Math.max(0, (L.r * 1.7 - d) / (L.r * 0.9)));
              const tt = t * t * (3 - 2 * t); // smoothstep
              v = v * (1 - tt) + (16 + rnd() * 10) * tt;
            } else if (y > L.y && Math.abs(x - L.x) < L.r * 0.9) {
              v = Math.min(v, 20 + rnd() * 10); // acoustic shadow below lesion
            }
          }
        }
        if (dist > 430) v = 12 + rnd() * 8; // far-field fade
      }
      px[y * S + x] = v;
    }
  } else if (mod === 'ECG') { // rhythm strip rendered as a continuous trace
    px.fill(8);
    const wave = (t) => {
      let v = Math.sin(t * 2 * Math.PI * 0.25) * 6; // baseline wander
      const beat = (t * 1.2) % 1; // 72 bpm
      const bump = (c, w, h) => beat > c - w && beat < c + w ? h * Math.cos(Math.PI * (beat - c) / (2 * w)) : 0;
      v += bump(0.06, 0.04, 14);  // P wave (upright)
      v += bump(0.14, 0.02, 85);  // R wave (upright)
      v += bump(0.185, 0.03, -32); // S wave (down)
      v += bump(0.42, 0.08, 22);  // T wave (upright)
      return v;
    };
    let prevY = Math.round(256 - wave(0));
    for (let x = 1; x < S; x++) {
      const t = (x / S) * 5; // 5-second strip
      const y0 = Math.round(256 - wave(t));
      const lo = Math.min(prevY, y0), hi = Math.max(prevY, y0);
      for (let yy = lo; yy <= hi; yy++) {
        if (yy >= 0 && yy < S) for (let dx = 0; dx <= 2; dx++) if (x - dx >= 0) px[yy * S + (x - dx)] = 235;
      }
      prevY = y0;
    }
  } else if (mod === 'NM') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 3 + rnd() * 5;
      for (let i = 0; i < 6; i++) {
        const gx = 100 + ((study.seed >> i) % 300), gy = 100 + ((study.seed << i) % 300), gr = 30 + rnd() * 40;
        const d = Math.hypot(x - gx, y - gy);
        if (d < gr) v = Math.max(v, 120 * (1 - d / gr) + rnd() * 40);
      }
      px[y * S + x] = v;
    }
  } else { // MR / generic
    const R = 170, cx = S / 2, cy = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let v = 4 + noise(x / S, y / S) * 5;
      if (d < R) {
        v = 60 + noise(x / S, y / S) * 30 * Math.sin((x + y) / 23); // MR texture
        if (d > R - 6) v = 190 + noise(x / S, y / S) * 35;
      }
      px[y * S + x] = Math.max(4, Math.min(255, v));
    }
  }
  return px;
}

// Render current study to canvas with window/level, zoom, pan
function dvRender() {
  const canvas = document.getElementById('dv-canvas');
  if (!canvas || !DV.pixels) return;
  const S = 512;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const w = Math.max(1, DV.window), l = DV.level;
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, (DV.pixels[i] - (l - w / 2)) * (255 / w)));
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  // offscreen base
  const off = document.createElement('canvas'); off.width = S; off.height = S;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.save();
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2 + DV.panX, S / 2 + DV.panY);
  ctx.scale(DV.zoom, DV.zoom);
  ctx.drawImage(off, -S / 2, -S / 2);
  // corner annotations, like a real DICOM viewer
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '12px monospace'; ctx.fillStyle = '#7ef9c5';
  const s = DV.current;
  ctx.fillText(`${s.modality} ${s.bodyPart}`, 10, 20);
  ctx.fillText(`W:${Math.round(DV.window)} L:${Math.round(DV.level)}`, 10, S - 12);
  ctx.fillText(`ACC ${s.accessionNumber || '—'}`, S - 170, 20);
  ctx.fillText(`Zoom ${DV.zoom.toFixed(1)}x`, S - 110, S - 12);
  ctx.strokeStyle = 'rgba(126,249,197,0.35)'; ctx.strokeRect(S / 2 - 40, S / 2 - 40, 80, 80); // centre reference
  ctx.restore();
}

async function openDicomViewer(orderId) {
  try {
    const r = await api.get(`/runs/${ENC.runId}/studies`);
    DV.studies = r.studies;
    DV.current = DV.studies.find(s => s.orderId === orderId) || DV.studies[0];
    if (!DV.current) return alert('No resulted imaging studies yet.');
    dvLayout();
    document.getElementById('dicom-modal').style.display = 'flex';
    dvLoadStudy(DV.current);
  } catch (e) { alert(e.message); }
}

function dvLoadStudy(study) {
  DV.current = study;
  DV.pixels = generatePixels(study);
  DV.zoom = 1; DV.panX = 0; DV.panY = 0;
  // sensible default windows per modality
  if (study.modality === 'CT') { DV.window = 200; DV.level = 100; }
  else if (study.modality === 'CR') { DV.window = 220; DV.level = 110; }
  else { DV.window = 200; DV.level = 100; }
  document.getElementById('dv-window').value = DV.window;
  document.getElementById('dv-level').value = DV.level;
  document.getElementById('dv-zoom').value = 1;
  dvRender();
  dvMetadata(study);
  dvSeriesList();
}

function dvLayout() {
  let modal = document.getElementById('dicom-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dicom-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(3,8,12,.94);z-index:999;align-items:center;justify-content:center;padding:18px;';
    modal.innerHTML = `
      <div style="background:var(--card,#0f1a22);border:1px solid var(--line,#22333f);border-radius:12px;width:min(1240px,96vw);height:min(780px,94vh);display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line,#22333f);">
          <div>
            <b style="font-size:15px;">🫻 Medic1905 PACS — DICOM Viewer</b>
            <span class="badge amber" style="margin-left:10px;">SIMULATED IMAGING — EDUCATIONAL USE ONLY</span>
          </div>
          <button class="btn secondary" onclick="document.getElementById('dicom-modal').style.display='none'">Close</button>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:230px 1fr 260px;min-height:0;">
          <div style="border-right:1px solid var(--line,#22333f);padding:12px;overflow-y:auto;" id="dv-series"></div>
          <div style="padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04070a;position:relative;">
            <canvas id="dv-canvas" width="512" height="512" style="max-width:100%;max-height:100%;cursor:grab;border:1px solid #1a2833;touch-action:none;"></canvas>
            <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);font-size:11px;color:#ff8a5b;letter-spacing:1px;">⚠ SIMULATED STUDY — NOT REAL PATIENT DATA</div>
          </div>
          <div style="border-left:1px solid var(--line,#22333f);padding:14px;overflow-y:auto;font-size:12.5px;" id="dv-meta"></div>
        </div>
        <div style="padding:10px 16px;border-top:1px solid var(--line,#22333f);display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:12px;">Window <input id="dv-window" type="range" min="30" max="400" value="200" style="vertical-align:middle;" oninput="DV.window=+this.value;dvRender()"></label>
          <label style="font-size:12px;">Level <input id="dv-level" type="range" min="-100" max="300" value="100" style="vertical-align:middle;" oninput="DV.level=+this.value;dvRender()"></label>
          <label style="font-size:12px;">Zoom <input id="dv-zoom" type="range" min="0.5" max="4" step="0.1" value="1" style="vertical-align:middle;" oninput="DV.zoom=+this.value;dvRender()"></label>
          <button class="btn secondary" style="font-size:12px;" onclick="DV.zoom=1;DV.panX=0;DV.panY=0;document.getElementById('dv-zoom').value=1;dvRender()">Reset view</button>
          <button class="btn secondary" style="font-size:12px;" onclick="dvInvert()">Invert</button>
          <span class="muted" style="font-size:11px;">Drag image to pan · scroll wheel to zoom</span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const c = document.getElementById('dv-canvas');
    c.addEventListener('mousedown', e => { DV.dragging = true; DV.lastX = e.clientX; DV.lastY = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (!DV.dragging) return;
      DV.panX += e.clientX - DV.lastX; DV.panY += e.clientY - DV.lastY;
      DV.lastX = e.clientX; DV.lastY = e.clientY; dvRender();
    });
    window.addEventListener('mouseup', () => { DV.dragging = false; });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      DV.zoom = Math.max(0.5, Math.min(4, DV.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
      document.getElementById('dv-zoom').value = DV.zoom.toFixed(1);
      dvRender();
    }, { passive: false });
  }
}

function dvInvert() {
  if (!DV.pixels) return;
  for (let i = 0; i < DV.pixels.length; i++) DV.pixels[i] = 255 - DV.pixels[i];
  dvRender();
}

function dvSeriesList() {
  const el = document.getElementById('dv-series');
  if (!el) return;
  el.innerHTML = `
    <div style="font-size:11px;color:#5b8a97;letter-spacing:1px;margin-bottom:8px;">STUDY LIST — MEDIC1905-PACS-SIM</div>
    ${DV.studies.map(s => `
      <div onclick="dvLoadStudy(DV.studies.find(x=>x.orderId===${s.orderId}))" style="padding:8px;border-radius:8px;margin-bottom:6px;cursor:pointer;border:1px solid ${DV.current && DV.current.orderId === s.orderId ? 'var(--teal,#3fb9c9)' : 'var(--line,#22333f)'};
        background:${DV.current && DV.current.orderId === s.orderId ? 'rgba(63,185,201,.08)' : 'transparent'};">
        <b style="font-size:12.5px;">${esc(s.modality)} — ${esc(s.bodyPart)}</b>
        <div class="muted" style="font-size:11px;">${esc(s.studyDescription || '')}</div>
        <div class="muted mono" style="font-size:10px;">${esc(s.accessionNumber || '')}</div>
        ${s.critical ? '<span class="badge red" style="font-size:10px;">critical finding</span>' : ''}
      </div>`).join('')}
    <div class="muted" style="font-size:10.5px;margin-top:10px;">All studies on this node are synthetic, generated deterministically from simulation seeds. No real patient data exists in Medic1905.</div>`;
}

function dvMetadata(study) {
  const el = document.getElementById('dv-meta');
  if (!el) return;
  const rows = [
    ['PACS Node', 'MEDIC1905-PACS-SIM'],
    ['Patient ID', study.patientID || ('M1905-SIM-' + String(ENC.runId).padStart(5, '0'))],
    ['Accession #', study.accessionNumber],
    ['Study Instance UID', study.studyInstanceUID],
    ['Series Instance UID', study.seriesInstanceUID],
    ['Modality', study.modality],
    ['Body Part', study.bodyPart],
    ['Study Description', study.studyDescription],
    ['Series Description', study.seriesDescription],
    ['Instances', '1'],
    ['Transfer Syntax', '1.2.840.10008.1.2.1 (Explicit VR LE)'],
    ['Source', 'Synthetic — simulation seed ' + study.seed]
  ];
  el.innerHTML = `
    <div style="font-size:11px;color:#5b8a97;letter-spacing:1px;margin-bottom:8px;">DICOM METADATA</div>
    ${rows.map(([k, v]) => `<div style="padding:5px 0;border-bottom:1px solid var(--line,#22333f);"><div class="muted" style="font-size:10.5px;text-transform:uppercase;">${esc(k)}</div><div class="mono" style="font-size:11.5px;word-break:break-all;">${esc(String(v || '—'))}</div></div>`).join('')}
    <div style="margin-top:12px;padding:10px;border-radius:8px;background:rgba(255,138,91,.08);border:1px solid rgba(255,138,91,.3);font-size:11.5px;">
      <b>Radiologist report:</b><br>${esc(study.finding || '—')}
    </div>`;
}
