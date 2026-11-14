// Medic1905 clinical case library — Part 1.
// Each case is a complete scenario: interview script, examination findings,
// phase-linked vitals/labs/imaging, hidden diagnosis, management targets,
// progression rules, rubric and debrief.
// Format documented in docs/ARCHITECTURE.md.

const CASES_PART1 = [

// ═════════════════════════ CASE 1: STEMI ═════════════════════════
{
  key: 'stemi-58m-chest-pain',
  title: 'Crushing central chest pain',
  specialty: 'cardiology',
  difficulty: 'intern',
  scenario_type: 'emergency',
  description: 'A 58-year-old taxi driver presents to the Emergency Department with 90 minutes of crushing central chest pain radiating to the left arm, sweating and nausea.',
  scenario: {
    patient: { name: 'Daniel Mensah', age: 58, sex: 'M', occupation: 'Taxi driver', city: 'Port Meridian' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Daniel is brought to the ED by his wife. He is clutching his chest, grey and sweaty, and clearly frightened. Triage nurse: "Sudden onset chest pain started about 90 minutes ago, pain score 9/10."' },
    history: {
      complaint: 'Crushing central chest pain radiating to the left arm',
      pmh: ['Type 2 diabetes (6 years)', 'Hypertension (10 years)', 'Hypercholesterolaemia'],
      meds: ['Metformin 1g BD', 'Ramipril 10mg OD', 'Atorvastatin 40mg OD'],
      allergies: [{ drug: 'Penicillin', reaction: 'Skin rash as a child' }],
      family: ['Father died of a heart attack aged 60', 'Brother had stents at 55'],
      social: { smoking: '20/day for 30 years (15 pack-years... actually 15 pack-years x2 = 30 pack-years)', alcohol: 'Rarely', exercise: 'Sedentary', notes: 'Lives with wife; two adult children' }
    },
    emotions: { pain: 9, anxiety: 8, confusion: 0 },
    interview: [
      { tags: ['site','location'], match: ['where','site','location','point'], a: 'Right in the middle of my chest, doctor. It feels like an elephant is sitting on it.' },
      { tags: ['onset','duration'], match: ['when','start','how long','began','duration'], a: 'It started about an hour and a half ago, while I was parking my taxi. Came on suddenly, like a punch.' },
      { tags: ['character'], match: ['what does it feel','character','like','describe','type of pain'], a: 'It is crushing — heavy pressure, like a tight band. Not sharp, not burning.' },
      { tags: ['radiation'], match: ['radiate','spread','go anywhere','move','arm','jaw','neck'], a: 'It goes down my left arm — the inside of it. My jaw feels tight too. Both started with the chest pain.' },
      { tags: ['severity'], match: ['score','bad','severe','scale','rate'], a: 'Nine out of ten. The worst pain I have ever felt.' },
      { tags: ['associates_sweat'], match: ['sweat','clammy','cold','pale'], a: 'Yes, I am dripping with sweat and feel cold all over. My wife says I turned grey.' },
      { tags: ['associates_nausea'], match: ['sick','nausea','vomit','nauseous'], a: 'I feel very nauseated. I have not actually vomited, but I keep swallowing.' },
      { tags: ['associates_breath'], match: ['breath','breathe','short of breath','air'], a: 'Yes, I feel short of breath now — like I cannot get enough air, especially lying back.' },
      { tags: ['aggravating'], match: ['worse','make it worse','aggravat','deep breath','movement'], a: 'It is constant. Nothing makes it worse — not breathing, not moving, not eating.' },
      { tags: ['relieving'], match: ['better','relieve','ease','help','rest','stopped'], a: 'Nothing has helped. I pulled over and rested for ten minutes but the pain never eased.' },
      { tags: ['cardiac_syncope'], match: ['faint','collapse','black out','syncope','dizzy'], a: 'No, I have not blacked out. I felt dizzy for a moment when I first stood up.' },
      { tags: ['pmh'], match: ['medical history','past','conditions','illnesses','problems','diabetes'], a: 'I have diabetes and high blood pressure, both for years. They say my cholesterol is high too.' },
      { tags: ['meds'], match: ['medication','tablets','medicine','drugs','taking','pills'], a: 'Metformin, ramipril and a statin — the white blood pressure one and the cholesterol one. I take them most days.' },
      { tags: ['allergies'], match: ['allerg','reaction','penicillin'], a: 'Penicillin gives me a rash. It happened when I was a boy.' },
      { tags: ['family'], match: ['family','parents','relatives','brother','mother','father'], a: 'My father died of a heart attack at sixty. My younger brother had stents put in at fifty-five.' },
      { tags: ['smoking'], match: ['smoke','cigarette','tobacco'], a: 'I smoke about twenty a day. I know, I know — I have tried to stop three times.' },
      { tags: ['previous_episodes'], match: ['before','previous','last time','ever had'], a: 'Never had chest pain before. Maybe a bit of heartburn after spicy food, but nothing like this.' }
    ],
    exam: {
      general: 'Appears unwell, grey and diaphoretic. Clutching chest. Cannot lie flat.',
      systems: {
        cardiovascular: 'S1 + S2 audible, no murmurs. Pulse regular 96/min. JVP not elevated. No peripheral oedema. Chest wall not tender to palpation.',
        respiratory: 'Basal crepitations bilaterally. SpO2 91% on air. Respiratory rate 22.',
        abdominal: 'Soft, non-tender. No organomegaly. Bowel sounds present.',
        neuro: 'GCS 15/15. No focal deficits. Anxious but orientated.'
      }
    },
    baselineVitals: { hr: 96, sbp: 148, dbp: 92, rr: 22, temp: 36.8, spo2: 91, gcs: 15, pain: 9 },
    labs: {
      baseline: { hb: 141, wcc: 11.9, platelets: 245, na: 136, k: 3.9, urea: 6.2, creatinine: 88, egfr: 78, glucose: 11.2, crp: 6, troponin: 52, ck: 285, alt: 32, lipids: 'Total 6.8, LDL 4.9 — untreated', hba1c: 64 },
      phases: { 1: { troponin: 1120, wcc: 12.8, crp: 14 } }
    },
    imaging: {
      ecg_12: { finding: 'Sinus rhythm 96/min. ST elevation 3mm in II, III and aVF with reciprocal ST depression in I and aVL. Q waves forming in the inferior leads. IMPRESSION: Acute inferior STEMI.', phases: [0, 1] },
      cxr: { finding: 'Mild pulmonary oedema — small bilateral pleural effusions, upper-lobe venous diversion. Heart size normal. No pneumothorax.', phases: [0, 1] },
      echo: { finding: 'Hypokinesia of the inferior wall. LVEF 45%. No significant valvular disease. No pericardial effusion.', phases: [0, 1] },
      angio_coronary: { finding: 'Acute occlusion of the right coronary artery (RCA) at the proximal segment with thrombus. Left system unremarkable. Successful PCI with drug-eluting stent to RCA.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Acute inferior ST-elevation myocardial infarction (STEMI) due to proximal RCA occlusion',
      aliases: ['stem', 'inferior mi', 'myocardial infarction', 'heart attack', 'rca occlusion', 'st elevation'],
      differentials: [
        { dx: 'Acute coronary syndrome / STEMI', why: 'Crushing central pain, risk factors, autonomic features' },
        { dx: 'Aortic dissection', why: 'Severe chest pain — must exclude; would give tearing pain to back, unequal pulses' },
        { dx: 'Gastro-oesophageal reflux / oesophageal spasm', why: 'Central chest pain, but does not explain sweating and ECG changes' },
        { dx: 'Pericarditis / myocarditis', why: 'Pleuritic, positional pain; widespread saddle ST elevation' },
        { dx: 'Pulmonary embolism', why: 'Chest pain + breathlessness + hypoxia; pleuritic character typically' }
      ]
    },
    management: [
      { id: 'ecg', type: 'imaging', item: 'ecg_12', label: '12-lead ECG within 10 minutes', withinMin: 10, critical: true, points: 10 },
      { id: 'monitor', type: 'procedure', label: 'Attach continuous cardiac monitoring', withinMin: 15, points: 5 },
      { id: 'aspirin', type: 'drug', drugs: ['aspirin'], label: 'Aspirin 300mg chewed', withinMin: 20, critical: true, points: 10 },
      { id: 'oxygen', type: 'oxygen', label: 'Oxygen (SpO2 target 94-98%)', withinMin: 15, points: 5 },
      { id: 'analgesia', type: 'drug', drugs: ['morphine', 'fentanyl', 'gt spray', 'gtn spray'], label: 'Adequate analgesia (opioid ± GTN)', withinMin: 25, points: 8 },
      { id: 'anticoag', type: 'drug', drugs: ['enoxaparin'], label: 'Anticoagulation (LMWH)', withinMin: 40, points: 5 },
      { id: 'reperfusion', type: 'procedure', label: 'Reperfusion — activate cath lab / PCI (or thrombolysis if no PCI access)', withinMin: 60, critical: true, points: 15 },
      { id: 'statin', type: 'drug', drugs: ['atorvastatin'], label: 'High-intensity statin', withinMin: 120, points: 3 },
      { id: 'admit', type: 'admit', label: 'Admit to cardiac care unit', withinMin: 150, points: 4 }
    ],
    phases: [
      { id: 0, name: 'Initial presentation', maxMin: 20, timeoutNext: 1, stabilizeNext: 'stable', description: 'Continuous ischaemic pain, autonomic features. ECG diagnostic.' },
      { id: 1, name: 'Ongoing ischaemia / deterioration', maxMin: 30, timeoutNext: 2, description: 'Pain persists despite incomplete treatment. Risk of arrhythmia rising.' },
      { id: 2, name: 'Cardiogenic deterioration', maxMin: 25, timeoutNext: 'death', description: 'Prolonged untreated ischaemia — patient becomes cold, clammy, hypotensive.' },
      { id: 'stable', name: 'Stabilised post-reperfusion', recovery: true, vitals: { hr: 78, sbp: 128, dbp: 76, rr: 16, temp: 36.9, spo2: 97, gcs: 15, pain: 2 }, description: 'Pain relieved after reperfusion and treatment. Patient stable for transfer to CCU.' }
    ],
    interventions: {
      oxygen: { spo2: 6, rr: -2 },
      aspirin: { sbp: -4 },
      'gt spray': { sbp: -12, pain: -2 },
      'gtn spray': { sbp: -12, pain: -2 },
      morphine: { pain: -4, hr: -6, rr: -2 },
      fentanyl: { pain: -4, hr: -6, rr: -2 },
      'sodium chloride 0.9%': { sbp: 6 }
    },
    complications: [
      { id: 'vf_arrest', name: 'Ventricular fibrillation cardiac arrest', trigger: { phase: 1, afterMin: 8, ifNotDone: ['ecg', 'aspirin'] }, vitals: { hr: 0, sbp: 0, dbp: 0, rr: 4, spo2: 60, gcs: 3, pain: 0 }, requires: 'defib', deathAfterMin: 4, description: 'Monitor shows VF. Patient loses consciousness.' },
      { id: 'cardiogenic_shock', name: 'Cardiogenic shock', trigger: { phase: 2, afterMin: 15 }, vitals: { hr: 122, sbp: 84, dbp: 55, rr: 28, spo2: 85, gcs: 13 }, description: 'Cold and clammy, mottled peripheries, urine output falling.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Site, character and radiation of pain', 'Risk factors: smoking, family history, diabetes', 'Associated autonomic features'] },
      examination: { points: 8, criteria: ['Cardiovascular examination', 'Respiratory examination'] },
      investigations: { points: 12, criteria: ['ECG within 10 minutes', 'Troponin', 'Chest X-ray', 'Appropriate, focused testing without excess'] },
      diagnosis: { points: 12, criteria: ['STEMI identified', 'Differential includes aortic dissection or PE'] },
      management: { points: 20, criteria: ['Aspirin within 20 minutes', 'Analgesia', 'Reperfusion decision within 60 minutes', 'Oxygen for hypoxia'] },
      safety: { points: 10, criteria: ['No contraindicated drugs', 'Allergy awareness (penicillin)', 'Safe prescribing'] },
      communication: { points: 8, criteria: ['Empathetic approach to a frightened patient', 'Explains plan to patient'] },
      documentation: { points: 5, criteria: ['Admission note documenting findings and plan'] },
      timeliness: { points: 15, criteria: ['Door-to-ECG under 10 minutes', 'Door-to-reperfusion under 60 minutes'] }
    },
    debrief: {
      summary: 'Daniel Mensah suffered an acute inferior STEMI caused by proximal RCA occlusion. The ECG (ST elevation II, III, aVF with reciprocal changes) is diagnostic within minutes of arrival. Management is immediate aspirin, analgesia, oxygen if hypoxic, anticoagulation and urgent reperfusion — primary PCI if achievable within 120 minutes, otherwise thrombolysis.',
      learningPoints: [
        'The 12-lead ECG within 10 minutes of arrival is the single most important first step in chest pain triage.',
        'Inferior STEMI: watch for bradyarrhythmias and RV involvement — nitroglycerine can cause catastrophic hypotension if the RV is involved (ST elevation V4R).',
        'Thrombolysis is contraindicated after recent head trauma, prior intracranial haemorrhage and uncontrolled bleeding.',
        'Reciprocal ST depression in I/aVL strongly supports true inferior STEMI rather than pericarditis.',
        'Diabetic patients may present atypically — Daniel\'s presentation was classic, but always ask about risk factors.'
      ],
      references: ['ESC Guidelines for the management of acute coronary syndromes in patients presenting without persistent ST-segment elevation', 'AHA/ACC STEMI Performance Measures']
    }
  }
},

// ═════════════════════════ CASE 2: APPENDICITIS ═════════════════════════
{
  key: 'appendicitis-22f-rlq',
  title: 'Right iliac fossa pain and vomiting',
  specialty: 'general-surgery',
  difficulty: 'undergraduate',
  scenario_type: 'surgical',
  description: 'A 22-year-old student presents with 24 hours of migrating abdominal pain, now localised to the right iliac fossa, with anorexia and vomiting.',
  scenario: {
    patient: { name: 'Amara Okafor', age: 22, sex: 'F', occupation: 'University student', city: 'Aurelia City' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 3', initial: 'Amara walks slowly into the ED, bent slightly forward, holding her right lower abdomen. She looks pale and uncomfortable.' },
    history: {
      complaint: 'Right iliac fossa pain, 24 hours',
      pmh: ['No significant medical history', 'Appendicectomy NOT performed — appendix intact'],
      meds: ['Combined oral contraceptive pill'],
      allergies: [],
      family: ['No relevant family history'],
      social: { smoking: 'Never', alcohol: 'Occasional', notes: 'Final-year engineering student. LMP: 12 days ago, regular cycles, not pregnant (test will confirm).' }
    },
    emotions: { pain: 7, anxiety: 6, confusion: 0 },
    interview: [
      { tags: ['site'], match: ['where','site','location','point','tummy','abdomen'], a: 'It started around my belly button, but now it is low down on the right side — here (points to right iliac fossa).' },
      { tags: ['onset'], match: ['when','start','begin','how long'], a: 'Yesterday afternoon, about 24 hours ago. It was dull around my navel first, then moved to the right side over a few hours.' },
      { tags: ['migration'], match: ['move','moved','shift','elsewhere','navel','belly button','umbilic'], a: 'Yes — it began around the belly button and settled into the right lower part. Moving made me realise it was worse on the right.' },
      { tags: ['character'], match: ['feel','like','sharp','dull','ache','describe'], a: 'At first it was a dull ache. Now it is a constant sharp pain that makes me want to keep still.' },
      { tags: ['severity'], match: ['score','bad','severe','scale','rate'], a: 'Seven out of ten. If I cough or walk it jumps to nine.' },
      { tags: ['aggravating'], match: ['worse','cough','move','walk','jol','pressure','bounce'], a: 'Any movement makes it worse — coughing, walking, even going over bumps in the car on the way here.' },
      { tags: ['appetite'], match: ['eat','appetite','food','hungry','eaten'], a: 'I have not eaten since yesterday morning. The thought of food makes me feel sick.' },
      { tags: ['nausea_vomiting'], match: ['sick','vomit','nausea','throw up','nauseous'], a: 'I felt sick yesterday evening and vomited twice last night — small amounts, watery.' },
      { tags: ['bowels'], match: ['bowel','poo','stool','diarrhoea','constipat','pass'], a: 'My bowels have not opened since yesterday. No diarrhoea. I passed urine normally this morning — it did sting or anything.' },
      { tags: ['urinary'], match: ['urine','wee','pee','burning','sting','cystitis','waterwork'], a: 'No burning when I pass urine, no blood, going normal amounts.' },
      { tags: ['gynae'], match: ['period','menstrual','pregnan','last period','discharge','intercourse'], a: 'My last period was twelve days ago, completely normal. No discharge. I am on the pill. There is no chance I could be pregnant — but I would not mind a test to be sure.' },
      { tags: ['systemic'], match: ['fever','temperature','hot','sweat','shiver','rigor','flu'], a: 'I felt hot and shivery last night. I have not taken my temperature.' },
      { tags: ['pmh'], match: ['medical history','past','operation','surgery','illness'], a: 'I have never had any operations or serious illnesses. My appendix is definitely still in there.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills','taking'], a: 'Just the contraceptive pill. Nothing else. No painkillers today — nothing has touched the pain anyway.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'No allergies at all.' },
      { tags: ['previous_episodes'], match: ['before','previous','ever','same pain','last time'], a: 'I have never had pain like this before. Occasional period cramps, but this is different — it does not feel like that.' }
    ],
    exam: {
      general: 'Ill-looking, lying still, flexed right hip. Low-grade pyrexia 37.9°C. Tachycardia 104.',
      systems: {
        abdominal: 'Tender with guarding in the right iliac fossa. Rebound tenderness present. Rovsing\'s sign positive. Positive psoas sign. Bowel sounds reduced. No palpable mass.',
        cardiovascular: 'Tachycardic 104/min, regular. BP 110/68. No murmur.',
        respiratory: 'Clear — shallow breathing due to pain.',
        gynaecological: 'Not performed in ED; cervical excitation not assessed — pregnancy test pending.'
      }
    },
    baselineVitals: { hr: 104, sbp: 110, dbp: 68, rr: 18, temp: 37.9, spo2: 98, gcs: 15, pain: 7 },
    labs: {
      baseline: { hb: 132, wcc: 14.8, platelets: 298, na: 137, k: 4.1, urea: 5.1, creatinine: 62, crp: 49, hcg: '<5 — NOT pregnant', urinalysis: 'No blood, no nitrites, no leucocytes, trace protein', alt: 24, bilirubin: 11 },
      phases: { 1: { wcc: 17.2, crp: 96 }, 2: { wcc: 19.5, crp: 180, creatinine: 88 } }
    },
    imaging: {
      'us_abdo': { finding: 'Non-compressible, dilated appendix (9mm diameter) in the right iliac fossa with surrounding echogenic fat. Small volume free fluid. Consistent with acute appendicitis.', phases: [0, 1] },
      ct_abdo: { finding: 'Acute appendicitis with a 10mm dilated appendix, appendicolith, peri-appendiceal fat stranding and a small abscess collection (2cm) at the tip. No free perforation.', phases: [0, 1, 2] },
      ecg_12: { finding: 'Normal sinus rhythm. (Not indicated clinically — would not earn investigation points.)', phases: [0, 1, 2] }
    },
    hidden: {
      diagnosis: 'Acute appendicitis',
      aliases: ['appendicit', 'appendix', 'inflamed appendix'],
      differentials: [
        { dx: 'Acute appendicitis', why: 'Migratory pain, anorexia, vomiting, RIF signs, leucocytosis' },
        { dx: 'Ectopic pregnancy', why: 'Must exclude in any woman of childbearing age — pregnancy test mandatory' },
        { dx: 'Ovarian torsion / cyst', why: 'Sudden severe unilateral pain with gynaecological pathology' },
        { dx: 'Mesenteric adenitis / gastroenteritis', why: 'More common in children, high WCC with GI symptoms' },
        { dx: 'Urinary tract infection / stone', why: 'Exclude with urinalysis — no urinary symptoms here' }
      ]
    },
    management: [
      { id: 'analgesia', type: 'drug', drugs: ['paracetamol', 'morphine', 'fentanyl', 'ibuprofen'], label: 'Adequate analgesia (never withhold analgesia pending review)', withinMin: 30, points: 8 },
      { id: 'hcg', type: 'lab', item: 'hcg', label: 'Pregnancy test (beta-hCG) — mandatory in women of childbearing age', withinMin: 45, critical: true, points: 10 },
      { id: 'iv_fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'IV fluids for vomiting / mild dehydration', withinMin: 60, points: 5 },
      { id: 'antibiotics', type: 'drug', drugs: ['co-amoxiclav', 'metronidazole', 'ceftriaxone'], label: 'Antibiotics (if perforation suspected or pre-op cover)', withinMin: 90, points: 5 },
      { id: 'imaging', type: 'imaging', label: 'Diagnostic imaging (ultrasound or CT)', withinMin: 120, points: 6 },
      { id: 'surgical_review', type: 'procedure', label: 'Surgical review / referral for appendicectomy', withinMin: 150, critical: true, points: 12 },
      { id: 'surgery', type: 'procedure', label: 'Appendicectomy performed', withinMin: 300, critical: true, points: 12 },
      { id: 'admit', type: 'admit', label: 'Admit under surgical team', withinMin: 120, points: 4 }
    ],
    phases: [
      { id: 0, name: 'Early appendicitis', maxMin: 120, timeoutNext: 1, stabilizeNext: 'stable', description: 'Inflamed appendix, localised peritonism, manageable with surgery.' },
      { id: 1, name: 'Progressive appendicitis', maxMin: 180, timeoutNext: 2, description: 'Rising inflammatory markers, localised collection forming, tachycardia worsening.' },
      { id: 2, name: 'Perforation with early sepsis', maxMin: 240, timeoutNext: 3, description: 'Perforated appendix, abscess, systemic upset.' },
      { id: 3, name: 'Generalised peritonitis / severe sepsis', timeoutNext: 'death', description: 'Diffuse peritonitis, septic physiology.' },
      { id: 'stable', name: 'Post-appendicectomy recovery', recovery: true, vitals: { hr: 76, sbp: 116, dbp: 70, rr: 14, temp: 36.7, spo2: 99, gcs: 15, pain: 3 }, description: 'Laparoscopic appendicectomy completed. Comfortable on the ward, eating and drinking.' }
    ],
    interventions: {
      'paracetamol': { pain: -2 },
      'ibuprofen': { pain: -2 },
      morphine: { pain: -4 },
      fentanyl: { pain: -4 },
      'sodium chloride 0.9%': { sbp: 6, hr: -6 },
      'co-amoxiclav': { temp: -0.8, hr: -8 },
      metronidazole: { temp: -0.6, hr: -6 },
      ceftriaxone: { temp: -0.8, hr: -8 }
    },
    complications: [
      { id: 'perforation', name: 'Appendiceal perforation', trigger: { phase: 2, afterMin: 30 }, vitals: { hr: 128, sbp: 96, dbp: 58, rr: 26, temp: 38.9, spo2: 94, gcs: 14 }, description: 'Sudden increase in pain, then spreading tenderness across the whole abdomen. Rigors.' }
    ],
    rubric: {
      history: { points: 12, criteria: ['Pain migration from periumbilical to RIF', 'Anorexia and vomiting', 'Menstrual/pregnancy history in a woman', 'Urinary symptoms excluded'] },
      examination: { points: 10, criteria: ['Abdominal examination including RIF signs', 'Vital signs including temperature'] },
      investigations: { points: 12, criteria: ['Pregnancy test', 'FBC + CRP', 'Urinalysis', 'Imaging (US or CT)'] },
      diagnosis: { points: 12, criteria: ['Appendicitis identified', 'Ectopic pregnancy considered'] },
      management: { points: 18, criteria: ['Analgesia given early', 'IV fluids', 'Surgical referral', 'Appendicectomy'] },
      safety: { points: 8, criteria: ['No NSAID overdose', 'Safe prescribing', 'Consent considerations for surgery'] },
      communication: { points: 8, criteria: ['Explains likely diagnosis and plan', 'Addresses patient concerns'] },
      documentation: { points: 5, criteria: ['Clear surgical clerking note'] },
      timeliness: { points: 15, criteria: ['Analgesia within 30 minutes', 'Surgical review within 150 minutes'] }
    },
    debrief: {
      summary: 'Classic appendicitis presentation: periumbilical pain migrating to the right iliac fossa over 12-24 hours with anorexia, nausea and low-grade pyrexia. Never withhold analgesia while awaiting surgical review. In women of childbearing age, pregnancy must be excluded before imaging with radiation and before surgery planning.',
      learningPoints: [
        'Migratory pain plus anorexia has high positive predictive value for appendicitis.',
        'Alvarado (MANTRELS) score: Migration, Anorexia, Nausea, Tenderness RIF, Rebound, Elevated temp, Leukocytosis, Shift to left.',
        'Ultrasound is first-line in young women and children; CT has highest accuracy in adults.',
        'Analgesia does not mask peritonism — examination findings persist and pain relief improves diagnostic accuracy.',
        'Perforation risk rises sharply after 36 hours of symptoms — time is bowel.'
      ],
      references: ['WSES Jerusalem guidelines for diagnosis and treatment of acute appendicitis', 'NICE guideline NG80 — suspected appendicitis']
    },
    theatre: {
      procedure: 'Laparoscopic appendicectomy',
      anaesthesia: 'General anaesthesia with muscle relaxation; paracetamol + TAP block for postoperative analgesia',
      asa: 'ASA I (healthy 22-year-old)',
      risks: [
        'Bleeding',
        'Surgical site infection',
        'Stump leak with pelvic abscess',
        'Conversion to open appendicectomy (if appendix not accessible or perforation)',
        'Injury to bowel, bladder or iliac vessels during port insertion',
        'Port-site hernia',
        'Venous thromboembolism',
        'General anaesthetic risks',
        'Rarely, removal of a normal appendix (negative appendicectomy)'
      ],
      steps: [
        'WHO sign-in: identity, site, procedure, allergies, airway risk, blood loss plan',
        'Consent verified — including conversion to open and negative appendicectomy risk',
        'Prophylactic antibiotics given within 60 minutes of incision',
        'Time-out: team introductions, site marking, imaging displayed',
        'Induction of anaesthesia, stomach decompressed via NG if needed',
        'Pneumoperitoneum and primary port insertion (Hasson open technique reduces vascular injury)',
        'Secondary ports under direct vision',
        'Patient positioned head-down, left-tilt (appendix falls toward pelvis)',
        'Appendix identified and elevated',
        'Mesoappendix divided with sealant device or clips, controlling the appendicular artery',
        'Appendix base ligated with endoloop to the caecum',
        'Specimen removed in a retrieval bag',
        'If perforated: peritoneal lavage and suction of purulent fluid',
        'Ports removed under vision, abdomen deflated',
        'Port sites closed with local anaesthetic infiltration',
        'WHO sign-out: swab and instrument counts, specimen labelled, concerns for recovery'
      ]
    }
  }
},

// ═════════════════════════ CASE 3: ACUTE SEVERE ASTHMA ═════════════════════════
{
  key: 'asthma-19m-attack',
  title: 'Breathless and wheezy at 3 a.m.',
  specialty: 'respiratory-medicine',
  difficulty: 'undergraduate',
  scenario_type: 'emergency',
  description: 'A 19-year-old student arrives by ambulance with acute severe asthma after running out of inhalers during exam week. Nursing and medical management pathway.',
  scenario: {
    patient: { name: 'Tom Whitfield', age: 19, sex: 'M', occupation: 'Student', city: 'Northbridge' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Tom is sitting upright on the trolley, gripping the sides, using accessory muscles. He manages only 3-4 words between breaths. Ambulance crew gave 2 x salbutamol nebs en route.' },
    history: {
      complaint: 'Sudden severe breathlessness and wheeze',
      pmh: ['Asthma since age 7', 'Two previous ED attendances this year', 'One ICU admission aged 14'],
      meds: ['Salbutamol inhaler (ran out 4 days ago)', 'Seretide (combination) — stopped using to save money'],
      allergies: [{ drug: 'None known', reaction: 'n/a' }],
      family: ['Mother has asthma and eczema'],
      social: { smoking: 'Vapes socially', alcohol: 'Occasional', notes: 'Second-year law student; exam stress; part-time job cuts hours — could not afford inhalers this month.' }
    },
    emotions: { pain: 1, anxiety: 9, confusion: 0 },
    interview: [
      { tags: ['onset'], match: ['when','start','how long','begin'], a: '(Between breaths) Since... about two... this morning. Been wheezy... for days... worse tonight.' },
      { tags: ['trigger'], match: ['trigger','cause','why','provok','expose','cold','exercise'], a: 'Exam stress... and I ran out of... my blue inhaler... four days ago. Got worse... after walking to... the library in the cold.' },
      { tags: ['severity_breath'], match: ['breath','words','speak','talk','sentences'], a: 'Can\'t... finish a sentence. (Speaks in 3-4 words)' },
      { tags: ['previous_attacks'], match: ['before','previous','admission','icu','hospital','ever'], a: 'Yes... twice this year... and ICU... when I was fourteen. Scary... time.' },
      { tags: ['usual_control'], match: ['control','usual','normal','inhaler','preventer','regular'], a: 'Normally... brown and blue... inhalers. Stopped the preventer... to save money. Bad... I know.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills','taking'], a: 'Just inhalers... ran out. Nothing else... no steroids... tablets.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'No allergies... not that I know.' },
      { tags: ['smoking'], match: ['smoke','cigarette','vape','tobacco'], a: 'I vape... with friends. Never... cigarettes. (Wheeze)' },
      { tags: ['night_symptoms'], match: ['night','sleep','wake','nocturnal'], a: 'Woken by coughing... three nights... this week.' },
      { tags: ['chest_pain'], match: ['pain','chest','hurts','ache'], a: 'Chest feels... tight. Like a band... squeezing. Not sharp pain.' },
      { tags: ['cough'], match: ['cough','phlegm','sputum','mucus'], a: 'Dry cough... no phlegm... mostly at night.' },
      { tags: ['family'], match: ['family','mother','father','brother','sister','relatives'], a: 'Mum has asthma... and eczema too.' }
    ],
    exam: {
      general: 'Sitting upright, tripod position. Accessory muscle use. Unable to complete sentences. Tachypnoeic RR 30. Widespread polyphonic wheeze. Pulsus paradoxus present.',
      systems: {
        respiratory: 'RR 30, widespread wheeze throughout both lungs, reduced air entry at bases. Using accessory muscles. Tracheal tug present. SpO2 92% on air.',
        cardiovascular: 'Tachycardic 124/min, regular. Pulsus paradoxus ~15mmHg. BP 132/78.',
        neuro: 'GCS 15/15, exhausted but orientated. Agitated.',
        abdominal: 'Not examined — respiratory distress takes priority.'
      }
    },
    baselineVitals: { hr: 124, sbp: 132, dbp: 78, rr: 30, temp: 36.9, spo2: 92, gcs: 15, pain: 1 },
    labs: {
      baseline: { abg: 'pH 7.31, pCO2 6.8 kPa (rising — ominous), pO2 8.2 kPa, HCO3 24 — type 2 respiratory failure developing', vbg: 'pH 7.29, lactate 3.4 (beta-agonist effect)', k: 3.3, wcc: 9.8, hb: 148, na: 138, urea: 5.6, creatinine: 74, crp: 12 },
      phases: { 1: { abg: 'pH 7.25, pCO2 8.9 kPa, pO2 6.9 kPa — imminent respiratory arrest', k: 3.1, lactate: 4.8 } }
    },
    imaging: {
      cxr: { finding: 'Hyperinflated lungs, flattened diaphragms. No pneumothorax. No consolidation. Changes consistent with severe acute asthma.', phases: [0, 1] },
      ecg_12: { finding: 'Sinus tachycardia 124/min. Voltage criteria of hyperinflation. No ischaemic changes.', phases: [0, 1] },
      pft: { finding: 'PEF 28% predicted (<33% = acute severe; life-threatening features present). Not safely performable during acute attack — record after stabilisation.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Acute severe asthma (life-threatening features) with rising pCO2',
      aliases: ['asthma', 'attack', 'bronchospasm', 'acute severe asthma', 'life-threatening asthma'],
      differentials: [
        { dx: 'Acute severe asthma', why: 'Known asthma, wheeze, accessory muscle use, poor peak flow' },
        { dx: 'Anaphylaxis', why: 'Sudden onset with hypoxia — check for rash, exposure history' },
        { dx: 'Pneumothorax', why: 'Chest X-ray and examination exclude it' },
        { dx: 'Foreign body / inhaled', why: 'Sudden onset in younger patients' },
        { dx: 'Pulmonary embolism', why: 'Hypoxia without wheeze typically; no risk factors here' }
      ]
    },
    management: [
      { id: 'oxygen', type: 'oxygen', label: 'High-flow oxygen immediately (target SpO2 94-98%)', withinMin: 5, critical: true, points: 10 },
      { id: 'salbutamol', type: 'drug', drugs: ['salbutamol (nebulised)'], label: 'Nebulised salbutamol (oxygen-driven)', withinMin: 10, critical: true, points: 12 },
      { id: 'ipratropium', type: 'drug', drugs: ['ipratropium'], label: 'Nebulised ipratropium (add if severe)', withinMin: 20, points: 8 },
      { id: 'steroids', type: 'drug', drugs: ['prednisolone', 'hydrocortisone'], label: 'Systemic corticosteroids', withinMin: 25, critical: true, points: 10 },
      { id: 'monitor', type: 'procedure', label: 'Continuous SpO2 + cardiac monitoring, repeat ABG', withinMin: 30, points: 6 },
      { id: 'magnesium', type: 'drug', drugs: ['magnesium sulfate'], label: 'IV magnesium sulfate (if poor response)', withinMin: 45, points: 6 },
      { id: 'senior_help', type: 'procedure', label: 'Call for senior help / intensive care review', withinMin: 40, critical: true, points: 10 },
      { id: 'admit', type: 'admit', label: 'Admit to HDU/ICU-capable unit', withinMin: 120, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Acute severe attack', maxMin: 25, timeoutNext: 1, stabilizeNext: 'stable', description: 'Life-threatening asthma: silent chest developing, exhaustion, rising pCO2.' },
      { id: 1, name: 'Imminent respiratory arrest', maxMin: 15, timeoutNext: 'death', description: 'Exhaustion, bradycardia, falling SpO2. Needs intubation decision NOW.' },
      { id: 'stable', name: 'Stabilised', recovery: true, vitals: { hr: 96, sbp: 122, dbp: 74, rr: 20, temp: 36.8, spo2: 97, gcs: 15, pain: 1 }, description: 'After back-to-back nebs, steroids and magnesium, Tom is completing sentences. Peak flow 55% predicted.' }
    ],
    interventions: {
      oxygen: { spo2: 6, rr: -2 },
      'salbutamol (nebulised)': { rr: -6, spo2: 3, hr: 8 },
      ipratropium: { rr: -3, spo2: 2 },
      prednisolone: { rr: -2 },
      hydrocortisone: { rr: -2 },
      'magnesium sulfate': { rr: -4, hr: -10 }
    },
    complications: [
      { id: 'tension_pneumothorax', name: 'Tension pneumothorax', trigger: { phase: 1, afterMin: 6, chance: 0.4 }, vitals: { hr: 140, sbp: 74, dbp: 46, rr: 36, spo2: 78, gcs: 13 }, description: 'Sudden deterioration. Trachea deviated, absent breath sounds right side. Needs needle decompression.' }
    ],
    rubric: {
      history: { points: 8, criteria: ['Trigger identification (ran out of inhalers)', 'Previous ICU admission — red flag', 'Night symptoms suggesting poor control'] },
      examination: { points: 10, criteria: ['Assesses ability to speak (severity)', 'Respiratory examination', 'Recognises accessory muscle use'] },
      investigations: { points: 10, criteria: ['Peak flow (or notes it is unsafe)', 'Blood gas (ABG/VBG)', 'Chest X-ray'] },
      diagnosis: { points: 10, criteria: ['Recognises acute severe/life-threatening asthma', 'Recognises rising pCO2 as danger sign'] },
      management: { points: 20, criteria: ['Oxygen immediately', 'Nebulised salbutamol', 'Ipratropium', 'Systemic steroids', 'Senior/ICU involvement'] },
      safety: { points: 10, criteria: ['No sedatives given', 'Safe oxygen targets', 'Monitors for deterioration'] },
      communication: { points: 8, criteria: ['Calm reassurance to a terrified patient', 'Addresses preventer adherence for discharge planning'] },
      documentation: { points: 4, criteria: ['Documents severity classification and response'] },
      timeliness: { points: 20, criteria: ['Oxygen within 5 minutes', 'Nebulised bronchodilator within 10 minutes'] }
    },
    debrief: {
      summary: 'Acute severe asthma with life-threatening features (SpO2 <92%, speech in 3-4 words, RR >30, pulsus paradoxus). A normal or rising pCO2 is the single most ominous sign — the tiring asthmatic will arrest without support. Immediate oxygen-driven nebs, steroids and senior involvement are the core of management.',
      learningPoints: [
        'A normal pCO2 in an asthmatic in extremis is NOT reassuring — it signals exhaustion.',
        'Never sedate an asthmatic without airway support immediately available.',
        'Discharge planning starts at admission: preventer adherence, inhaler technique, follow-up, and addressing cost barriers — Tom stopped his preventer because he could not afford it.',
        'Salbutamol causes lactate elevation and hypokalaemia — check potassium.',
        'Two ICU-level attacks and repeat ED attendance = high-risk asthma needing specialist follow-up.'
      ],
      references: ['BTS/SIGN British Guideline on the Management of Asthma', 'Asthma attack management — ANZCOR guidelines']
    }
  }
},

// ═════════════════════════ CASE 4: DKA ═════════════════════════
{
  key: 'dka-24m-decompensation',
  title: 'Sweet breath, vomiting and confusion',
  specialty: 'endocrine (critical care)',
  difficulty: 'resident',
  scenario_type: 'critical-care',
  description: 'A 24-year-old with type 1 diabetes is brought in drowsy, vomiting and breathing deeply, 3 days after stopping insulin during a stomach upset.',
  scenario: {
    patient: { name: 'Leila Haddad', age: 24, sex: 'F', occupation: 'Nursery teacher', city: 'Cavaregio' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Leila is drowsy but rousable, breathing deeply and rapidly. Her breath smells distinctly of pear drops. Her mother says she has been vomiting for two days and "has not been herself".' },
    history: {
      complaint: 'Vomiting, abdominal pain, drowsiness — 3 days',
      pmh: ['Type 1 diabetes mellitus since age 9'],
      meds: ['Insulin glargine 18 units at night', 'Insulin aspart with meals (stopped 3 days ago)', 'Combined oral contraceptive'],
      allergies: [],
      family: ['Maternal aunt has type 1 diabetes'],
      social: { smoking: 'Never', alcohol: 'Rarely', notes: 'Lives with parents. Recent gastroenteritis — stopped insulin because she was not eating ("I did not want to go low").' }
    },
    emotions: { pain: 4, anxiety: 5, confusion: 6 },
    interview: [
      { tags: ['onset'], match: ['when','start','how long','begin'], a: '(Drowsy, slow answers) Three days... since the sickness bug... I felt so tired...' },
      { tags: ['insulin'], match: ['insulin','injection','stopped','taking insulin'], a: 'I stopped... my injections. Not eating... did not want... to go low. (This is the precipitant.)' },
      { tags: ['thirst_urine'], match: ['thirst','drink','thirsty','urine','wee','passing'], a: 'So thirsty... drinking litres... and the toilet... all night. (Polyuria, polydipsia)' },
      { tags: ['vomiting'], match: ['sick','vomit','nausea','throw'], a: 'Everything I drink... comes back up. Since yesterday... maybe ten times.' },
      { tags: ['abdominal_pain'], match: ['tummy','abdomen','stomach','pain','belly'], a: 'Aching all over my tummy... like cramps. (Diffuse abdominal pain of DKA)' },
      { tags: ['breathing'], match: ['breath','breathe','air','panting'], a: 'I cannot stop... breathing fast. It feels automatic... like my body is doing it. (Kussmaul breathing)' },
      { tags: ['weight'], match: ['weight','lost','lighter','clothes'], a: 'My jeans are loose... lost weight this month... I think about four kilos.' },
      { tags: ['fever_infection'], match: ['fever','temperature','infection','cough','burning','unwell','flu'], a: 'Started with a sickness bug... my whole family had it. No cough... no burning when I pee.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills'], a: 'Just insulin... and the pill. No other... tablets.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'No... allergies.' },
      { tags: ['previous_dka'], match: ['before','previous','dka','admission','ever','last time'], a: 'Once before... when I was sixteen. They said... ketones. I remember the drip.' }
    ],
    exam: {
      general: 'Drowsy (GCS 13), dehydrated — dry mucous membranes, reduced skin turgor, sunken eyes. Kussmaul respiration. Breath smells of acetone (pear drops).',
      systems: {
        cardiovascular: 'Tachycardic 128/min, BP 92/58 (lying). Capillary refill 4s. JVP flat.',
        respiratory: 'Kussmaul breathing RR 28 — deep, sighing, laboured. Chest clear.',
        abdominal: 'Diffuse tenderness, no guarding, no rebound. Bowel sounds reduced. (DKA can mimic an acute abdomen.)',
        neuro: 'GCS 13/15 (E3V4M6). Pupils reactive. No focal signs.'
      }
    },
    baselineVitals: { hr: 128, sbp: 92, dbp: 58, rr: 28, temp: 36.5, spo2: 98, gcs: 13, pain: 4 },
    labs: {
      baseline: { glucose: 32.8, abg: 'pH 7.08, pCO2 2.1 kPa, pO2 14.1, HCO3 6 mmol/L, base excess -22, anion gap 27 — severe metabolic acidosis with respiratory compensation', vbg: 'Same acidosis; lactate 2.8', na: 130, k: 5.6, urea: 14.8, creatinine: 112, egfr: 58, wcc: 17.4, hb: 138, crp: 21, 'k': 5.6 },
      phases: { 1: { glucose: 26.4, abg: 'pH 7.18, HCO3 11 — improving with treatment', k: 4.4 }, 2: { glucose: 19.2, abg: 'pH 7.28, HCO3 15', k: 3.6, creatinine: 96 } }
    },
    imaging: {
      ecg_12: { finding: 'Sinus tachycardia 128/min. Peaked T waves (hyperkalaemia). No ischaemic changes.', phases: [0, 1, 2] },
      cxr: { finding: 'Clear lung fields. No consolidation. (Performed to exclude aspiration given vomiting and drowsiness.)', phases: [0, 1, 2] },
      ct_head: { finding: 'Normal — no cerebral oedema. (Only indicated if consciousness fails to improve or deteriorates on treatment.)', phases: [0, 1, 2] }
    },
    hidden: {
      diagnosis: 'Diabetic ketoacidosis (DKA) precipitated by insulin omission during gastroenteritis',
      aliases: ['dka', 'ketoacid', 'diabetic keto', 'ketones'],
      differentials: [
        { dx: 'DKA', why: 'T1DM, insulin stopped, Kussmaul breathing, glucose >30, acidosis' },
        { dx: 'Hyperosmolar hyperglycaemic state (HHS)', why: 'Usually older T2DM, glucose >50, less acidosis, profound dehydration' },
        { dx: 'Sepsis with metabolic acidosis', why: 'Vomiting illness, tachycardia — cultures needed; lactate mild here' },
        { dx: 'Acute abdomen with vomiting', why: 'Diffuse abdominal pain — DKA frequently mimics surgical abdomen' },
        { dx: 'Ingestion (salicylate/toxic alcohol)', why: 'High anion gap acidosis — toxicology screen if history unclear' }
      ]
    },
    management: [
      { id: 'airway_monitor', type: 'procedure', label: 'Airway assessment + continuous monitoring (1-2 hourly GCS)', withinMin: 15, points: 6 },
      { id: 'fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'IV fluid resuscitation — 1L 0.9% NaCl over first hour', withinMin: 20, critical: true, points: 12 },
      { id: 'potassium_check', type: 'lab', item: 'k', label: 'Check potassium BEFORE insulin infusion (replace if 3.5-5.5)', withinMin: 30, critical: true, points: 10 },
      { id: 'insulin', type: 'drug', drugs: ['insulin (rapid-acting)'], label: 'Fixed-rate IV insulin infusion 0.1 units/kg/h', withinMin: 40, critical: true, points: 12 },
      { id: 'ketone_glucose_monitor', type: 'procedure', label: 'Hourly capillary glucose + ketone monitoring', withinMin: 60, points: 6 },
      { id: 'long_acting', type: 'drug', drugs: ['insulin (long-acting)'], label: 'Continue/overlap long-acting insulin', withinMin: 180, points: 5 },
      { id: 'admit', type: 'admit', label: 'Admit to HDU/ICU-capable unit', withinMin: 150, points: 5 },
      { id: 'education', type: 'procedure', label: 'Sick-day rules education before discharge', withinMin: 600, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Severe DKA', maxMin: 60, timeoutNext: 1, stabilizeNext: 1, description: 'pH 7.08, GCS 13, dehydrated. Needs fluids + insulin urgently.' },
      { id: 1, name: 'Treatment underway — resolving ketosis', maxMin: 240, timeoutNext: 2, stabilizeNext: 2, description: 'With correct treatment: glucose falling, ketones clearing, GCS improving. Watch potassium.' },
      { id: 2, name: 'Recovery phase', maxMin: 360, timeoutNext: 3, description: 'Eating and drinking, converting to subcutaneous insulin.' },
      { id: 3, name: 'Discharge ready', recovery: true, vitals: { hr: 84, sbp: 112, dbp: 70, rr: 14, temp: 36.7, spo2: 99, gcs: 15, pain: 1 }, description: 'Leila is well, eating, ketones negative, education completed.' },
      { id: 'death', name: 'Cerebral oedema / untreated acidosis', death: true, description: 'Rare but fatal complication — particularly if fluids are given too rapidly or sodium falls fast.' }
    ],
    interventions: {
      'sodium chloride 0.9%': { sbp: 14, hr: -14 },
      'insulin (rapid-acting)': { glucose: -6, k: -0.6 },
      'insulin (long-acting)': { glucose: -1 },
      'potassium chloride': { k: 1.2 }
    },
    complications: [
      { id: 'hypoglycaemia', name: 'Hypoglycaemia (glucose <4)', trigger: { phase: 1, afterMin: 90, ifOverTreated: true }, vitals: { hr: 110, sbp: 104, gcs: 12 }, description: 'Sweating, confusion returns. Glucose 2.8. Reduce insulin rate / give glucose.' },
      { id: 'hypokalaemia', name: 'Hypokalaemia (K <2.8)', trigger: { phase: 1, afterMin: 120, ifNotDone: ['potassium_check'] }, vitals: { hr: 132, spo2: 96 }, description: 'Insulin driving potassium into cells without replacement — peaked T waves flatten, U waves appear, arrhythmia risk.' },
      { id: 'cerebral_oedema', name: 'Cerebral oedema', trigger: { phase: 1, afterMin: 150, chance: 0.25 }, vitals: { gcs: 9, hr: 52, sbp: 168 }, description: 'Headache, falling GCS, bradycardia with hypertension. Paediatric/young adult risk — reduce fluids, call ICU.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Identifies insulin omission as precipitant', 'Polyuria/polydipsia', 'Weight loss'] },
      examination: { points: 10, criteria: ['Assesses dehydration', 'Recognises Kussmaul breathing', 'GCS documentation'] },
      investigations: { points: 14, criteria: ['Blood gas', 'Glucose', 'U&E including potassium', 'Ketones (blood/urine)', 'FBC + infection screen'] },
      diagnosis: { points: 10, criteria: ['DKA identified', 'Precipitant (insulin omission) identified'] },
      management: { points: 22, criteria: ['Fluids first', 'Fixed-rate insulin infusion', 'Potassium replacement', 'Long-acting insulin overlap', 'Admission level decision'] },
      safety: { points: 12, criteria: ['No insulin bolus without potassium check', 'Monitors for hypoglycaemia/cerebral oedema', 'Safe fluid rates'] },
      communication: { points: 8, criteria: ['Involves family', 'Explains sick-day rules'] },
      documentation: { points: 4, criteria: ['Fluid balance chart', 'Insulin chart'] },
      timeliness: { points: 10, criteria: ['Fluids within 20 minutes', 'Insulin within 40 minutes'] }
    },
    debrief: {
      summary: 'Severe DKA (pH 7.08, bicarbonate 6, glucose 32.8) precipitated by stopping insulin during gastroenteritis. Management sequence: airway/monitoring → IV fluids (0.9% NaCl 1L in first hour) → check potassium → fixed-rate IV insulin 0.1 u/kg/h → hourly glucose/ketone monitoring → overlap long-acting insulin before conversion.',
      learningPoints: [
        'NEVER omit insulin during illness — "sick day rules": never stop insulin, add quick-acting correction, monitor 2-hourly.',
        'Check potassium before insulin: insulin drives K+ intracellularly — hypokalaemia kills.',
        'Fluids before insulin: restore circulating volume first.',
        'Cerebral oedema is the commonest cause of death in young patients — falling GCS during treatment is an emergency.',
        'DKA abdominal pain can mimic peritonism — treat the ketoacidosis before calling the surgeons.',
        'The anion gap distinguishes DKA from other acidoses; always screen for precipitants (infection, MI, omission).'
      ],
      references: ['JBDS-IP guideline: The management of diabetic ketoacidosis in adults', 'ADA consensus on DKA management']
    }
  }
}
];

module.exports = { CASES_PART1 };
