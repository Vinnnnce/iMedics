// Interactive virtual anatomy explorer — layered SVG body systems
const ANATOMY = {
  skeletal: { label: 'Skeletal', color: '#e8e2d4', parts: [
    ['skull', 'Cranium', 'Protects the brain; facial bones form the airway and orbits. Skull fractures risk extradural haematoma (temporal bone → middle meningeal artery).'],
    ['spine', 'Vertebral column', '33 vertebrae protecting the spinal cord. C-spine clearance is mandatory in trauma; T12-L1 is the most common fracture site.'],
    ['ribs', 'Ribs & sternum', '12 pairs. Rib fractures = pain, splinting, atelectasis; flail segment causes paradoxical movement. First rib fracture suggests major trauma energy.'],
    ['pelvis', 'Pelvis', 'Ring structure bearing the body\'s load. Unstable pelvic fractures cause massive retroperitoneal haemorrhage — bind early, transfer late.'],
    ['limbs', 'Limb bones', 'Femur fractures can bleed 1-1.5L into the thigh. Open fractures need antibiotics and tetanus prophylaxis.']
  ]},
  muscular: { label: 'Muscular', color: '#d9705e', parts: [
    ['muscle-front', 'Anterior muscle groups', 'Pectoralis major, rectus abdominis, quadriceps. Rhabdomyolysis releases CK and potassium — think crush injuries and compartment syndrome.'],
    ['muscle-back', 'Posterior muscle groups', 'Trapezius, latissimus dorsi, gastrocnemius. Compartment syndrome: pain out of proportion, worse on passive stretch — orthopaedic emergency.']
  ]},
  cardiovascular: { label: 'Cardiovascular', color: '#c0392b', parts: [
    ['heart', 'Heart', 'Four chambers, coronary supply: LAD, LCx, RCA. Inferior infarction (RCA) can cause bradycardia and RV involvement — beware nitrates.'],
    ['aorta', 'Aorta & great vessels', 'Aortic dissection: tearing chest-to-back pain, unequal BP arms. Type A involves the arch — surgical emergency.'],
    ['vessels', 'Peripheral vasculature', 'Arterial disease causes claudication → rest pain → gangrene. Atherosclerosis risk factors drive the ABC of prevention.']
  ]},
  nervous: { label: 'Nervous', color: '#f0c952', parts: [
    ['brain', 'Brain', 'Cerebrum, cerebellum, brainstem. Stroke: FAST — time is brain; thrombolysis window under 4.5h. Raised ICP: headache, vomiting, papilloedema.'],
    ['spinal-cord', 'Spinal cord', 'Corticospinal tracts, sensory pathways. Cord compression: bilateral signs, saddle anaesthesia, urinary retention — urgent MRI + steroids.'],
    ['nerves', 'Peripheral nerves', 'Radial (wrist drop), median (carpal tunnel), ulnar (claw hand), common peroneal (foot drop). Map deficits to lesions.']
  ]},
  respiratory: { label: 'Respiratory', color: '#6fb7e0', parts: [
    ['lungs', 'Lungs', 'Right: 3 lobes; left: 2. Pneumonia, effusion, collapse — dullness to percussion; pneumothorax — hyper-resonance with absent breath sounds.'],
    ['airway', 'Airway & trachea', 'Trachea, bronchi, bronchioles. Asthma attacks: widespread polyphonic wheeze; the silent chest pre-arrest.']
  ]},
  digestive: { label: 'Digestive', color: '#d98a4a', parts: [
    ['stomach', 'Stomach & oesophagus', 'Peptic ulcer disease — H. pylori, NSAIDs. Upper GI bleed: haematemesis/melaena, raised urea.'],
    ['intestines', 'Intestines', 'Small bowel absorption; colon water reabsorption. Appendicitis: migratory pain, RIF signs. Obstruction: pain, vomiting, distension, absolute constipation.'],
    ['liver', 'Liver', 'Metabolic powerhouse. Cirrhosis: stigmata, varices, encephalopathy, coagulopathy. Paracetamol overdose → acute liver failure.']
  ]},
  urinary: { label: 'Urinary', color: '#8e6fbf', parts: [
    ['kidneys', 'Kidneys', 'Retroperitoneal, T12-L3. AKI: pre-renal, renal, post-renal. Nephrolithiasis: loin-to-groin colicky pain, haematuria.'],
    ['bladder', 'Bladder & ureters', 'Urinary retention: palpable bladder, suprapubic pain. UTI → pyelonephritis → urosepsis in the elderly with confusion.']
  ]},
  reproductive: { label: 'Reproductive', color: '#e07ab5', parts: [
    ['repro', 'Reproductive organs', 'Ectopic pregnancy: positive hCG, pain, bleeding — rupture causes catastrophic haemorrhage. Pre-eclampsia is a multi-system disease of pregnancy.']
  ]},
  endocrine: { label: 'Endocrine', color: '#7ab848', parts: [
    ['endocrine', 'Endocrine glands', 'Thyroid, adrenals, pancreatic islets. DKA, thyroid storm, Addisonian crisis — endocrine emergencies present subtly and deteriorate fast.']
  ]},
  lymphatic: { label: 'Lymphatic', color: '#9db8d0', parts: [
    ['lymph', 'Lymphatic system', 'Spleen, thymus, nodes, vessels. Splenic rupture in left lower rib trauma. Lymphadenopathy: infection vs malignancy — the persistent node needs investigation.']
  ]},
  integumentary: { label: 'Integumentary', color: '#f2c9a0', parts: [
    ['skin', 'Skin', 'Largest organ. Cellulitis, necrotising fasciitis (pain beyond erythema), Stevens-Johnson syndrome. Burns: percentage TBSA guides fluid resuscitation.']
  ]}
};

Pages.anatomy = function () {
  const current = window._anatomySys || 'skeletal';
  window._anatomySys = current;
  return App.shell(`
  <div class="hero"><h1>Virtual Human Anatomy</h1>
  <p>Explore eleven body systems with clinical correlations. Select a system, then click any structure for its clinical significance. Prepared for future WebGL/WebXR 3D integration.</p></div>
  <div class="grid" style="grid-template-columns:280px 1fr;gap:14px;align-items:start;">
    <div class="card card-pad">
      <h3>Body systems</h3>
      ${Object.entries(ANATOMY).map(([k, s]) => `
        <button class="sys-btn ${k === current ? 'active' : ''}" style="width:100%;margin:4px 0;" onclick="setAnatomy('${k}')">
          <span class="sys-swatch" style="background:${s.color};"></span>${s.label}
        </button>`).join('')}
    </div>
    <div>
      <div class="card card-pad anatomy-stage mb">
        <svg viewBox="0 0 300 560" width="300" style="margin:0 auto;display:block;">
          <ellipse cx="150" cy="38" rx="34" ry="40" fill="#f4d7c8" stroke="#c9a08c" stroke-width="2"/>
          <path d="M150 78 C 90 84, 74 150, 78 220 C 80 300, 88 380, 92 470 L 108 545 L 130 548 C 126 460, 124 380, 128 300 L 172 300 C 176 380, 174 460, 170 548 L 192 545 L 208 470 C 212 380, 220 300, 222 220 C 226 150, 210 84, 150 78 Z" fill="#f4d7c8" stroke="#c9a08c" stroke-width="2"/>
          ${anatomySvg(current)}
        </svg>
      </div>
      <div class="card card-pad" id="anatomy-info">
        <h3>${ANATOMY[current].label} system</h3>
        <div class="sub">Click a structure on the diagram.</div>
        <div id="anatomy-detail" class="empty">Select a structure to see its clinical correlation.</div>
      </div>
    </div>
  </div>
  <style>@media(max-width:800px){.grid[style*="280px"]{grid-template-columns:1fr !important;}}</style>`);
};

function anatomySvg(system) {
  const s = ANATOMY[system];
  const g = (id, shape, extra = '') => `<g id="${id}" onclick="anatomyPart('${system}','${id}')" style="cursor:pointer;">${shape}</g>`;
  switch (system) {
    case 'skeletal': return `
      ${g('skull', `<path d="M116 30 a34 40 0 1 1 68 0 a34 40 0 1 1 -68 0 M118 58 h64 M128 40 a6 6 0 1 0 8 0 M164 40 a6 6 0 1 0 8 0" fill="#e8e2d4" stroke="#a89f8c" stroke-width="2"/>`)}
      ${g('spine', `<path d="M150 82 L150 320" stroke="#a89f8c" stroke-width="7" stroke-dasharray="10 5"/>`)}
      ${g('ribs', `<path d="M150 100 C 100 106, 82 130, 84 160 M150 118 C 96 124, 76 150, 80 186 M150 136 C 94 142, 72 168, 78 208 M150 154 C 96 160, 76 186, 82 226 M150 172 C 100 178, 84 202, 90 238 M150 100 C 200 106, 218 130, 216 160 M150 118 C 204 124, 224 150, 220 186 M150 136 C 206 142, 228 168, 222 208 M150 154 C 204 160, 224 186, 218 226 M150 172 C 200 178, 216 202, 210 238" stroke="#e8e2d4" stroke-width="5" fill="none"/>`)}
      ${g('pelvis', `<path d="M104 320 C 90 340, 92 368, 106 380 L 150 400 L 194 380 C 208 368, 210 340, 196 320 Z" fill="#e8e2d4" stroke="#a89f8c" stroke-width="2"/>`)}
      ${g('limbs', `<path d="M84 220 L78 470 M216 220 L222 470 M108 470 L130 545 M192 470 L170 545 M128 300 L128 470 M172 300 L172 470" stroke="#e8e2d4" stroke-width="9"/>`)}`;
    case 'muscular': return `
      ${g('muscle-front', `<path d="M100 120 C 88 160, 92 200, 98 240 L 128 300 C 120 240, 118 180, 122 130 Z M200 120 C 212 160, 208 200, 202 240 L 172 300 C 180 240, 182 180, 178 130 Z M120 330 C 116 390, 118 440, 124 500 L 152 520 L 152 340 Z M180 330 C 184 390, 182 440, 176 500 L 152 520 L 152 340 Z" fill="#d9705e" opacity="0.75"/>`)}
      ${g('muscle-back', `<path d="M108 96 C 96 130, 100 170, 110 200 L 146 216 L 154 216 L 190 200 C 200 170, 204 130, 192 96 Z" fill="#c05a48" opacity="0.7"/>`)}`;
    case 'cardiovascular': return `
      ${g('heart', `<path d="M150 150 C 128 138, 106 148, 108 172 C 110 198, 132 214, 150 226 C 168 214, 190 198, 192 172 C 194 148, 172 138, 150 150 Z" fill="#c0392b" stroke="#8e2418" stroke-width="2"/>`)}
      ${g('aorta', `<path d="M150 150 C 150 120, 146 100, 138 90 M150 226 C 150 260, 148 300, 148 340 L 148 430" stroke="#c0392b" stroke-width="6" fill="none"/>`)}
      ${g('vessels', `<path d="M138 90 C 120 82, 100 86, 90 100 M138 90 C 156 76, 180 80, 190 96 M148 430 C 120 440, 100 460, 96 480 M148 430 C 176 440, 196 460, 200 480" stroke="#e07a6a" stroke-width="4" fill="none"/>`)}`;
    case 'nervous': return `
      ${g('brain', `<path d="M118 30 a34 40 0 1 1 68 0 a34 40 0 1 1 -68 0" fill="#f0c952" stroke="#c9a227" stroke-width="2"/><path d="M132 22 C 142 34, 138 46, 130 52 M158 16 C 150 30, 156 42, 166 50" stroke="#c9a227" stroke-width="2" fill="none"/>`)}
      ${g('spinal-cord', `<path d="M150 82 L150 320" stroke="#f0c952" stroke-width="5"/>`)}
      ${g('nerves', `<path d="M150 160 C 120 170, 100 190, 94 220 M150 200 C 180 210, 202 230, 206 260 M150 260 C 124 276, 112 300, 110 330 M150 300 C 178 314, 190 338, 190 366" stroke="#f0c952" stroke-width="2.5" fill="none" stroke-dasharray="4 3"/>`)}`;
    case 'respiratory': return `
      ${g('airway', `<path d="M150 80 L150 140" stroke="#6fb7e0" stroke-width="7"/>`)}
      ${g('lungs', `<path d="M148 140 C 130 160, 106 180, 100 230 C 94 280, 100 330, 112 350 C 128 362, 142 340, 146 300 L146 160 Z" fill="#6fb7e0" opacity="0.8"/><path d="M152 140 C 170 160, 194 180, 200 230 C 206 280, 200 330, 188 350 C 172 362, 158 340, 154 300 L154 160 Z" fill="#6fb7e0" opacity="0.8"/>`)}`;
    case 'digestive': return `
      ${g('stomach', `<path d="M150 190 C 128 196, 120 216, 130 232 C 140 248, 160 244, 166 228 C 172 212, 166 192, 150 190 Z" fill="#d98a4a" stroke="#b06a2e" stroke-width="2"/>`)}
      ${g('intestines', `<path d="M150 250 C 120 260, 110 290, 130 300 C 150 310, 170 300, 168 322 C 166 344, 140 342, 136 362 C 132 382, 156 388, 160 406 C 164 424, 146 432, 142 448 C 138 464, 154 470, 156 486" stroke="#d98a4a" stroke-width="9" fill="none"/>`)}
      ${g('liver', `<path d="M100 210 C 118 200, 140 204, 146 216 C 150 228, 138 240, 120 240 C 106 240, 96 226, 100 210 Z" fill="#8e5a2e" opacity="0.85"/>`)}`;
    case 'urinary': return `
      ${g('kidneys', `<path d="M124 250 C 112 258, 112 280, 124 288 C 134 294, 140 282, 136 268 C 134 258, 130 246, 124 250 Z" fill="#8e6fbf"/><path d="M176 250 C 188 258, 188 280, 176 288 C 166 294, 160 282, 164 268 C 166 258, 170 246, 176 250 Z" fill="#8e6fbf"/>`)}
      ${g('bladder', `<path d="M150 330 C 138 330, 130 342, 134 354 C 138 364, 162 364, 166 354 C 170 342, 162 330, 150 330 Z" fill="#8e6fbf" opacity="0.85"/>`)}`;
    case 'reproductive': return `
      ${g('repro', `<ellipse cx="150" cy="330" rx="26" ry="18" fill="#e07ab5" opacity="0.85"/><ellipse cx="122" cy="326" rx="8" ry="12" fill="#e07ab5"/><ellipse cx="178" cy="326" rx="8" ry="12" fill="#e07ab5"/><path d="M150 348 L150 376" stroke="#e07ab5" stroke-width="5"/>`)}`;
    case 'endocrine': return `
      ${g('endocrine', `<path d="M140 96 C 136 84, 146 78, 150 88 C 154 78, 164 84, 160 96 Z" fill="#7ab848"/><circle cx="150" cy="210" r="9" fill="#7ab848"/><ellipse cx="126" cy="280" rx="10" ry="6" fill="#7ab848" transform="rotate(-20 126 280)"/><ellipse cx="174" cy="280" rx="10" ry="6" fill="#7ab848" transform="rotate(20 174 280)"/><circle cx="150" cy="316" r="6" fill="#7ab848"/>`)}`;
    case 'lymphatic': return `
      ${g('lymph', `<circle cx="122" cy="130" r="5" fill="#9db8d0"/><circle cx="178" cy="130" r="5" fill="#9db8d0"/><circle cx="110" cy="160" r="5" fill="#9db8d0"/><circle cx="190" cy="160" r="5" fill="#9db8d0"/><circle cx="120" cy="252" r="12" fill="#9db8d0"/><circle cx="180" cy="252" r="12" fill="#9db8d0"/><path d="M122 130 C 130 160, 130 200, 128 250 M178 130 C 170 160, 170 200, 172 250" stroke="#9db8d0" stroke-width="2" fill="none"/>`)}`;
    case 'integumentary': return `
      ${g('skin', `<path d="M150 78 C 90 84, 74 150, 78 220 C 80 300, 88 380, 92 470 L 108 545 L 130 548 C 126 460, 124 380, 128 300 L 172 300 C 176 380, 174 460, 170 548 L 192 545 L 208 470 C 212 380, 220 300, 222 220 C 226 150, 210 84, 150 78 Z" fill="none" stroke="#f2c9a0" stroke-width="10" opacity="0.9"/>`)}`;
  }
  return '';
}

function setAnatomy(sys) {
  window._anatomySys = sys;
  App.render();
}
function anatomyPart(system, id) {
  const part = ANATOMY[system].parts.find(p => p[0] === id);
  if (!part) return;
  document.getElementById('anatomy-detail').innerHTML = `
    <div class="alert info"><b>${esc(part[1])}</b><br>${esc(part[2])}</div>`;
}
