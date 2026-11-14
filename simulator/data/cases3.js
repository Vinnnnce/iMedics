// Medic1905 clinical case library — Part 3: surgical specialties.

const CASES_PART3 = [

// ═══════════════════ CASE 9: SMALL BOWEL OBSTRUCTION ═══════════════════
{
  key: 'sbo-68m-adhesions',
  title: 'Colicky pain, vomiting and absolute constipation',
  specialty: 'general-surgery',
  difficulty: 'intern',
  scenario_type: 'surgical',
  description: 'A 68-year-old man with previous abdominal surgery presents with 24 hours of colicky central abdominal pain, repeated vomiting, distension and absolute constipation.',
  scenario: {
    patient: { name: 'Ahmed Farouk', age: 68, sex: 'M', occupation: 'Retired tailor', city: 'Amberfield' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Ahmed is doubled over intermittently with pain that comes in waves. His abdomen is visibly distended. "It started yesterday evening — the pain grips for a minute then eases, then grips again. I have not passed anything since."' },
    history: {
      complaint: 'Colicky central abdominal pain, vomiting, distension, absolute constipation',
      pmh: ['Open appendicectomy aged 34', 'Inguinal hernia repair aged 50', 'Hypertension', 'Ex-smoker'],
      meds: ['Amlodipine 5mg', 'Paracetamol PRN'],
      allergies: [],
      family: ['No relevant family history'],
      social: { smoking: 'Stopped 15 years ago', alcohol: 'Occasional', notes: 'Lives with wife. No weight loss, no change in bowel habit before this episode, no blood in stool.' }
    },
    emotions: { pain: 8, anxiety: 7, confusion: 0 },
    interview: [
      { tags: ['site'], match: ['where','site','location','pain'], a: 'All around the middle of my belly — above the navel, everywhere in the centre.' },
      { tags: ['character'], match: ['feel','like','describe','colicky','wave'], a: 'It comes in waves — grips for half a minute, terrible, then eases off completely. Then it builds again.' },
      { tags: ['onset'], match: ['when','start','how long','begin'], a: 'Yesterday evening, about 24 hours ago. I felt bloated first, then the waves of pain started.' },
      { tags: ['vomiting'], match: ['sick','vomit','nausea','throw up'], a: 'I have vomited at least eight times. First it was food, then green bile, now it is brown and smells awful. (Feculent vomiting — late sign.)' },
      { tags: ['constipation'], match: ['bowel','poo','stool','pass','wind','flatus','constipat'], a: 'Nothing at all since yesterday — no stool, and not even wind. I keep trying but nothing comes.' },
      { tags: ['distension'], match: ['swell','bloat','distend','big'], a: 'My belly has swollen up like a drum. My trousers will not do up.' },
      { tags: ['last_operation'], match: ['operation','surgery','appendix','appendicectom','hernia'], a: 'I had my appendix out when I was thirty-four, and a hernia repaired at fifty. Both open operations — big cuts.' },
      { tags: ['weight_loss'], match: ['weight','lost','appetite','cancer','bowel habit'], a: 'No weight loss, doctor. My bowels were completely regular until yesterday. No blood, no black stools.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills'], a: 'Blood pressure tablets and paracetamol. Nothing else.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None that I know of.' }
    ],
    exam: {
      general: 'In waves of pain, dry mucous membranes, tachycardic. Visible peristalsis intermittently. Gross abdominal distension.',
      systems: {
        abdominal: 'Grossly distended, tympanic to percussion. Generalised tenderness without guarding or rebound — no peritonism yet. High-pitched tinkling bowel sounds. No hernias palpable (check the old incisions). No masses.',
        cardiovascular: 'HR 112, regular. BP 104/66. CRT 4s. Dry tongue, reduced skin turgor.',
        respiratory: 'RR 20. Chest clear. Shallow breathing due to splinting from distension.',
        peripheral: 'Old right iliac fossa and groin incisions, well healed. No femoral or inguinal herniae on examination.'
      }
    },
    baselineVitals: { hr: 112, sbp: 104, dbp: 66, rr: 20, temp: 37.1, spo2: 97, gcs: 15, pain: 8 },
    labs: {
      baseline: { wcc: 12.8, hb: 138, platelets: 266, na: 132, k: 3.2, urea: 12.4, creatinine: 118, egfr: 52, crp: 28, abg_note: 'VBG pH 7.31, lactate 2.8, bicarbonate 20 — dehydration and early compromise', 'group_save': 'Group B RhD positive, antibodies negative' },
      phases: { 1: { wcc: 15.8, lactate: 4.6, crp: 96, k: 3.0, creatinine: 142 } }
    },
    imaging: {
      axr: { finding: 'Dilated small bowel loops (>3cm) in the central abdomen with valvulae conniventes visible. Multiple air-fluid levels. Minimal distal colonic gas. Consistent with small bowel obstruction.', phases: [0, 1] },
      ct_abdo: { finding: 'High-grade small bowel obstruction with a transition point in the right iliac fossa at the site of adhesions from previous appendicectomy. Dilated proximal small bowel up to 5cm. No evidence of strangulation or closed loop. Small volume free fluid. No mass lesions.', phases: [0, 1] },
      cxr: { finding: 'Clear lung fields. No free air under the diaphragm — no perforation evident.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Adhesional small bowel obstruction',
      aliases: ['small bowel obstruction', 'sbo', 'bowel obstruction', 'adhesional obstruction', 'adhesions'],
      differentials: [
        { dx: 'Adhesional small bowel obstruction', why: 'Previous open abdominal surgery, colicky pain, vomiting, absolute constipation' },
        { dx: 'Incarcerated hernia', why: 'Must examine all hernial orifices — excluded here' },
        { dx: 'Malignancy (colonic obstruction)', why: 'Age, but no weight loss or changed bowel habit; CT confirms adhesional transition point' },
        { dx: 'Volvulus', why: 'Sigmoid volvulus in elderly — coffee-bean sign on AXR absent' },
        { dx: 'Paralytic ileus', why: 'Post-op or electrolyte-driven; this pain is colicky with high-pitched sounds — mechanical' }
      ]
    },
    management: [
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'paracetamol'], label: 'Adequate analgesia', withinMin: 30, points: 8 },
      { id: 'bloods', type: 'lab', label: 'FBC, U&E + VBG (dehydration/compromise assessment)', withinMin: 45, points: 6 },
      { id: 'iv_fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'Aggressive IV fluid resuscitation with electrolyte correction', withinMin: 30, critical: true, points: 12 },
      { id: 'drip_suck', type: 'procedure', label: 'Drip and suck — NG tube decompression', withinMin: 60, critical: true, points: 10 },
      { id: 'imaging', type: 'imaging', label: 'Erect CXR + AXR ± CT abdomen', withinMin: 120, points: 6 },
      { id: 'surgical_review', type: 'procedure', label: 'Surgical review — trial of conservative management vs theatre', withinMin: 150, critical: true, points: 10 },
      { id: 'surgery', type: 'procedure', label: 'Laparotomy/adhesiolysis if failed conservative management or strangulation', withinMin: 480, points: 8 },
      { id: 'admit', type: 'admit', label: 'Admit under surgical team', withinMin: 120, points: 4 }
    ],
    theatre: {
      procedure: 'Adhesiolysis and small bowel decompression (open laparotomy)',
      anaesthesia: 'General anaesthesia with epidural or TAP blocks for postoperative analgesia',
      asa: 'ASA II (controlled hypertension, age 68)',
      risks: ['Bleeding', 'Infection', 'Bowel injury during adhesiolysis', 'Stoma formation if bowel unhealthy', 'Anastomotic leak', 'Incisional hernia', 'Venous thromboembolism', 'Need for ITU'],
      steps: [
        'WHO sign-in: patient identity, site, procedure, allergies confirmed',
        'General anaesthesia induction, epidural placed, antibiotic prophylaxis',
        'Midline laparotomy incision',
        'Lysis of adhesions with careful sharp dissection',
        'Run the bowel from ligament of Treitz to ileocaecal valve, inspecting viability',
        'Decompress dilated proximal small bowel',
        'Check for second obstruction point',
        'Warm lavage, haemostasis, count instruments and swabs',
        'Layered fascial closure',
        'WHO sign-out: counts correct, swab count zero, plan documented'
      ]
    },
    phases: [
      { id: 0, name: 'Mechanical obstruction — uncomplicated', maxMin: 180, timeoutNext: 1, stabilizeNext: 1, description: 'Complete obstruction. Fluid losses into the gut are huge — resuscitate and decompress.' },
      { id: 1, name: 'Strangulation risk', maxMin: 240, timeoutNext: 2, description: 'Rising lactate, localising tenderness, tachycardia worsening — the bowel is compromised.' },
      { id: 2, name: 'Strangulated obstruction', maxMin: 120, timeoutNext: 'death', description: 'Ischaemic bowel. Emergency theatre.' },
      { id: 'stable', name: 'Post-operative recovery', recovery: true, vitals: { hr: 84, sbp: 126, dbp: 72, rr: 14, temp: 36.8, spo2: 98, gcs: 15, pain: 3 }, description: 'Adhesiolysis complete, bowel viable, recovering on the surgical ward with epidural analgesia.' }
    ],
    interventions: {
      morphine: { pain: -4 }, fentanyl: { pain: -4 }, paracetamol: { pain: -2 },
      'sodium chloride 0.9%': { sbp: 12, hr: -12 },
      'potassium chloride': { k: 1.2 }
    },
    complications: [
      { id: 'strangulation', name: 'Bowel ischaemia / strangulation', trigger: { phase: 1, afterMin: 90, ifNotDone: ['drip_suck'] }, vitals: { hr: 128, sbp: 92, dbp: 56, rr: 26, temp: 38.2, spo2: 94, gcs: 14 }, description: 'Pain becomes constant and localised, peritonism develops, lactate 5.8. Ischaemic bowel — theatre now.' },
      { id: 'aspiration', name: 'Aspiration pneumonia', trigger: { phase: 0, afterMin: 60, chance: 0.3 }, description: 'Feculent vomiting with unprotected airway — right basal consolidation on the next chest film. NG tube and sitting up reduce the risk.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Colicky nature identified', 'Absolute constipation established', 'Previous abdominal surgery (adhesions)', 'No red flags for malignancy'] },
      examination: { points: 10, criteria: ['Distension and tympany', 'Bowel sound character', 'Hernial orifices examined', 'Hydration assessed'] },
      investigations: { points: 12, criteria: ['FBC/U&E', 'VBG/ABG with lactate', 'Erect CXR', 'AXR ± CT'] },
      diagnosis: { points: 10, criteria: ['Adhesional SBO identified', 'Strangulation risk recognised'] },
      management: { points: 20, criteria: ['IV fluids early', 'NG decompression', 'Analgesia', 'Surgical review and decision'] },
      safety: { points: 10, criteria: ['Electrolytes corrected before theatre', 'VTE prophylaxis consideration', 'Fluid balance monitored'] },
      communication: { points: 8, criteria: ['Explains drip-and-suck plan', 'Consent discussion if surgery needed'] },
      documentation: { points: 4, criteria: ['Fluid balance chart', 'Serial examination documented'] },
      timeliness: { points: 16, criteria: ['IV fluids within 30 minutes', 'NG tube within 60 minutes'] }
    },
    debrief: {
      summary: 'Adhesional small bowel obstruction: colicky pain, vomiting, distension and absolute constipation in a patient with previous open abdominal surgery. Management is resuscitation, decompression (drip and suck) and a trial of conservative management with low threshold for theatre if signs of strangulation develop.',
      learningPoints: [
        'Adhesions are the commonest cause of small bowel obstruction in patients with previous abdominal surgery.',
        'Feculent vomiting and absolute constipation indicate complete obstruction.',
        'Strangulation signs: constant pain, localising peritonism, tachycardia, rising lactate, fever — theatre without delay.',
        'Volume losses into obstructed bowel are enormous — resuscitate before imaging and theatre.',
        'Most adhesional obstructions settle with conservative management; surgery risks further adhesions and bowel injury.',
        'Always examine the hernial orifices — a missed incarcerated femoral hernia is a classic fatal error.'
      ],
      references: ['Bologna guidelines for diagnosis and management of adhesive small bowel obstruction (ASBO)', 'NICE guideline NG83 — bowel obstruction']
    }
  }
},

// ═══════════════════ CASE 10: FRACTURED NECK OF FEMUR ═══════════════════
{
  key: 'nof-82f-fall',
  title: 'A fall and a short, externally rotated leg',
  specialty: 'orthopaedics',
  difficulty: 'intern',
  scenario_type: 'surgical',
  description: 'An 82-year-old woman fell at home and cannot stand. Her leg is shortened and externally rotated. A classic orthogeriatric emergency with time-critical surgery.',
  scenario: {
    patient: { name: 'Margaret Osei', age: 82, sex: 'F', occupation: 'Retired headmistress', city: 'Westmere' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Margaret is brought in by ambulance on a stretcher, moaning with each movement. Her right leg lies obviously shortened and rotated outward. Paramedics: "Found on the floor after a neighbour heard her calling — probably there an hour or two."' },
    history: {
      complaint: 'Right hip pain after a fall, unable to weight-bear',
      pmh: ['Osteoporosis (on alendronate)', 'Atrial fibrillation on apixaban', 'Hypertension', 'Two previous falls (mechanical)'],
      meds: ['Apixaban 2.5mg BD', 'Amlodipine 5mg', 'Alendronate 70mg weekly', 'Calcium/Vitamin D'],
      allergies: [],
      family: ['Mother had a hip fracture aged 85'],
      social: { smoking: 'Never', alcohol: 'Occasional sherry', notes: 'Lives alone in a two-storey house, independent with a stick. Daughter nearby. Last ate breakfast 4 hours before the fall.' }
    },
    emotions: { pain: 8, anxiety: 7, confusion: 0 },
    interview: [
      { tags: ['onset'], match: ['when','start','fall','happen','how'], a: 'I slipped on the rug this morning. I heard something go — a crack. Then I could not get up. I lay there calling until Mrs. Ali next door heard me.' },
      { tags: ['site_pain'], match: ['where','pain','hurt','hip','leg'], a: 'The top of my right thigh — my hip. It is agony when anyone moves me, even a fraction.' },
      { tags: ['weight_bearing'], match: ['stand','walk','weight','bear','get up'], a: 'I cannot put a toe down. The moment I try, it is white-hot pain.' },
      { tags: ['leg_appearance'], match: ['leg','rotated','short','look','position'], a: 'The nurses say it is turned out to the side and looks shorter. That is how it feels too — wrong.' },
      { tags: ['head_injury'], match: ['head','hit','knock','black out','lost consciousness','concuss'], a: 'No, I did not hit my head. I felt dizzy for a second before I fell, that is all.' },
      { tags: ['pmh'], match: ['medical history','past','problems','bones','osteoporosis'], a: 'Thin bones — osteoporosis, they give me a tablet once a week. My heart rhythm is irregular, I take a blood thinner. Blood pressure.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills','blood thinner','anticoag'], a: 'Apixaban twice a day for my heart, the bone tablet, blood pressure tablet, and calcium. Nothing for pain except paracetamol.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None.' },
      { tags: ['fasting'], match: ['eat','food','drink','last ate','fasting','meal'], a: 'I had breakfast about four hours before the fall — tea and toast. Nothing since.' },
      { tags: ['baseline'], match: ['before','normally','independent','manage','help'], a: 'I manage everything myself. Cooking, cleaning, the garden. I would like to keep it that way, doctor.' }
    ],
    exam: {
      general: 'Frail but alert. Painful. Leg position diagnostic.',
      systems: {
        musculoskeletal: 'Right leg shortened by ~3cm, externally rotated. No leg shortening on the left. Tenderness over the right greater trochanter. Cannot actively or passively flex/abduct the right hip. Distal neurovascular intact — pulses palpable, sensation and movement preserved.',
        cardiovascular: 'AF 98/min irregular. BP 148/82. No murmur.',
        respiratory: 'Clear. No basal crepitations.',
        neuro: 'GCS 15/15. No focal deficits. No signs of head injury.',
        peripheral: 'Skin intact over the sacrum and heels — pressure areas documented pre-op.'
      }
    },
    baselineVitals: { hr: 98, sbp: 148, dbp: 82, rr: 18, temp: 36.6, spo2: 96, gcs: 15, pain: 8 },
    labs: {
      baseline: { wcc: 9.8, hb: 118, platelets: 214, na: 136, k: 4.0, urea: 9.2, creatinine: 82, egfr: 64, crp: 12, coag_note: 'Anti-Xa level low — apixaban effect present (last dose 12h ago)', 'group_save': 'Group A RhD positive', calcium: 2.38, alt: 22 },
      phases: { 1: { crp: 68, wcc: 12.2 } }
    },
    imaging: {
      'ecg_12': { finding: 'Atrial fibrillation at 98/min. No ischaemic changes.', phases: [0, 1] },
      'x-ray': { finding: 'X-ray pelvis: displaced intracapsular fracture of the right femoral neck (Garden III). Displacement of the femoral head. Proximal femur osteopenic. No other fracture.', phases: [0, 1] },
      cxr: { finding: 'Clear lung fields. No consolidation. Heart size normal.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Displaced intracapsular fractured neck of right femur (Garden III)',
      aliases: ['neck of femur', 'nof', 'femoral neck fracture', 'hip fracture', 'fractured hip', 'intracapsular fracture'],
      differentials: [
        { dx: 'Fractured neck of femur', why: 'Mechanism, shortening, external rotation, inability to weight-bear' },
        { dx: 'Intertrochanteric fracture', why: 'Same presentation — radiography distinguishes; management similar' },
        { dx: 'Pubic ramus fracture', why: 'Elderly fall, groin pain — usually able to bear weight partially' },
        { dx: 'Dislocation', why: 'Shortening and rotation — but trauma mechanism and X-ray distinguish' },
        { dx: 'Osteoarthritis flare / trochanteric bursitis', why: 'Chronic pain, no acute event' }
      ]
    },
    management: [
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'paracetamol'], label: 'Adequate analgesia (opioid + paracetamol; consider fascia iliaca block)', withinMin: 30, critical: true, points: 12 },
      { id: 'imaging', type: 'imaging', label: 'Pelvis X-ray', withinMin: 60, points: 8 },
      { id: 'bloods', type: 'lab', label: 'FBC, U&E, coagulation, group & save + crossmatch', withinMin: 60, points: 8 },
      { id: 'fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'IV fluids (patient nil by mouth, elderly, fasting)', withinMin: 45, points: 6 },
      { id: 'vte_timing', type: 'procedure', label: 'Anticoagulation management plan (apixaban timing before surgery)', withinMin: 90, points: 6 },
      { id: 'surgery', type: 'procedure', label: 'Surgery within 36 hours (ideally <24h) — hemiarthroplasty for displaced intracapsular fracture', withinMin: 1440, critical: true, points: 14 },
      { id: 'ortho_geri', type: 'procedure', label: 'Orthogeriatric review + pressure area care + nutrition', withinMin: 240, points: 5 },
      { id: 'admit', type: 'admit', label: 'Admit to orthopaedic ward', withinMin: 120, points: 4 }
    ],
    theatre: {
      procedure: 'Right cemented hemiarthroplasty (displaced intracapsular NOF)',
      anaesthesia: 'Spinal anaesthesia preferred in AF (avoids airway manipulation); GA if spinal fails',
      asa: 'ASA III (age 82, AF on anticoagulation, osteoporosis)',
      risks: ['Bleeding', 'Infection', 'Dislocation of the prosthesis', 'Peri-prosthetic fracture', 'Cardiac events (AF, ischaemia)', 'Chest infection', 'Confusion/delirium', 'VTE', 'Leg length discrepancy', 'Need for revision surgery'],
      steps: [
        'WHO sign-in: identity, site marked (RIGHT hip), allergies, last apixaban dose confirmed',
        'Spinal anaesthesia sited; sedation as required',
        'Lateral approach to the right hip',
        'Fracture exposed; femoral head removed',
        'Femoral canal prepared; cemented stem implanted',
        'Bipolar head seated; stability and leg length checked',
        'Haemostasis; layered closure',
        'WHO sign-out: swab and instrument counts correct, antibiotic given, plan documented'
      ]
    },
    phases: [
      { id: 0, name: 'Presentation', maxMin: 360, timeoutNext: 1, stabilizeNext: 1, description: 'Pain control, optimisation and theatre within 36 hours determine outcome.' },
      { id: 1, name: 'Delayed surgery complications', maxMin: 720, timeoutNext: 2, description: 'Every hour of delay raises the risk of pressure injuries, pneumonia, delirium and death.' },
      { id: 2, name: 'Deterioration', timeoutNext: 'death', description: 'Prolonged immobilisation in the elderly is lethal.' },
      { id: 'stable', name: 'Post-operative recovery', recovery: true, vitals: { hr: 88, sbp: 136, dbp: 76, rr: 16, temp: 36.9, spo2: 97, gcs: 15, pain: 4 }, description: 'Hemiarthroplasty complete. Day 2: sitting out, physiotherapy mobilising with a frame. Delirium screen negative.' }
    ],
    interventions: {
      morphine: { pain: -4 }, fentanyl: { pain: -4 }, paracetamol: { pain: -2 },
      'sodium chloride 0.9%': { sbp: 6, hr: -4 }
    },
    complications: [
      { id: 'hypostatic_pneumonia', name: 'Hypostatic pneumonia', trigger: { phase: 1, afterMin: 300, chance: 0.5 }, vitals: { rr: 26, temp: 38.1, spo2: 92, hr: 110 }, description: 'Breathlessness, basal crackles, fever — the cost of lying still. Incentive spirometry, sit out, physiotherapy, antibiotics.' },
      { id: 'delirium', name: 'Post-operative delirium', trigger: { phase: 1, afterMin: 360, chance: 0.4 }, description: 'Confused, pulling at lines, not recognising her daughter. Reorientation, glasses and hearing aid in, avoid sedatives, screen for sepsis.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Mechanism of fall', 'Anticoagulant history', 'Baseline function established', 'Fasting status (for theatre)'] },
      examination: { points: 10, criteria: ['Leg position documented', 'Neurovascular status', 'Pressure areas examined', 'Cognitive baseline'] },
      investigations: { points: 12, criteria: ['Pelvis X-ray', 'FBC/U&E/coagulation', 'Group & save', 'ECG'] },
      diagnosis: { points: 10, criteria: ['Displaced intracapsular NOF identified', 'Garden classification awareness'] },
      management: { points: 20, criteria: ['Prompt analgesia', 'Anticoagulation plan', 'Surgery within 36 hours', 'Orthogeriatric input'] },
      safety: { points: 10, criteria: ['Apixaban timing respected', 'Pressure area care', 'Spinal anaesthesia consideration'] },
      communication: { points: 8, criteria: ['Consent discussion including risks', 'Involves daughter', 'Honest rehabilitation discussion'] },
      documentation: { points: 4, criteria: ['Falls assessment started', 'Theatre plan documented'] },
      timeliness: { points: 16, criteria: ['Analgesia within 30 minutes', 'Theatre within 36 hours'] }
    },
    debrief: {
      summary: 'Displaced intracapsular fractured neck of femur in a frail 82-year-old on apixaban. Management: prompt analgesia, imaging, crossmatch, anticoagulation timing, and hemiarthroplasty within 36 hours — earlier is better. Orthogeriatric co-care prevents the post-op killers: pneumonia, delirium, pressure injuries and VTE.',
      learningPoints: [
        'Shortened, externally rotated leg + inability to weight-bear = NOF fracture until proven otherwise.',
        'Displaced intracapsular fractures (Garden III/IV) disrupt retinacular blood supply — heal poorly, so hemiarthroplasty rather than fixation.',
        'Surgery within 36 hours (ideally <24) reduces 30-day mortality.',
        'Anticoagulated patients: balance timing of surgery against reversal — apixaban 12h+ before spinal is standard.',
        'Spinal anaesthesia reduces pulmonary complications and delirium in the elderly.',
        'The fracture is the beginning: orthogeriatric care, delirium prevention, pressure care, nutrition and falls work-up determine outcome.'
      ],
      references: ['NICE guideline CG124 — hip fracture management', 'BOAST — hip fracture care standard']
    }
  }
},

// ═══════════════════ CASE 11: TENSION PNEUMOTHORAX ═══════════════════
{
  key: 'tension-ptx-24m-trauma',
  title: 'Chest pain and breathlessness after a road accident',
  specialty: 'emergency (trauma)',
  difficulty: 'intern',
  scenario_type: 'emergency',
  description: 'A 24-year-old motorcyclist arrives by ambulance after a high-speed crash with rapidly worsening breathlessness, distended neck veins and absent breath sounds on the right. Seconds matter.',
  scenario: {
    patient: { name: 'Luca Berisha', age: 24, sex: 'M', occupation: 'Courier motorcyclist', city: 'Port Meridian' },
    presentation: { setting: 'Emergency & Trauma Department (resus bay)', triage: 'category 1', initial: 'Luca is on the resus trolley, pale and gasping. His right chest is clearly asymmetric with visible bruising from handlebar impact. Paramedics: "High-speed off his bike. Chest hit the bars. BP was 110 on scene, now 84 systolic and falling. RR 36. He is going downhill FAST."' },
    history: {
      complaint: 'Chest pain and severe breathlessness after handlebar impact',
      pmh: ['Fit and healthy', 'No medications', 'Appendicectomy age 12'],
      meds: [],
      allergies: [],
      family: [],
      social: { smoking: 'Never', alcohol: 'Weekends', notes: 'Wearing a helmet. Fully alert initially but getting drowsier. Last ate 3 hours ago.' }
    },
    emotions: { pain: 7, anxiety: 10, confusion: 2 },
    interview: [
      { tags: ['onset'], match: ['when','what happened','crash','accident','injur'], a: '(Gasping) The bike... crashed... my chest hit the... handlebars. It hurts to breathe. (Speaks 2-3 words at a time.)' },
      { tags: ['breath'], match: ['breath','air','breathe','short'], a: '(Fighting for air) Cannot... get air in. Getting worse... every minute. (RR 36, SpO2 falling.)' },
      { tags: ['pain_site'], match: ['where','pain','hurt','chest'], a: 'Right... side of my chest. Sharp... with every breath. (Guarding right chest wall.)' },
      { tags: ['pmh'], match: ['medical history','healthy','problems','past'], a: 'Never... sick. No tablets. (Deteriorating — do not delay resuscitation for history.)' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None... I think. Please... help me breathe.' }
    ],
    exam: {
      general: 'Periarrest. Agitated then drowsy. Trachea deviated AWAY from the right side. Cyanosing.',
      systems: {
        respiratory: 'RR 36. RIGHT chest: absent breath sounds, hyper-resonant to percussion, visibly over-expanded and moving poorly, bruising over the ribs. Trachea deviated to the LEFT. SpO2 84% and falling despite high-flow oxygen.',
        cardiovascular: 'HR 128, BP 84/50 and falling. JVP grossly distended. Muffled heart sounds. CRT 6s. Pale, clammy.',
        neuro: 'GCS 13 (E3V4M6) and dropping — hypoxia and hypoperfusion.',
        abdominal: 'Rigid abdomen cannot be excluded —FAST scan later. Priority is the chest.'
      }
    },
    baselineVitals: { hr: 128, sbp: 84, dbp: 50, rr: 36, temp: 36.4, spo2: 84, gcs: 13, pain: 7 },
    labs: {
      baseline: { abg: 'pH 7.18, pO2 6.0 kPa, pCO2 6.9, lactate 5.8 — severe hypoxaemia with mixed acidosis', hb: 142, wcc: 14.6, na: 138, k: 4.8, urea: 6.8, creatinine: 96, 'group_save': 'Group O RhD negative emergency units issued' },
      phases: {}
    },
    imaging: {
      cxr: { finding: 'Complete collapse of the right lung with mediastinal shift to the left, tracheal deviation and depression of the right hemidiaphragm. Right chest wall bruising. THIS FILM IS ONLY OBTAINED IF THE PATIENT SURVIVES TO IMAGING — the diagnosis is clinical and treatment must not wait for it.', phases: [0] }
    },
    hidden: {
      diagnosis: 'Right tension pneumothorax secondary to blunt chest trauma',
      aliases: ['tension pneumothorax', 'tension ptx', 'pneumothorax'],
      differentials: [
        { dx: 'Tension pneumothorax', why: 'Absent breath sounds, hyper-resonance, tracheal deviation, haemodynamic compromise — a CLINICAL diagnosis' },
        { dx: 'Massive haemothorax', why: 'Also absent breath sounds but DULL to percussion with shock' },
        { dx: 'Cardiac tamponade', why: 'Beck triad; muffled sounds, JVP up — but lungs would be symmetric' },
        { dx: 'Open pneumothorax', why: 'Visible sucking chest wound — none here' },
        { dx: 'Flail chest', why: 'Paradoxical movement; may coexist but does not explain tracheal deviation' }
      ]
    },
    management: [
      { id: 'oxygen', type: 'oxygen', label: 'High-flow oxygen immediately', withinMin: 3, critical: true, points: 10 },
      { id: 'needle_decomp', type: 'procedure', label: 'Needle thoracostomy / finger decompression — 2nd intercostal space mid-clavicular line (or 5th ICS anterior axillary line), RIGHT side, NOW', withinMin: 5, critical: true, points: 20 },
      { id: 'chest_drain', type: 'procedure', label: 'Chest drain insertion (Seldinger, 5th ICS anterior axillary line)', withinMin: 30, critical: true, points: 12 },
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'ketamine'], label: 'Analgesia (careful titration in haemodynamic compromise)', withinMin: 20, points: 5 },
      { id: 'imaging', type: 'imaging', label: 'Chest X-ray AFTER decompression ± CT trauma series', withinMin: 60, points: 5 },
      { id: 'trauma_team', type: 'procedure', label: 'Trauma team activation / senior call', withinMin: 10, points: 6 },
      { id: 'admit', type: 'admit', label: 'Admit to trauma ICU', withinMin: 120, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Peri-arrest — tension physiology', maxMin: 5, timeoutNext: 'death', description: 'The patient is dying in front of you. Diagnosis is clinical. Decompress NOW.' },
      { id: 'stable', name: 'Post-decompression', recovery: true, vitals: { hr: 104, sbp: 118, dbp: 68, rr: 26, temp: 36.5, spo2: 96, gcs: 15, pain: 6 }, description: 'A rush of air escapes the decompression cannula. BP climbs, SpO2 recovers. Chest drain inserted, lung re-expanding on the film. ICU for monitoring.' }
    ],
    interventions: {
      oxygen: { spo2: 8, rr: -2 },
      morphine: { pain: -3 }, fentanyl: { pain: -3 }
    },
    complications: [
      { id: 'arrest', name: 'Cardiac arrest from obstructive shock', trigger: { phase: 0, afterMin: 5, ifNotDone: ['needle_decomp'] }, vitals: { hr: 30, sbp: 0, dbp: 0, rr: 4, spo2: 40, gcs: 3 }, description: 'Pulseless electrical activity — obstructive shock from mediastinal shift. CPR will not work until the tension is released.' }
    ],
    rubric: {
      history: { points: 6, criteria: ['Mechanism of injury (AMPLE where possible)', 'Does not delay resuscitation for history'] },
      examination: { points: 14, criteria: ['Recognises absent breath sounds + hyper-resonance', 'Notes tracheal deviation', 'Haemodynamic assessment', 'Recognises clinical (not radiological) diagnosis'] },
      investigations: { points: 8, criteria: ['No delay of treatment for imaging', 'Post-decompression imaging'] },
      diagnosis: { points: 16, criteria: ['Tension pneumothorax identified within minutes', 'Distinguishes from haemothorax/tamponade'] },
      management: { points: 24, criteria: ['Immediate decompression within 5 minutes', 'Chest drain', 'High-flow oxygen', 'Trauma team activation'] },
      safety: { points: 10, criteria: ['Correct side and site for decompression', 'Does not wait for X-ray', 'ATLS principles'] },
      communication: { points: 6, criteria: ['Directs resus team clearly'] },
      documentation: { points: 4, criteria: ['Timeline of interventions documented'] },
      timeliness: { points: 12, criteria: ['Decompression within 5 minutes of arrival'] }
    },
    debrief: {
      summary: 'Tension pneumothorax is a CLINICAL diagnosis in the crashing trauma patient: absent breath sounds, hyper-resonance, tracheal deviation away from the affected side, distended neck veins, and hypotension. Treatment is immediate needle/finger decompression — never wait for a chest X-ray. Definitive management is a chest drain.',
      learningPoints: [
        'Never order a chest X-ray to confirm a suspected tension pneumothorax — the diagnosis is clinical and the treatment is immediate decompression.',
        'Needle decompression: 2nd intercostal space, mid-clavicular line, at least 8cm cannula in an adult (or 5th ICS anterior axillary line in longer chest walls).',
        'Tension physiology kills by obstructing venous return — CPR is futile until the chest is decompressed.',
        'Haemothorax is the close cousin: dull (not resonant) to percussion with shock — drain via large-bore chest tube, thoracotomy if >1500mL immediately.',
        'Beck triad (hypotension, JVP distension, muffled heart sounds) suggests tamponade — but a tension pneumothorax can coexist with tamponade-like signs.',
        'After decompression, always place a chest drain: the cannula kinks and the pneumothorax re-tensions.'
      ],
      references: ['ATLS 10th edition — thoracic trauma', 'RCEM guidance on needle thoracostomy']
    },
    theatre: {
      procedure: 'Intercostal chest drain insertion — left 5th intercostal space, anterior axillary line (Seldinger technique)',
      anaesthesia: 'Procedural sedation (ketamine or midazolam ± fentanyl) with generous local anaesthetic infiltration — never insert a chest drain without analgesia',
      asa: 'ASA II (healthy 24-year-old, multiply injured)',
      risks: [
        'Lung laceration by trocar or guidewire',
        'Bleeding from intercostal vessels (neurovascular bundle runs along the LOWER border of each rib)',
        'Subdiaphragmatic placement — drain in the liver or spleen',
        'Surgical emphysema',
        'Infection of the drain site or empyema',
        'Drain dislodgement or kinking',
        'Damage to the long thoracic nerve (winged scapula)'
      ],
      steps: [
        'WHO sign-in: identity, allergies, airway, adequacy of decompression confirmed',
        'Time-out: team introductions, side confirmed (LEFT) and marked, CXR/trauma imaging displayed',
        'Procedural sedation commenced with continuous monitoring',
        'Local anaesthetic infiltrated generously at the 5th ICS anterior axillary line',
        'Incision made parallel to the rib, just ABOVE the lower rib of the interspace',
        'Blunt dissection with forceps down to the pleura — never plunge',
        'Pleura opened with the forceps tip; hiss of air confirms position',
        'Finger sweep to clear the tract and confirm no adhesions',
        'Guidewire advanced over the needle (Seldinger) or drain placed over the tract',
        'Drain directed toward the apex and secured with sutures',
        'Drain connected to an underwater seal at 20cm suction',
        'Swing and bubbles confirmed — the drain is working',
        'Chest X-ray to confirm position and re-expansion',
        'WHO sign-out: drain documented, imaging saved, analgesia plan, trauma ICU bed confirmed'
      ]
    }
  }
},

// ═══════════════════ CASE 12: ECTOPIC PREGNANCY ═══════════════════
{
  key: 'ectopic-27f-rupture',
  title: 'Shoulder tip pain and collapse at seven weeks',
  specialty: 'obstetrics (gynaecology)',
  difficulty: 'resident',
  scenario_type: 'obstetric',
  description: 'A 27-year-old woman with seven weeks of amenorrhoea and a positive pregnancy test presents with unilateral abdominal pain radiating to the shoulder tip, then collapses. A gynaecological emergency.',
  scenario: {
    patient: { name: 'Nadia El-Amin', age: 27, sex: 'F', occupation: 'Graphic designer', city: 'Solaria City' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 1-2', initial: 'Nadia is pale and sweating on the trolley, holding her lower left abdomen. Midway through triage she suddenly feels faint and her BP drops. "The pain moved into my shoulder — the tip, like someone is pushing on it."' },
    history: {
      complaint: 'Left lower abdominal pain radiating to the left shoulder tip',
      pmh: ['Previous chlamydia infection (treated, age 22)', 'Copper IUD in situ — removed at presentation', 'No previous surgery'],
      meds: ['None'],
      allergies: [],
      family: [],
      social: { smoking: '10/day', alcohol: 'Occasional', notes: 'Regular cycles. LMP 7 weeks ago. Home pregnancy test positive 1 week ago. Single sexual partner. Two previous terminations.' }
    },
    emotions: { pain: 8, anxiety: 10, confusion: 0 },
    interview: [
      { tags: ['onset'], match: ['when','start','begin','how long'], a: 'The tummy pain started yesterday evening, low on the left. It was sharp and steady. Then an hour ago it went into my shoulder — the very tip.' },
      { tags: ['shoulder'], match: ['shoulder','tip','referred','arm'], a: 'The tip of my LEFT shoulder — a strange deep ache, worse when I lie flat. Nobody has touched the shoulder, it just started aching. (Blood irritating the diaphragm — referred pain from haemoperitoneum.)' },
      { tags: ['period_preg'], match: ['period','pregnan','last period','lmp','test','amenorrh'], a: 'My period is seven weeks late. I did a test last week — positive. I was going to book a scan.' },
      { tags: ['pain_site'], match: ['where','pain','hurt','tummy','abdomen'], a: 'Low down on the left side of my belly. It is constant now, and getting worse. My whole belly is starting to ache.' },
      { tags: ['bleeding'], match: ['bleed','blood','discharge','spotting'], a: 'A little brown spotting two days ago. Nothing heavy. I thought it was normal in early pregnancy.' },
      { tags: ['collapse_dizzy'], match: ['faint','dizzy','collapse','light','black out','stand'], a: 'When I stood up at triage the room went black. I had to sit down. The nurse says my blood pressure is low.' },
      { tags: ['gynae_history'], match: ['infection','chlamydia','contraception','coil','iud','previous pregnanc'], a: 'I had chlamydia when I was twenty-two — treated with tablets. I had a coil, but the doctor just removed it. I have been pregnant twice before — terminations.' },
      { tags: ['smoking'], match: ['smoke','cigarette'], a: 'About ten a day. I know it is bad.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None.' },
      { tags: ['bowel_bladder'], match: ['urine','wee','bowel','poo','diarrhoea'], a: 'Passing urine normally — it stings a little. Bowels normal. No sickness bugs.' }
    ],
    exam: {
      general: 'Pale, cold and clammy. Tachycardic. Peritoneal signs developing. Haemodynamically unstable at times of collapse.',
      systems: {
        cardiovascular: 'HR 124, BP 88/54 (dropping to 70/45 on standing/sitting). JVP flat. CRT 5s.',
        abdominal: 'Left iliac fossa tenderness with guarding and rebound developing across the lower abdomen. Cervical excitation tenderness on vaginal examination. Adnexal tenderness left side. No masses.',
        respiratory: 'RR 24. Chest clear. Left shoulder tip tenderness on deep breathing (referred pain).',
        gynaecological: 'PV: closed os, blood in the vault, exquisite left adnexal tenderness on bimanual examination.'
      }
    },
    baselineVitals: { hr: 124, sbp: 88, dbp: 54, rr: 24, temp: 36.8, spo2: 98, gcs: 15, pain: 8 },
    labs: {
      baseline: { hcg: 'POSITIVE — quantitative 3,820 IU/L (consistent with ~6-7 weeks but low for dates)', hb: 96, wcc: 12.1, platelets: 224, na: 136, k: 4.2, urea: 6.4, creatinine: 68, 'group_save': 'Group O RhD positive, crossmatch 4 units urgent', abg_note: 'VBG lactate 3.6 — hypovolaemia' },
      phases: { 1: { hb: 74, lactate: 5.4 } }
    },
    imaging: {
      'us_obs': { finding: 'Transvaginal ultrasound: empty uterine cavity. Left adnexal complex mass (3.2cm) separate from the ovary, with free fluid in the pouch of Douglas. No intrauterine gestational sac. Findings consistent with ectopic pregnancy with haemoperitoneum.', phases: [0, 1] },
      'ct_abdo': { finding: 'Not the imaging of choice in a young pregnant patient with a clear clinical picture — ultrasound and clinical assessment take priority. (Would show haemoperitoneum if performed.)', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Ruptured left tubal ectopic pregnancy with haemoperitoneum',
      aliases: ['ectopic', 'tubal pregnancy', 'ruptured ectopic', 'extrauterine pregnancy'],
      differentials: [
        { dx: 'Ectopic pregnancy (rupturing)', why: 'Positive hCG, empty uterus, shoulder tip pain, collapse, peritonism' },
        { dx: 'Miscarriage (threatened/incomplete)', why: 'Bleeding + positive test — but no shoulder tip pain or collapse' },
        { dx: 'Ovarian torsion / ruptured cyst', why: 'Unilateral pain — torsion has sudden severe pain with vomiting' },
        { dx: 'Appendicitis', why: 'Right-sided typically, no pregnancy context here' },
        { dx: 'UTI/pyelonephritis', why: 'Dysuria noted — but does not explain haemodynamic change' }
      ]
    },
    management: [
      { id: 'abc_resus', type: 'procedure', label: 'ABC + two large-bore IV access + activate major haemorrhage protocol if unstable', withinMin: 10, critical: true, points: 14 },
      { id: 'hcg_test', type: 'lab', item: 'hcg', label: 'Urgent beta-hCG (urine + quantitative serum)', withinMin: 15, critical: true, points: 10 },
      { id: 'bloods_crossmatch', type: 'lab', label: 'FBC + group & save/crossmatch', withinMin: 20, critical: true, points: 8 },
      { id: 'us_scan', type: 'imaging', item: 'us_obs', label: 'Urgent transvaginal ultrasound', withinMin: 30, critical: true, points: 10 },
      { id: 'gynae_referral', type: 'procedure', label: 'Immediate gynaecology referral', withinMin: 20, critical: true, points: 10 },
      { id: 'surgery', type: 'procedure', label: 'Emergency laparoscopy/laparotomy — salpingectomy (or salpingotomy if contralateral tube absent)', withinMin: 120, critical: true, points: 14 },
      { id: 'anti_d', type: 'procedure', label: 'Anti-D if RhD negative (check group)', withinMin: 120, points: 4 },
      { id: 'admit', type: 'admit', label: 'Theatre then HDU/gynae ward', withinMin: 180, points: 4 }
    ],
    theatre: {
      procedure: 'Emergency laparoscopic left salpingectomy with evacuation of haemoperitoneum',
      anaesthesia: 'General anaesthesia with rapid sequence induction (pregnant patient — aspiration risk)',
      asa: 'ASA I-II (young, healthy) but haemodynamically unstable — highest risk category',
      risks: ['Bleeding (ongoing)', 'Need for laparotomy if laparoscopy fails', 'Loss of the left tube — future fertility', 'Recurrence of ectopic in future pregnancies', 'Infection', 'Venous thromboembolism', 'Need for blood transfusion'],
      steps: [
        'WHO sign-in: identity, confirmed ectopic, allergies, RSI plan',
        'Rapid sequence induction — pregnant stomach considered full',
        'Pneumoperitoneum established carefully (haemodynamic instability)',
        'Laparoscopy: 1.5L of blood in the abdomen, ruptured left tube identified',
        'Left salpingectomy with diathermy/vascular sealant',
        'Evacuation of haemoperitoneum, washout',
        'Haemostasis confirmed, right tube inspected',
        'Port closure',
        'WHO sign-out: blood loss and products documented, plan documented'
      ]
    },
    phases: [
      { id: 0, name: 'Rupturing ectopic — compensation failing', maxMin: 30, timeoutNext: 1, description: 'Haemoperitoneum accumulating. Shoulder tip pain is diaphragmatic irritation. Theatre cannot wait for perfect imaging.' },
      { id: 1, name: 'Class III haemorrhagic shock', maxMin: 30, timeoutNext: 'death', description: 'BP falling, Hb dropping, lactate rising. Exsanguinating into the peritoneum.' },
      { id: 'stable', name: 'Post-salpingectomy recovery', recovery: true, vitals: { hr: 88, sbp: 118, dbp: 70, rr: 16, temp: 36.7, spo2: 99, gcs: 15, pain: 4 }, description: 'Laparoscopic salpingectomy complete, 1.8L blood evacuated, two units transfused. Stable on the gynaecology ward. Psychological support and follow-up arranged.' }
    ],
    interventions: {
      'sodium chloride 0.9%': { sbp: 10, hr: -8 }
    },
    complications: [
      { id: 'massive_haemorrhage', name: 'Massive haemoperitoneum', trigger: { phase: 1, afterMin: 20, ifNotDone: ['surgery'] }, vitals: { hr: 148, sbp: 62, dbp: 38, rr: 30, spo2: 92, gcs: 11 }, description: 'Cardiac output failing. Peri-arrest. Major haemorrhage protocol and theatre simultaneously.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Menstrual/pregnancy history', 'Shoulder tip pain recognised as referred', 'Previous chlamydia as risk factor', 'Sexual/contraceptive history'] },
      examination: { points: 10, criteria: ['Postural BP', 'Abdominal + adnexal examination', 'Cervical excitation', 'Signs of haemorrhagic shock'] },
      investigations: { points: 12, criteria: ['hCG', 'FBC + crossmatch', 'Transvaginal ultrasound', 'No delay for CT'] },
      diagnosis: { points: 12, criteria: ['Ectopic pregnancy identified early', 'Rupture recognised'] },
      management: { points: 22, criteria: ['Immediate resuscitation', 'Gynae referral', 'Emergency surgery', 'Anti-D consideration'] },
      safety: { points: 10, criteria: ['RSI for pregnancy', 'Transfusion safety', 'Time-critical decisions made promptly'] },
      communication: { points: 8, criteria: ['Sensitive breaking of news', 'Fertility implications discussed', 'Psychological follow-up arranged'] },
      documentation: { points: 4, criteria: ['Time of collapse and theatre documented'] },
      timeliness: { points: 12, criteria: ['Gynae referral within 20 minutes', 'Theatre within 2 hours'] }
    },
    debrief: {
      summary: 'Ruptured ectopic pregnancy: positive hCG, empty uterus, unilateral pain with shoulder tip radiation, peritonism and haemodynamic instability. Treatment is resuscitation and emergency surgery — laparoscopic salpingectomy in most cases. Every woman of childbearing age with abdominal pain needs a pregnancy test.',
      learningPoints: [
        'Pregnancy test in EVERY woman of childbearing age with abdominal pain — no exceptions.',
        'Shoulder tip pain = referred pain from diaphragmatic irritation by blood — think ruptured ectopic or splenic rupture.',
        'Shoulder tip pain + positive pregnancy test = ectopic until proven otherwise.',
        'Previous PID/chlamydia, IUD use, and prior tubal surgery are the classic risk triad.',
        'The IUD does not prevent ectopic pregnancy — it prevents intrauterine pregnancy. Pregnancy with an IUD in situ is ectopic until proven otherwise.',
        'A low quantitative hCG with an empty uterus at 6-7 weeks is suspicious for ectopic.',
        'RhD-negative women need Anti-D after ectopic pregnancy.'
      ],
      references: ['NICE guideline NG126 — ectopic pregnancy and miscarriage', 'RCOG Green-top guideline: management of tubal pregnancy']
    }
  }
},

// ═══════════════════ CASE 13: TESTICULAR TORSION ═══════════════════
{
  key: 'torsion-15m-scrotum',
  title: 'Sudden scrotal pain in a teenager',
  specialty: 'urology',
  difficulty: 'undergraduate',
  scenario_type: 'surgical',
  description: 'A 15-year-old boy wakes at 4 a.m. with agonising sudden scrotal pain and vomiting. Time is testicle — the salvage window is six hours.',
  scenario: {
    patient: { name: 'Marcus Lindberg', age: 15, sex: 'M', occupation: 'School pupil', city: 'Willowdale' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Marcus is brought in by his father, walking awkwardly and refusing to sit. He is pale, sweaty and keeps shifting position. "It woke me at four in the morning — like being kicked. The pain has not stopped. I vomited twice."' },
    history: {
      complaint: 'Sudden severe left scrotal pain with vomiting',
      pmh: ['Previous episode 6 months ago — resolved spontaneously after 20 minutes', 'No surgery'],
      meds: [],
      allergies: [],
      family: [],
      social: { notes: 'Mother abroad for work; father present. No sexual activity. No trauma. No urinary symptoms.' }
    },
    emotions: { pain: 9, anxiety: 8, confusion: 0, embarrassment: 9 },
    interview: [
      { tags: ['onset'], match: ['when','start','wake','how long','begin'], a: 'It woke me up at four this morning. Sudden — like a kick. Nothing like this has ever happened to me. (Father hovers — the boy is embarrassed but in too much pain to hide it.)' },
      { tags: ['pain_site'], match: ['where','pain','hurt','which side','left','right'], a: 'The left side of my... my scrotum. It is swollen and it kills when anything touches it. It goes up into my groin a bit.' },
      { tags: ['vomiting'], match: ['sick','vomit','nausea','throw'], a: 'I threw up twice when it started. I still feel sick.' },
      { tags: ['previous_episode'], match: ['before','previous','last time','similar','happened again'], a: 'Something like this six months ago — bad pain, but it went away by itself after twenty minutes. The doctor said if it comes back, come straight in.' },
      { tags: ['trauma'], match: ['hit','injury','kick','trauma','accident','sport'], a: 'No. Nothing hit me. I was asleep.' },
      { tags: ['urinary'], match: ['urine','wee','burning','sting','pee','discharge'], a: 'It stings a little when I pee, but not like an infection. No discharge. I have not... you know... done anything.' },
      { tags: ['nausea_abdominal'], match: ['tummy','abdomen','belly','stomach pain'], a: 'My lower tummy aches on the left, where the pain goes up into the groin.' },
      { tags: ['fever'], match: ['fever','temperature','hot','unwell','flu'], a: 'No fever that I know of. Just the pain and the sickness.' }
    ],
    exam: {
      general: 'In severe pain, curled posture, nauseated. Afebrile — argues against infection.',
      systems: {
        genitourinary: 'Left hemiscrotum swollen, exquisitely tender, riding HIGH in the scrotum (high-riding testis). Left testis lying transversely. Absent cremasteric reflex on the left (right normal). Thickened, tender left cord. Right testis normal and comfortable. No penile discharge.',
        abdominal: 'Soft. Left lower quadrant tenderness only by referral.',
        cardiovascular: 'HR 104 (pain). BP 118/70.',
        respiratory: 'Unremarkable.'
      }
    },
    baselineVitals: { hr: 104, sbp: 118, dbp: 70, rr: 18, temp: 36.9, spo2: 99, gcs: 15, pain: 9 },
    labs: {
      baseline: { wcc: 10.8, hb: 142, platelets: 248, crp: 8, urinalysis: 'No nitrites, no leucocytes, trace blood (pain-related)', na: 138, k: 4.1, urea: 4.8, creatinine: 64 },
      phases: {}
    },
    imaging: {
      'us_doppler_leg': { finding: 'Scrotal Doppler ultrasound: ABSENT arterial flow to the left testis with a spiral twist (whirlpool sign) of the left spermatic cord. Right testis normal flow. Consistent with left testicular torsion. (Ultrasound should NEVER delay theatre when the clinical picture is clear.)', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Left testicular torsion',
      aliases: ['torsion', 'testicular torsion', 'twisted testicle', 'torted testis'],
      differentials: [
        { dx: 'Testicular torsion', why: 'Sudden onset, vomiting, high-riding testis, absent cremasteric, prior self-resolving episode' },
        { dx: 'Epididymo-orchitis', why: 'More gradual, fever, normal cremasteric — age atypical here' },
        { dx: 'Torsion of the appendix testis', why: 'Focal tender blue-dot sign, less dramatic' },
        { dx: 'Incarcerated inguinal hernia', why: 'Mass at the external ring' },
        { dx: 'Trauma', why: 'Denied — no history' }
      ]
    },
    management: [
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'paracetamol'], label: 'Adequate analgesia', withinMin: 20, points: 8 },
      { id: 'urology_referral', type: 'procedure', label: 'IMMEDIATE urology/surgical referral — do not delay for imaging', withinMin: 20, critical: true, points: 14 },
      { id: 'manual_detorsion', type: 'procedure', label: 'Attempt manual detorsion (open-book, medial-to-lateral rotation) if theatre delayed', withinMin: 45, points: 6 },
      { id: 'surgery', type: 'procedure', label: 'Emergency scrotal exploration + orchidopexy (both testes) within 6 hours', withinMin: 240, critical: true, points: 16 },
      { id: 'consent', type: 'procedure', label: 'Consent discussion with Marcus and his father (including orchidectomy risk if non-viable)', withinMin: 120, points: 6 },
      { id: 'admit', type: 'admit', label: 'Theatre then day-case/ward', withinMin: 360, points: 4 }
    ],
    theatre: {
      procedure: 'Bilateral orchidopexy via scrotal exploration (left testis detorsed and fixed; right fixed prophylactically)',
      anaesthesia: 'General anaesthesia',
      asa: 'ASA I (healthy teenager)',
      risks: ['Loss of the left testis if non-viable (orchidectomy)', 'Recurrence despite fixation', 'Infection', 'Bleeding/haematoma', 'Future fertility implications', 'Cosmetic asymmetry'],
      steps: [
        'WHO sign-in: identity with Marcus AND father, side confirmed (LEFT), allergies, nil by mouth confirmed',
        'General anaesthesia induced',
        'Left hemiscrotal incision',
        'Tunica vaginalis opened — testis inspected: dusky but viable after detorsion (clockwise 540°)',
        'Warm packs; viability confirmed by colour and bleeding at incision',
        'Left testis fixed to the scrotal wall with non-absorbable sutures (orchidopexy)',
        'Right testis explored through the same midline raphe incision and fixed prophylactically',
        'Haemostasis and closure',
        'WHO sign-out: fixation documented, plan documented'
      ]
    },
    phases: [
      { id: 0, name: 'Torsion — salvage window open', maxMin: 240, timeoutNext: 1, description: 'Testicular salvage rate ~90% within 6 hours, ~50% by 12 hours, near 0% after 24. Theatre now.' },
      { id: 1, name: 'Ischaemia progressing', maxMin: 240, timeoutNext: 2, description: 'Testis becoming dusky and non-viable. The window is closing.' },
      { id: 2, name: 'Non-viable testis', maxMin: 240, description: 'Necrotic testis — orchidectomy required. Salvage no longer possible.' },
      { id: 'stable', name: 'Post-orchidopexy', recovery: true, vitals: { hr: 78, sbp: 120, dbp: 72, rr: 14, temp: 36.8, spo2: 99, gcs: 15, pain: 3 }, description: 'Detorsed and fixed in theatre within 4 hours — testis viable. Both testes fixed. Discharge with urology follow-up.' }
    ],
    interventions: {
      morphine: { pain: -4 }, fentanyl: { pain: -4 }, paracetamol: { pain: -2 }
    },
    complications: [
      { id: 'non_viable', name: 'Testicular necrosis', trigger: { phase: 2, afterMin: 60 }, description: 'The testis is dusky black at exploration despite detorsion — orchidectomy required. The salvage window was missed.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Sudden onset in the night', 'Vomiting with the pain', 'Previous self-resolving episode (intermittent torsion)', 'Trauma and infection excluded'] },
      examination: { points: 12, criteria: ['High-riding testis documented', 'Cremasteric reflex tested', 'Both testes examined', 'Fever absent — argues against infection'] },
      investigations: { points: 8, criteria: ['Urinalysis to exclude infection', 'Imaging not delaying theatre'] },
      diagnosis: { points: 12, criteria: ['Torsion identified rapidly', 'Differentiated from epididymitis'] },
      management: { points: 22, criteria: ['Immediate surgical referral', 'No delay for ultrasound', 'Theatre within 6 hours', 'Consent including father'] },
      safety: { points: 10, criteria: ['Nil by mouth status', 'Side confirmed and marked', 'Time-critical decisions'] },
      communication: { points: 10, criteria: ['Age-appropriate consent with parent', 'Handles embarrassment sensitively', 'Honest discussion about fertility'] },
      documentation: { points: 4, criteria: ['Time of onset and timeline documented'] },
      timeliness: { points: 12, criteria: ['Referral within 20 minutes', 'Theatre within 6 hours'] }
    },
    debrief: {
      summary: 'Testicular torsion: sudden severe scrotal pain with vomiting, high-riding testis, absent cremasteric reflex, and prior episodes of self-resolving pain (intermittent torsion). Diagnosis is clinical; treatment is emergency scrotal exploration within 6 hours. Ultrasound must never delay theatre.',
      learningPoints: [
        'Time is testicle: salvage ~90% within 6h, ~50% by 12h, ~0% after 24h.',
        'Vomiting with sudden scrotal pain = torsion until proven otherwise.',
        'The cremasteric reflex disappears in torsion; a high-riding transverse testis is characteristic.',
        'A previous episode that resolved spontaneously = intermittent torsion — these patients always re-torse. Fix them electively.',
        'Do not order Doppler ultrasound when the clinical picture is classic — it delays theatre and the surgeon can be there faster.',
        'Fix BOTH testes — the anatomical bell-clapper deformity is usually bilateral.'
      ],
      references: ['EAU guidelines on urological emergencies', 'BAUS guidance — testicular torsion']
    }
  }
},

// ═══════════════════ CASE 14: ACUTE CHOLECYSTITIS ═══════════════════
{
  key: 'cholecystitis-45f',
  title: 'Right upper quadrant pain after a takeaway',
  specialty: 'general-surgery',
  difficulty: 'undergraduate',
  scenario_type: 'surgical',
  description: 'A 45-year-old woman presents with 12 hours of severe right upper quadrant pain after a fatty meal, fever and vomiting. Murphy\'s sign awaits.',
  scenario: {
    patient: { name: 'Brenda Fitzgerald', age: 45, sex: 'F', occupation: 'Restaurant manager', city: 'Coralstrand' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 3', initial: 'Brenda is doubled to the right, holding her right upper abdomen, breathing shallowly to avoid moving. "It started after the family takeaway — fish and chips. Pain under my right ribs, into my right shoulder. I have been sick three times."' },
    history: {
      complaint: 'Right upper quadrant pain radiating to the right shoulder, fever, vomiting',
      pmh: ['Similar but milder episodes after fatty meals for 2 years (biliary colic)', 'Obesity BMI 34', 'Type 2 diabetes (diet-controlled)'],
      meds: ['Metformin 500mg BD'],
      allergies: [],
      family: ['Mother had gallbladder surgery'],
      social: { smoking: 'Never', alcohol: 'Rarely', notes: 'Four children. Works around food. Fatty food reliably triggers pain.' }
    },
    emotions: { pain: 8, anxiety: 6, confusion: 0 },
    interview: [
      { tags: ['onset'], match: ['when','start','after','meal','trigger','how long'], a: 'Last night, about an hour after a big fish and chips. The pain built up over an hour and has not stopped since — twelve hours now.' },
      { tags: ['site'], match: ['where','pain','site','ribs','right'], a: 'Under my right ribs — and it goes right through to the tip of my right shoulder blade. Lying still is the only relief.' },
      { tags: ['character'], match: ['feel','like','describe','constant','colicky','sharp'], a: 'Constant, sharp, and it gets worse every time I breathe deeply. Nothing like the gripping pains I have had before — this one will not let go.' },
      { tags: ['previous_episodes'], match: ['before','previous','similar','episodes','gallbladder','colic'], a: 'For two years I have had attacks after fatty meals — gripping pain for a few hours, then gone. My doctor said probably gallstones. This is the worst one ever and it is not going.' },
      { tags: ['fever'], match: ['fever','hot','temperature','shiver','sweat'], a: 'I felt hot and shivery overnight. Sweating through my nightdress.' },
      { tags: ['vomiting'], match: ['sick','vomit','nausea','throw'], a: 'Three times. Bilious. I feel constantly nauseated.' },
      { tags: ['jaundice'], match: ['yellow','jaundice','eyes','dark urine','pale stool','itch'], a: 'No yellow in my eyes, my urine is normal colour, my stools are normal. (No obstructive features — important!)' },
      { tags: ['pmh'], match: ['medical history','past','diabetes','problems'], a: 'Diet-controlled diabetes. My weight has been a battle all my life. Nothing else.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills'], a: 'Metformin, twice a day. Nothing else.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None.' }
    ],
    exam: {
      general: 'Overweight, febrile, unwell, lying still. Shallow breathing.',
      systems: {
        abdominal: 'Tender right upper quadrant with guarding. MURPHY\'S SIGN POSITIVE — inspiratory arrest on palpation under the right costal margin. No rebound tenderness elsewhere. No palpable gallbladder or masses. Bowel sounds present.',
        cardiovascular: 'HR 108, regular. BP 126/74.',
        respiratory: 'Shallow respiration, RR 20. Clear chest.',
        peripheral: 'No jaundice (sclerae white). No stigmata of chronic liver disease.'
      }
    },
    baselineVitals: { hr: 108, sbp: 126, dbp: 74, rr: 20, temp: 38.4, spo2: 97, gcs: 15, pain: 8 },
    labs: {
      baseline: { wcc: 15.6, hb: 134, platelets: 258, crp: 112, na: 136, k: 3.8, urea: 5.6, creatinine: 72, alt: 88, ast: 76, alp: 186, bilirubin: 24, amylase: 68, 'group_save': 'Group A RhD positive', lipase: 45 },
      phases: { 1: { wcc: 18.4, crp: 180, alt: 120, alp: 240 } }
    },
    imaging: {
      'us_abdo': { finding: 'Thickened gallbladder wall (5mm) with pericholecystic fluid, gallstones including a 14mm stone impacted at the neck, and a positive sonographic Murphy\'s sign. Common bile duct 4mm (normal). Consistent with acute calculous cholecystitis. No ductal dilation — no obstruction.', phases: [0, 1] },
      'ct_abdo': { finding: 'Gallbladder wall thickening and pericholecystic inflammation with an impacted gallstone. No perforation or abscess. Liver normal. (Ultrasound is first-line; CT if complications suspected.)', phases: [0, 1] },
      axr: { finding: 'Non-specific. Only ~15% of gallstones are radio-opaque — abdominal X-ray has no role in uncomplicated cholecystitis.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Acute calculous cholecystitis',
      aliases: ['cholecystitis', 'gallbladder infection', 'inflamed gallbladder', 'acute cholecystitis'],
      differentials: [
        { dx: 'Acute cholecystitis', why: 'RUQ pain after fatty meal, fever, positive Murphy\'s sign, known gallstones' },
        { dx: 'Biliary colic', why: 'Previous episodes — but colic resolves within hours and has no fever' },
        { dx: 'Ascending cholangitis', why: 'Requires jaundice + fever + pain (Charcot triad) — bilirubin normal here' },
        { dx: 'Perforated peptic ulcer', why: 'Sudden severe pain, board-like rigidity — not this picture' },
        { dx: 'Right lower lobe pneumonia', why: 'RUQ pain referred — chest would reveal it' },
        { dx: 'Acute pancreatitis', why: 'Amylase/lipase normal — can coexist with gallstone disease' }
      ]
    },
    management: [
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'paracetamol', 'diclofenac'], label: 'Analgesia (opioid ± NSAID; NSAIDs reduce need for opioids in cholecystitis)', withinMin: 30, points: 8 },
      { id: 'bloods', type: 'lab', label: 'FBC, CRP, U&E, LFTs, amylase/lipase, glucose (diabetic)', withinMin: 60, points: 8 },
      { id: 'ultrasound', type: 'imaging', item: 'us_abdo', label: 'RUQ ultrasound (first-line for gallstones)', withinMin: 120, points: 10 },
      { id: 'antibiotics', type: 'drug', drugs: ['co-amoxiclav', 'metronidazole', 'ceftriaxone'], label: 'IV antibiotics (e.g. co-amoxiclav ± metronidazole per local guidelines)', withinMin: 90, points: 10 },
      { id: 'iv_fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'IV fluids for vomiting and sepsis', withinMin: 60, points: 5 },
      { id: 'surgical_review', type: 'procedure', label: 'Surgical review — early laparoscopic cholecystectomy (within index admission)', withinMin: 180, points: 8 },
      { id: 'surgery', type: 'procedure', label: 'Laparoscopic cholecystectomy', withinMin: 1440, points: 10 },
      { id: 'admit', type: 'admit', label: 'Admit under surgical team', withinMin: 120, points: 4 }
    ],
    theatre: {
      procedure: 'Laparoscopic cholecystectomy',
      anaesthesia: 'General anaesthesia with muscle relaxation',
      asa: 'ASA II (obesity BMI 34, diet-controlled T2DM)',
      risks: ['Bleeding', 'Infection', 'Bile duct injury (~0.3-0.5%, serious)', 'Bile leak', 'Retained stones', 'Conversion to open surgery', 'Clips/instruments required for the critical view of safety', 'VTE'],
      steps: [
        'WHO sign-in: identity, procedure, allergies, pregnancy status excluded',
        'GA induction, pneumoperitoneum, ports placed',
        'Retraction of gallbladder fundus — critical view of safety obtained',
        'Cystic duct and artery identified and clipped',
        'Gallbladder dissected off the liver bed',
        'Specimen bag retrieval',
        'Haemostasis of the liver bed, washout',
        'Port closure',
        'WHO sign-out: critical view documented, swabs counted'
      ]
    },
    phases: [
      { id: 0, name: 'Acute cholecystitis', maxMin: 720, timeoutNext: 1, description: 'Inflamed gallbladder with impacted stone. Antibiotics and early surgery give the best outcomes.' },
      { id: 1, name: 'Progressive sepsis', maxMin: 720, timeoutNext: 2, description: 'Rising inflammatory markers, swinging fever — gangrenous cholecystitis developing.' },
      { id: 2, name: 'Complicated cholecystitis', maxMin: 480, description: 'Gangrenous or emphysematous cholecystitis, possible perforation — high-dependency care and urgent surgery.' },
      { id: 'stable', name: 'Post-cholecystectomy recovery', recovery: true, vitals: { hr: 80, sbp: 122, dbp: 74, rr: 14, temp: 36.7, spo2: 99, gcs: 15, pain: 3 }, description: 'Laparoscopic cholecystectomy completed uneventfully. Eating and drinking day one. Discharged with the gallstones in a jar as a souvenir.' }
    ],
    interventions: {
      morphine: { pain: -4 }, fentanyl: { pain: -4 }, paracetamol: { pain: -2, temp: -0.6 },
      diclofenac: { pain: -3, temp: -0.6 },
      'co-amoxiclav': { temp: -1.0, hr: -10 }, metronidazole: { temp: -0.7, hr: -6 }, ceftriaxone: { temp: -1.0, hr: -10 },
      'sodium chloride 0.9%': { sbp: 6, hr: -6 }
    },
    complications: [
      { id: 'gangrenous', name: 'Gangrenous cholecystitis', trigger: { phase: 1, afterMin: 360, ifNotDone: ['antibiotics'] }, vitals: { hr: 126, temp: 39.2, sbp: 106, spo2: 94 }, description: 'Swinging fevers, worsening sepsis. The gallbladder wall is dying — the operation just became urgent.' },
      { id: 'cholangitis', name: 'Ascending cholangitis', trigger: { phase: 1, afterMin: 480, chance: 0.3 }, vitals: { hr: 132, temp: 39.5, sbp: 96, gcs: 13 }, description: 'Charcot triad completed: jaundice now visible, rigors, RUQ pain. Bile duct obstruction with sepsis — biliary drainage (ERCP) needed.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Fatty food trigger', 'Previous biliary colic pattern', 'Fever and vomiting', 'Jaundice excluded (eyes, urine, stool)'] },
      examination: { points: 12, criteria: ['Murphy\'s sign performed', 'Right shoulder radiation noted', 'Jaundice excluded clinically', 'Vital signs with fever'] },
      investigations: { points: 12, criteria: ['FBC/CRP', 'LFTs + amylase/lipase', 'RUQ ultrasound', 'Glucose in a diabetic'] },
      diagnosis: { points: 10, criteria: ['Acute cholecystitis identified', 'Cholangitis and pancreatitis excluded'] },
      management: { points: 20, criteria: ['Analgesia incl. NSAID', 'IV antibiotics', 'IV fluids', 'Surgical review for cholecystectomy'] },
      safety: { points: 10, criteria: ['Diabetes monitoring', 'Antibiotic allergy check', 'VTE prophylaxis (obesity)'] },
      communication: { points: 8, criteria: ['Explains gallstone disease', 'Sets expectations for surgery'] },
      documentation: { points: 4, criteria: ['Murphy\'s sign and fever documented'] },
      timeliness: { points: 14, criteria: ['Analgesia within 30 minutes', 'Antibiotics within 90 minutes'] }
    },
    debrief: {
      summary: 'Acute calculous cholecystitis: constant RUQ pain after a fatty meal with fever and a positive Murphy\'s sign in a patient with known gallstones. Management: analgesia (NSAIDs reduce opioid need), IV antibiotics, fluids and early laparoscopic cholecystectomy during the index admission.',
      learningPoints: [
        'Biliary colic resolves within hours and has NO fever; cholecystitis is constant pain WITH fever and Murphy\'s sign.',
        'Murphy\'s sign: inspiratory arrest on palpation under the right costal margin — specific for cholecystitis.',
        'Ultrasound is the first-line imaging: wall thickening, pericholecystic fluid, stones, sonographic Murphy\'s.',
        'Charcot triad (fever + jaundice + RUQ pain) = ascending cholangitis — needs biliary drainage, not just antibiotics.',
        'Check amylase/lipase — gallstone pancreatitis travels with gallstone disease.',
        'Early laparoscopic cholecystectomy (within the same admission) shortens illness and reduces readmissions.',
        'Diabetic patients with cholecystitis get sicker faster — monitor glucose closely.'
      ],
      references: ['Tokyo Guidelines (TG18) for diagnosis and management of acute cholecystitis', 'NICE guideline CG188 — gallstone disease']
    }
  }
}
];

module.exports = { CASES_PART3 };
