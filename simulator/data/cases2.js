// Medic1905 clinical case library — Part 2.

const CASES_PART2 = [

// ═════════════════════════ CASE 5: PAEDIATRIC MENINGITIS ═════════════════════════
{
  key: 'meningitis-5f-fever',
  title: 'Fever, headache and a stiff neck in a 5-year-old',
  specialty: 'paediatrics',
  difficulty: 'resident',
  scenario_type: 'paediatric',
  description: 'A 5-year-old girl is brought to the ED by her father with fever, headache, vomiting and increasing drowsiness. She did not receive her routine vaccinations.',
  scenario: {
    patient: { name: 'Sofia Lindqvist', age: 5, sex: 'F', occupation: 'Kindergarten pupil', city: 'Greenhills' },
    presentation: { setting: 'Emergency & Trauma Department (paediatric area)', triage: 'category 1-2', initial: 'Sofia is carried in by her father, wrapped in a blanket. She is drowsy, does not want to be put down, and cries when moved. Father: "She has had a fever for two days, and this morning she would not wake up properly."' },
    history: {
      complaint: 'Fever, headache, vomiting and drowsiness for 2 days',
      pmh: ['Born at term, normal delivery', 'Not vaccinated — family choice'],
      meds: ['Paracetamol syrup (given at home)'],
      allergies: [],
      family: ['Two older siblings, both well. Recently one sibling had a mild viral illness.'],
      social: { notes: 'Father brought her; mother at home with the other children. No travel history. No sick contacts beyond sibling cold.' }
    },
    emotions: { pain: 6, anxiety: 7, confusion: 5, paediatric_parent: true },
    interview: [
      { tags: ['onset_parent'], match: ['when','start','how long','begin'], a: '(Father) It started two days ago with a fever. Yesterday she complained her head hurt and was sick twice. This morning she was really hard to wake.', speaker: 'father' },
      { tags: ['fever_parent'], match: ['fever','temperature','hot'], a: '(Father) Very hot — 39 point something at home. Paracetamol brought it down for a couple of hours, then it climbed again.', speaker: 'father' },
      { tags: ['rash_parent'], match: ['rash','spots','bruise','purple','mark'], a: '(Father) I did not see any rash. I checked all over because my sister said to look for the glass test — nothing like that. (Important: absence of rash does NOT exclude meningitis.)', speaker: 'father' },
      { tags: ['neck_parent'], match: ['neck','stiff','light','photophobia'], a: '(Father) She keeps her head very still. When I tried to lift her she screamed. She has been shielding her eyes from the lights this morning.', speaker: 'father' },
      { tags: ['vomit_parent'], match: ['sick','vomit','throw'], a: '(Father) She has been sick maybe five or six times since yesterday — not keeping anything down.', speaker: 'father' },
      { tags: ['drinking_parent'], match: ['drink','drinking','wet nappy','urine','fluids','eating'], a: '(Father) She has hardly drunk anything today. Last wet nappy was... this morning? Maybe eight hours ago.', speaker: 'father' },
      { tags: ['behaviour_parent'], match: ['drowsy','sleepy','listless','unusual','irritable','cry'], a: '(Father) She is not herself at all — floppy then stiff, crying when touched, then drifting off. She does not even want her rabbit.', speaker: 'father' },
      { tags: ['vaccines_parent'], match: ['vaccin','immunis','jab','mmr'], a: '(Father, hesitates) We chose not to vaccinate. It was a family decision. Is... is that why she is sick?', speaker: 'father' },
      { tags: ['contacts_parent'], match: ['brother','sister','school','contact','others sick','kindergarten'], a: '(Father) Her brother had a runny nose last week, nothing like this. Nobody at kindergarten that I know of.', speaker: 'father' },
      { tags: ['fit_parent'], match: ['fit','seizure','convulsion','shake','jerking'], a: '(Father) No fits. Her eyes did roll a little when I picked her up just now — is that a fit?', speaker: 'father' }
    ],
    exam: {
      general: 'Ill-looking, drowsy (GCS equivalent 12), lying still. Refuses to be examined. High fever 39.4°C. No rash at present.',
      systems: {
        neuro: 'Meningism: neck stiffness positive, photophobia, Kernig\'s sign positive. GCS 12/15 (E3V3M6). No focal neurology. No papilloedema on fundoscopy.',
        cardiovascular: 'Tachycardic 148/min. CRT 4s. BP 82/48 (low-normal for age). Mottled peripheries — compensated shock.',
        respiratory: 'RR 34 — tachypnoea, clear chest.',
        abdominal: 'Soft, non-tender. No organomegaly.',
        ent: 'Tympanic membranes normal, throat mildly red. No petechiae in mouth.'
      }
    },
    baselineVitals: { hr: 148, sbp: 82, dbp: 48, rr: 34, temp: 39.4, spo2: 94, gcs: 12, pain: 6 },
    labs: {
      baseline: { wcc: 22.6, hb: 116, platelets: 312, crp: 168, na: 131, k: 4.4, urea: 8.9, creatinine: 34, glucose: 4.8, csf: 'Appearance: turbid. WCC 1850/uL (92% neutrophils). Protein 1.8 g/L (raised). Glucose 1.1 mmol/L (CSF:plasma ratio 0.23 — low). Gram stain: Gram-negative diplococci. Consistent with meningococcal meningitis.', csf_culture: 'Neisseria meningitidis serogroup B — sensitive to ceftriaxone', bculture: 'Pending at 48h (will grow N. meningitidis)', 'group_save': 'Group O RhD positive' },
      phases: { 1: { wcc: 24.1, crp: 210, lactate: 3.8 } }
    },
    imaging: {
      ct_head: { finding: 'No cerebral oedema, no infarct, no hydrocephalus. Normal study — CT not required before LP if no focal signs/seizures; performed here only because of clinical uncertainty.', phases: [0, 1] },
      cxr: { finding: 'Clear. No consolidation. (Performed as part of septic screen.)', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Bacterial meningitis (meningococcal — Neisseria meningitidis)',
      aliases: ['mening', 'meningococ', 'bacterial meningitis', 'n. meningitidis', 'meningococc'],
      differentials: [
        { dx: 'Bacterial meningitis', why: 'Fever, meningism, drowsiness, high inflammatory markers, CSF neutrophils' },
        { dx: 'Viral meningitis/encephalitis', why: 'Usually milder; CSF lymphocytic — cannot distinguish clinically at presentation' },
        { dx: 'Meningococcal septicaemia', why: 'Rash may appear later — serial skin checks are essential' },
        { dx: 'Subarachnoid haemorrhage', why: 'Thunderclap headache, older patients typically' },
        { dx: 'Febrile convulsion / simple viral illness', why: 'Excluded by meningism and reduced GCS' }
      ]
    },
    management: [
      { id: 'abc_resus', type: 'procedure', label: 'ABC assessment + fluid bolus for shock (20mL/kg 0.9% NaCl)', withinMin: 15, critical: true, points: 10 },
      { id: 'bloods_cultures', type: 'lab', label: 'Bloods + blood cultures before antibiotics (if not delaying >30 min)', withinMin: 30, points: 6 },
      { id: 'antibiotics', type: 'drug', drugs: ['ceftriaxone', 'benzylpenicillin'], label: 'IV antibiotics — do NOT delay for LP/imaging', withinMin: 45, critical: true, points: 15 },
      { id: 'lp', type: 'procedure', label: 'Lumbar puncture (after antibiotics if necessary — never delay antibiotics)', withinMin: 120, points: 8 },
      { id: 'dexamethasone', type: 'drug', drugs: ['hydrocortisone'], label: 'Adjunctive corticosteroid debate in children — consider dexamethasone (note: hydrocortisone shown for shock)', withinMin: 90, points: 4 },
      { id: 'isolation', type: 'procedure', label: 'Isolate + notify public health + prophylaxis for contacts', withinMin: 180, points: 8 },
      { id: 'admit_picu', type: 'admit', label: 'Admit to PICU/high dependency', withinMin: 120, critical: true, points: 8 },
      { id: 'family_communication', type: 'procedure', label: 'Communicate honestly with father (including vaccination discussion)', withinMin: 240, points: 6 }
    ],
    phases: [
      { id: 0, name: 'Presentation with meningism + compensated shock', maxMin: 45, timeoutNext: 1, stabilizeNext: 1, description: 'Drowsy, tachycardic, mottled. The clock is ticking — antibiotics within the first hour save lives.' },
      { id: 1, name: 'Treatment phase', maxMin: 360, timeoutNext: 2, description: 'On antibiotics: fever trend improving if treated promptly; watch for rash, seizures, SIADH.' },
      { id: 2, name: 'Complicated course', maxMin: 720, timeoutNext: 3, description: 'Delayed treatment leads to complications: seizures, SIADH, hearing loss risk.' },
      { id: 3, name: 'Recovery with sequelae', recovery: true, vitals: { hr: 104, sbp: 96, dbp: 60, rr: 22, temp: 37.4, spo2: 98, gcs: 15, pain: 2 }, description: 'Afebrile, alert, drinking. Audiology follow-up arranged — the family understands what happened and why.' },
      { id: 'death', name: 'Death from untreated meningococcal disease', death: true, description: 'Meningococcal disease progresses within hours. Delayed antibiotics are the modifiable factor.' }
    ],
    interventions: {
      'sodium chloride 0.9%': { sbp: 10, hr: -16 },
      ceftriaxone: { temp: -1.2, hr: -18 },
      'benzylpenicillin': { temp: -1.2, hr: -18 },
      paracetamol: { temp: -0.9 },
      'potassium chloride': { k: 1.0 }
    },
    complications: [
      { id: 'septic_shock', name: 'Deterioration into meningococcal septicaemia', trigger: { phase: 0, afterMin: 45, ifNotDone: ['antibiotics'] }, vitals: { hr: 176, sbp: 58, dbp: 34, rr: 42, temp: 39.9, spo2: 88, gcs: 8 }, description: 'A petechial rash is spreading over her limbs. She is in decompensated shock. DIC developing.' },
      { id: 'seizure', name: 'Seizure', trigger: { phase: 1, afterMin: 120, chance: 0.35 }, vitals: { gcs: 7, spo2: 90 }, description: 'Generalised tonic-clonic seizure — needs airway positioning, oxygen, benzodiazepine, and glucose check.' },
      { id: 'siadh', name: 'SIADH / hyponatraemia', trigger: { phase: 2, afterMin: 240, chance: 0.4 }, description: 'Na falls to 126 — risk of seizures. Fluid restriction and monitoring needed.' }
    ],
    rubric: {
      history: { points: 8, criteria: ['Onset and progression clarified with parent', 'Rash sought (and absence documented)', 'Vaccination history taken sensitively', 'Fluid intake/urine output assessed'] },
      examination: { points: 10, criteria: ['Meningism assessed', 'GCS documented', 'Shock signs recognised (CRT, mottling)', 'Serial skin examination'] },
      investigations: { points: 14, criteria: ['Blood cultures', 'FBC/CRP', 'LP with CSF analysis', 'Appropriate septic screen'] },
      diagnosis: { points: 10, criteria: ['Bacterial meningitis suspected early', 'Septicaemia risk recognised'] },
      management: { points: 24, criteria: ['Fluid bolus for shock', 'Antibiotics within 45 min (ideally <60 from arrival)', 'LP timing decision (after antibiotics acceptable)', 'PICU admission', 'Public health notification'] },
      safety: { points: 12, criteria: ['No unnecessary delay of antibiotics for imaging', 'Safe pediatric fluid volumes', 'Correct antibiotic dosing'] },
      communication: { points: 10, criteria: ['Compassionate communication with father', 'Non-judgemental approach to vaccination status'] },
      documentation: { points: 4, criteria: ['Paediatric assessment triangle / weight documented'] },
      timeliness: { points: 8, criteria: ['Antibiotics within 45 minutes of arrival'] }
    },
    debrief: {
      summary: 'Meningococcal meningitis in an unvaccinated 5-year-old, presenting with fever, meningism and compensated shock. The decisive intervention is early IV antibiotics — ideally within 60 minutes of arrival — with blood cultures first only if they do not delay treatment. LP can safely follow antibiotics.',
      learningPoints: [
        'In suspected bacterial meningitis: antibiotics first, lumbar puncture later if needed.',
        'Absence of a rash never excludes meningococcal disease — check the skin every 30-60 minutes.',
        'Compensated shock in children: tachycardia and mottling precede hypotension. BP falling is a late, pre-arrest sign.',
        'Fluid boluses (20mL/kg) are appropriate in meningococcal shock — do not under-resuscitate for fear of cerebral oedema.',
        'Notify public health: household contacts need prophylactic antibiotics and vaccination advice.',
        'Vaccination conversations work best without judgement — this family needs facts and support, not shame.'
      ],
      references: ['NICE guideline CG102 — bacterial meningitis and meningococcal septicaemia in children', 'WHO — Managing meningitis in children']
    }
  }
},

// ═════════════════════════ CASE 6: PRE-ECLAMPSIA ═════════════════════════
{
  key: 'preeclampsia-31f-34w',
  title: 'Swollen ankles and a headache at 34 weeks',
  specialty: 'obstetrics',
  difficulty: 'resident',
  scenario_type: 'obstetric',
  description: 'A 31-year-old primigravida at 34 weeks attends the maternity assessment unit with headache, visual disturbance, swelling and rapidly rising blood pressure.',
  scenario: {
    patient: { name: 'Grace Adeyemi', age: 31, sex: 'F', occupation: 'Accountant', city: 'Grandvale' },
    presentation: { setting: 'Maternity Assessment Unit', triage: 'category 2', initial: 'Grace arrives holding her partner\'s arm. Her face is puffy and she keeps closing her left eye. Midwife: "BP 168/112, dipstick protein 2+. She has a frontal headache and says the lights look funny."' },
    history: {
      complaint: 'Headache, flashing lights and swelling — 2 days',
      pmh: ['First pregnancy (primigravida)', 'Booking BP 118/72', 'Antenatal scans normal', 'No previous medical problems'],
      meds: ['Folic acid 400mcg', 'Ferrous sulfate (mild anaemia at booking)'],
      allergies: [],
      family: ['Mother had pre-eclampsia in two pregnancies', 'Sister had pre-eclampsia at 36 weeks'],
      social: { smoking: 'Never', alcohol: 'Stopped since pregnancy', notes: 'Works long hours at an accounting firm. Partner Daniel present. 34+2 weeks gestation by dating scan.' }
    },
    emotions: { pain: 5, anxiety: 9, confusion: 0 },
    interview: [
      { tags: ['onset'], match: ['when','start','how long','begin'], a: 'The headache started two days ago. This morning the flashing lights began — like shimmering zigzags. And my rings will not go on.' },
      { tags: ['headache'], match: ['headache','head','pain','frontal'], a: 'It is at the front, throbbing, and paracetamol has not touched it. It is different from any headache I have had.' },
      { tags: ['visual'], match: ['see','vision','visual','flashing','lights','blur','zigzag'], a: 'Flashing zigzags in both eyes, mostly on the left. My vision went blurry for a minute this afternoon. It frightened me.' },
      { tags: ['oedema'], match: ['swell','swelling','ankles','feet','hands','puffy','rings'], a: 'My ankles, feet and fingers are all swollen — it has crept up over three days. My face too, my sister said I look different.' },
      { tags: ['bp_history'], match: ['blood pressure','bp','hypertension','pressure'], a: 'At every appointment it was fine until last week — 138/88. Today the midwife said 168 over something.' },
      { tags: ['reflux_pain'], match: ['indigestion','burning','epigastric','upper tummy','chest pain','reflux'], a: 'Now you mention it — a nagging pain just under my ribs on the right. I thought it was the baby kicking up high or indigestion.' },
      { tags: ['fetal'], match: ['baby','movements','kicks','movin'], a: 'The baby has been quieter today. Usually she is very active in the evenings. I have felt maybe half of what is normal.' },
      { tags: ['urinary'], match: ['urine','wee','protein','dipstick','burning'], a: 'Passing urine normally, no burning. The midwife said there was protein in my sample today — there was none last week.' },
      { tags: ['weight'], match: ['weight','gained','gain'], a: 'I gained two and a half kilos in a week. The midwife\'s face said everything.' },
      { tags: ['pmh'], match: ['medical history','past','problems','illness'], a: 'Nothing — I have always been healthy. First pregnancy, conceived naturally, no IVF.' },
      { tags: ['family'], match: ['family','mother','sister','relatives'], a: 'My mother had pre-eclampsia with two of her pregnancies. My sister too, at 36 weeks. Is that relevant?' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills'], a: 'Folic acid and iron tablets. Nothing else, no painkillers except paracetamol.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'No allergies.' },
      { tags: ['contractions'], match: ['contraction','labour','tighten','pain coming and going'], a: 'No contractions. No bleeding, no fluid leaking. Just the headache, the lights and this swelling.' }
    ],
    exam: {
      general: 'Alert but anxious. Facial and hand oedema. BP 168/112 (repeat 172/114). Hyperreflexia with 3 beats of clonus. Proteinuria 2+.',
      systems: {
        cardiovascular: 'BP 172/114 (severe range). Pulse 96 regular. No murmurs. Oedema to mid-calf + hands + face.',
        respiratory: 'Clear. No basal crepitations (no pulmonary oedema yet).',
        abdominal: 'Fundus 34cm, consistent with dates. Soft, non-tender apart from mild right upper quadrant tenderness. CTG reactive with reduced variability.',
        neuro: 'Brisk reflexes (3+) with clonus. No focal deficits. Visual acuity reduced left eye; fundoscopy normal.',
        obstetric: 'Cephalic presentation, 3/5 palpable. Cervix closed and uneffaced.'
      }
    },
    baselineVitals: { hr: 96, sbp: 172, dbp: 114, rr: 18, temp: 36.6, spo2: 98, gcs: 15, pain: 5 },
    labs: {
      baseline: { hb: 108, platelets: 96, wcc: 10.2, na: 134, k: 4.6, urea: 4.8, creatinine: 84, alt: 88, ast: 94, alp: '210 (upper limit of normal in pregnancy ~300)', bilirubin: 14, albumin: 28, urinalysis: 'Protein 2+, no blood, no nitrites, no leucocytes', 'beta_hcg_quant': 'n/a — 34+2 weeks gestation', uric_acid_note: 'Urate 0.42 (elevated)', ldh_note: 'LDH 480 (elevated — haemolysis)', 'group_save': 'Group O RhD positive, antibody screen negative' },
      phases: { 1: { platelets: 78, alt: 160, ast: 178, creatinine: 108 } }
    },
    imaging: {
      us_obs: { finding: 'Single viable fetus, cephalic, EFW 2.1kg (25th centile), normal liquor, umbilical artery Doppler normal. Biophysical profile 8/10.', phases: [0, 1] },
      ctg: { finding: 'CTG: baseline 150, reduced variability, occasional late decelerations. Pathological trace consistent with placental insufficiency.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Severe pre-eclampsia with features of HELLP syndrome',
      aliases: ['pre-eclamp', 'preeclamp', 'hellp', 'toxaemia', 'toxemia'],
      differentials: [
        { dx: 'Pre-eclampsia (severe, with HELLP features)', why: 'Hypertension + proteinuria + hyperreflexia + right upper quadrant pain + falling platelets' },
        { dx: 'Chronic hypertension', why: 'Excluded by normal booking BP' },
        { dx: 'Gestational hypertension', why: 'No proteinuria or features of end-organ damage' },
        { dx: 'Migraine with aura', why: 'Visual disturbance but pregnancy + hypertension + proteinuria point elsewhere' },
        { dx: 'Eclampsia', why: 'The next step if untreated — no seizures yet' }
      ]
    },
    management: [
      { id: 'bp_control', type: 'drug', drugs: ['labetalol', 'nifedipine', 'hydralazine'], label: 'Antihypertensive therapy (severe range BP)', withinMin: 30, critical: true, points: 12 },
      { id: 'magnesium', type: 'drug', drugs: ['magnesium sulfate'], label: 'Magnesium sulfate for seizure prophylaxis', withinMin: 45, critical: true, points: 12 },
      { id: 'bloods', type: 'lab', label: 'Full bloods: FBC, U&E, LFT, coagulation, group & save (HELLP work-up)', withinMin: 30, points: 8 },
      { id: 'steroids', type: 'drug', drugs: ['hydrocortisone'], label: 'Corticosteroids for fetal lung maturation (betamethasone/dexamethasone — any corticosteroid accepted in simulation)', withinMin: 120, points: 6 },
      { id: 'ctg_monitor', type: 'procedure', label: 'Continuous CTG fetal monitoring', withinMin: 30, points: 6 },
      { id: 'senior_review', type: 'procedure', label: 'Senior obstetric review + decision for delivery', withinMin: 90, critical: true, points: 12 },
      { id: 'delivery', type: 'procedure', label: 'Delivery planning (induction/caesarean) — the only cure', withinMin: 300, critical: true, points: 10 },
      { id: 'admit', type: 'admit', label: 'Admit to maternity HDU', withinMin: 60, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Severe pre-eclampsia', maxMin: 90, timeoutNext: 1, stabilizeNext: 1, description: 'Severe-range BP with neurological features and proteinuria. Seizure risk is now.' },
      { id: 1, name: 'Evolving HELLP / worsening disease', maxMin: 240, timeoutNext: 2, description: 'Platelets falling, LFTs climbing, BP difficult to control, CTG worsening.' },
      { id: 2, name: 'Critical', maxMin: 120, timeoutNext: 'eclampsia', description: 'Imminent eclampsia. Delivery cannot wait.' },
      { id: 'eclampsia', name: 'Eclamptic seizure', death: false, critical_event: true, description: 'Generalised tonic-clonic seizure. Airway, oxygen, magnesium bolus, delivery.' },
      { id: 'stable', name: 'Post-delivery stabilisation', recovery: true, vitals: { hr: 84, sbp: 138, dbp: 88, rr: 16, temp: 36.8, spo2: 98, gcs: 15, pain: 3 }, description: 'Delivered by caesarean at 34+3. Baby in NICU doing well. BP settling on oral nifedipine. Magnesium continued 24h postpartum.' }
    ],
    interventions: {
      labetalol: { sbp: -22, dbp: -14, hr: -10 },
      nifedipine: { sbp: -20, dbp: -12 },
      hydralazine: { sbp: -24, dbp: -14, hr: 8 },
      'magnesium sulfate': { sbp: -6 }
    },
    complications: [
      { id: 'eclampsia', name: 'Eclamptic seizure', trigger: { phase: 1, afterMin: 60, ifNotDone: ['magnesium'] }, vitals: { gcs: 3, sbp: 190, dbp: 125, spo2: 84 }, description: 'Sudden tonic-clonic seizure. Airway at risk. Magnesium bolus NOW. This is why prophylaxis matters.' },
      { id: 'placental_abruption', name: 'Placental abruption', trigger: { phase: 2, afterMin: 40, chance: 0.3 }, description: 'Severe abdominal pain, hard woody uterus, dark vaginal bleeding, fetal bradycardia on CTG. Immediate delivery — caesarean.' },
      { id: 'pulmonary_oedema', name: 'Pulmonary oedema', trigger: { phase: 1, afterMin: 150, ifOverTreated: true }, vitals: { rr: 30, spo2: 88 }, description: 'Fluid overload in pre-eclampsia — capillary leak plus aggressive fluids. Sit up, oxygen, furosemide.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Headache and visual symptoms characterised', 'Family history of pre-eclampsia', 'Right upper quadrant pain sought (HELLP)', 'Fetal movements assessed'] },
      examination: { points: 10, criteria: ['Repeat BP measurement', 'Reflexes/clonus assessed', 'Oedema documented', 'Abdominal and obstetric examination'] },
      investigations: { points: 12, criteria: ['Urine protein quantification', 'FBC with platelets', 'LFTs', 'Coagulation', 'Fetal wellbeing assessment'] },
      diagnosis: { points: 10, criteria: ['Severe pre-eclampsia identified', 'HELLP features recognised'] },
      management: { points: 22, criteria: ['Antihypertensives for severe BP', 'Magnesium prophylaxis', 'Steroids for fetal lungs', 'Senior review and delivery decision', 'Admission level appropriate'] },
      safety: { points: 12, criteria: ['Correct drug choices in pregnancy', 'Fluid restriction respected', 'No ACE inhibitors/ARBs given (fetotoxic)'] },
      communication: { points: 8, criteria: ['Explains plan to patient and partner', 'Balances maternal and fetal priorities in discussion'] },
      documentation: { points: 4, criteria: ['Partogram/CTG findings documented'] },
      timeliness: { points: 12, criteria: ['Antihypertensive within 30 minutes', 'Magnesium within 45 minutes'] }
    },
    debrief: {
      summary: 'Severe pre-eclampsia at 34+2 weeks with evolving HELLP syndrome. Treatment: antihypertensives for severe-range BP, magnesium sulfate for seizure prophylaxis, corticosteroids for fetal lung maturity, and delivery — the only definitive treatment — once maternal stabilisation allows.',
      learningPoints: [
        'Pre-eclampsia is a multi-system disease: hypertension is only the most visible sign. Platelets, LFTs, creatinine and fetal wellbeing complete the picture.',
        'Right upper quadrant pain + falling platelets + deranged LFTs = HELLP until proven otherwise.',
        'Magnesium sulfate prevents eclamptic seizures and is given at severe-range BP with features.',
        'ACE inhibitors and ARBs are contraindicated in pregnancy — fetotoxic.',
        'Fluid restriction (80mL/h) in severe pre-eclampsia prevents pulmonary oedema.',
        'The cure is delivery, but timing balances maternal risk against fetal maturity — 34+2 with severe features means delivery after stabilisation.'
      ],
      references: ['NICE guideline NG133 — hypertension in pregnancy', 'FIGO good practice recommendations on pre-eclampsia']
    },
    theatre: {
      procedure: 'Lower segment caesarean section (category 2 — pre-eclampsia with severe features at 34 weeks)',
      anaesthesia: 'Spinal anaesthesia preferred (phenylephrine support for hypotension); general anaesthesia with RSI if platelets <70, coagulopathy or emergency',
      asa: 'ASA III (pre-eclampsia with severe features — 34 weeks pregnant)',
      risks: [
        'Haemorrhage — uterine atony is the dominant risk in pre-eclampsia',
        'Thromboembolism (pre-eclampsia is prothrombotic)',
        'Anaesthetic risks — hypertensive response to laryngoscopy, high spinal block',
        'Infection',
        'Bladder or bowel injury',
        'Hysterectomy in refractory atony (rare)',
        'Neonatal respiratory distress syndrome — 34 weeks gestation',
        'Magnesium toxicity if renal function declines'
      ],
      steps: [
        'WHO sign-in: maternal identity, confirmed as left lateral tilt, allergies, airway, magnesium infusion running',
        'Paediatric team present with resuscitaire and warmed environment for 34-week neonate',
        'Time-out: team introductions, fetal heart confirmed, magnesium and antihypertensives reviewed',
        'Spinal anaesthesia sited (or RSI general anaesthesia if coagulopathic)',
        'Blood pressure supported with phenylephrine — avoid precipitate hypotension',
        'Lower segment transverse incision',
        'Uterine incision and delivery of the baby',
        'Cord bloods taken; neonatal team assess and transfer to resuscitaire',
        'Oxytocin infusion commenced (bolus then infusion — atony prophylaxis)',
        'Placenta delivered and inspected',
        'Uterine tone checked; balloon tamponade and senior help if atony develops',
        'Uterine and fascial layers closed',
        'WHO sign-out: counts correct, blood loss estimated, magnesium plan continued, HDU bed confirmed'
      ]
    }
  }
},

// ═════════════════════════ CASE 7: CAP + SEPSIS (ELDERLY) ═════════════════════════
{
  key: 'cap-sepsis-78m',
  title: 'Cough, fever and confusion in an elderly man',
  specialty: 'general-medicine',
  difficulty: 'intern',
  scenario_type: 'emergency',
  description: 'A 78-year-old retired teacher is sent to the ED by his GP with a 4-day cough, fever and new confusion. Sepsis physiology is already established. Order the chest X-ray and review the full radiology report — dense right lower lobe consolidation with air bronchograms — in the simulated PACS viewer.',
  scenario: {
    patient: { name: 'Hendrik Vosloo', age: 78, sex: 'M', occupation: 'Retired teacher', city: 'Westmere' },
    presentation: { setting: 'Emergency & Trauma Department', triage: 'category 2', initial: 'Hendrik is confused and trying to pull off his oxygen mask. His daughter: "He has not been right for two days — talking nonsense, not drinking. His GP sent us straight in."' },
    history: {
      complaint: 'Productive cough, fever and confusion — 4 days',
      pmh: ['COPD (ex-smoker 40 pack-years)', 'Hypertension', 'Benign prostatic hyperplasia', 'Influenza vaccine 2 months ago, no pneumococcal vaccine'],
      meds: ['Tiotropium inhaler', 'Ramipril 5mg', 'Tamsulosin'],
      allergies: [{ drug: 'Penicillin', reaction: 'Hives and facial swelling aged 40 (anaphylaxis suspected)' }],
      family: ['Wife died 3 years ago', 'Daughter lives nearby and visits daily'],
      social: { smoking: 'Stopped 8 years ago, 40 pack-year history', alcohol: '2 units/week', notes: 'Lives alone, normally independent and sharp. Daughter noticed confusion — "he could not find his glasses on his own nose".' }
    },
    emotions: { pain: 2, anxiety: 4, confusion: 8 },
    interview: [
      { tags: ['onset'], match: ['when','start','how long','begin'], a: '(Daughter) The cough started four days ago. He seemed flu-ey, then yesterday he got muddled and today he does not know what day it is.', speaker: 'daughter' },
      { tags: ['cough'], match: ['cough','phlegm','sputum','mucus'], a: '(Daughter) A wet chesty cough — greenish phlegm for two days. He is too weak to clear it properly.', speaker: 'daughter' },
      { tags: ['confusion'], match: ['confus','muddled','confuse','not himself','deliri'], a: '(Daughter) Since yesterday evening. He thought my mother was still alive and asked why she was late. He never gets confused normally.', speaker: 'daughter' },
      { tags: ['drinking'], match: ['drink','drinking','fluids','eating','appetite'], a: '(Daughter) Barely anything in two days — maybe a cup of tea and half a biscuit. His mouth looks dry.', speaker: 'daughter' },
      { tags: ['urine'], match: ['urine','wee','incontinent','wet himself','burning'], a: '(Daughter) He has been incontinent overnight — very unusual. No burning mentioned.', speaker: 'daughter' },
      { tags: ['breathing'], match: ['breath','breathe','short of breath','puff'], a: '(Daughter) Breathing fast even sitting still. He cannot walk to the bathroom without stopping twice.', speaker: 'daughter' },
      { tags: ['pmh'], match: ['medical history','past','lungs','copd','problems'], a: '(Daughter) His chest — COPD, they call it. Blood pressure tablets. Prostate problems. That is it.', speaker: 'daughter' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills','inhaler'], a: '(Daughter) The powder inhaler once a day, ramipril, and tamsulosin for his prostate. No antibiotics recently.', speaker: 'daughter' },
      { tags: ['allergies'], match: ['allerg','reaction','penicillin'], a: '(Daughter) CRITICAL — he is penicillin allergic. His face swelled up like a balloon in his forties. They said never give it again. (Anaphylaxis to penicillin — do not give amoxicillin/co-amoxiclav/benzylpenicillin.)', speaker: 'daughter' },
      { tags: ['vaccines'], match: ['vaccin','flu jab','pneumonia','immunis'], a: '(Daughter) Flu jab this autumn. I do not think he ever had the pneumonia one.', speaker: 'daughter' },
      { tags: ['social'], match: ['live','home','alone','help','family'], a: '(Daughter) He manages alone — I do his shopping. He was a teacher; still does the crossword every morning. Until this week.', speaker: 'daughter' }
    ],
    exam: {
      general: 'Dishevelled, dehydrated, fluctuating consciousness (GCS 13). Tachypnoeic RR 30. Tachycardic. Warm peripheries initially (distributive shock).',
      systems: {
        respiratory: 'RR 30. Coarse crackles right base with bronchial breathing and increased vocal resonance. Dull to percussion right base. Widespread wheeze (COPD background). SpO2 87% on air.',
        cardiovascular: 'HR 122, BP 96/58, CRT 4s. JVP flat. No murmurs.',
        neuro: 'GCS 13/15 (E3V4M6). New confusion — CAM positive. No focal deficits.',
        abdominal: 'Soft, non-tender. Bladder not palpable. Mild suprapubic prostate-related discomfort noted historically.',
        peripheral: 'Warm peripheries, bounding pulse — early septic physiology. Mottling appearing on knees.'
      }
    },
    baselineVitals: { hr: 122, sbp: 96, dbp: 58, rr: 30, temp: 38.7, spo2: 87, gcs: 13, pain: 2 },
    labs: {
      baseline: { wcc: 19.8, hb: 128, platelets: 132, crp: 214, na: 128, k: 3.4, urea: 18.6, creatinine: '168 (baseline 98 — AKI)', egfr: 38, glucose: 8.9, lactate: 3.8, abg: 'pH 7.29, pO2 7.1 kPa on air, pCO2 4.4, HCO3 17 — type 1 respiratory failure with metabolic acidosis', vbg: 'pH 7.30, lactate 3.9, pCO2 5.8', urinalysis: 'No nitrites, no leucocytes, trace blood (BPH)', bculture: 'Streptococcus pneumoniae (sensitive to macrolides, tetracyclines; resistant to penicillin intermediately) — result at 48h', sculture: 'Heavy growth Streptococcus pneumoniae', 'toscreen': 'Negative' },
      phases: { 1: { lactate: 5.2, creatinine: 210, na: 124, wcc: 23.1 }, 2: { lactate: 2.6, crp: 120, creatinine: 150 } }
    },
    imaging: {
      cxr: { finding: 'Dense right lower lobe consolidation with air bronchograms. Small right pleural effusion. Hyperinflated lungs (COPD). IMPRESSION: Community-acquired pneumonia, right lower lobe.', phases: [0, 1, 2] },
      ecg_12: { finding: 'Sinus tachycardia 122/min. Voltage criteria consistent with COPD hyperinflation. No ischaemic changes.', phases: [0, 1, 2] },
      ct_chest: { finding: 'Consolidation of right lower lobe with necrotic areas. No empyema. Findings beyond CXR would not change initial management — not indicated first-line.', phases: [0, 1, 2] }
    },
    hidden: {
      diagnosis: 'Community-acquired pneumonia (Streptococcus pneumoniae) with sepsis and type 1 respiratory failure',
      aliases: ['pneumon', 'cap', 'community-acquired', 'lobar pneumonia', 'streptococcus pneumoniae', 'sepsis'],
      differentials: [
        { dx: 'CAP with sepsis', why: 'Focal chest signs, consolidation on imaging, inflammatory response, organ dysfunction' },
        { dx: 'Pulmonary embolism', why: 'Hypoxia and confusion — should be considered; D-dimer/CTPA if indicated' },
        { dx: 'Exacerbation of COPD', why: 'Background COPD + wheeze, but focal consolidation and fever point to pneumonia' },
        { dx: 'Urinary sepsis in an elderly man', why: 'Confusion common presentation — urinalysis here is negative' },
        { dx: 'Aspiration pneumonia', why: 'Confusion and weakness — risk factor; same treatment pathway' }
      ]
    },
    management: [
      { id: 'oxygen', type: 'oxygen', label: 'Oxygen to target SpO2 88-92% (COPD — not 94-98%)', withinMin: 10, critical: true, points: 12 },
      { id: 'septic_screen', type: 'lab', label: 'Septic screen: bloods, lactate, cultures, urinalysis', withinMin: 30, points: 8 },
      { id: 'antibiotics', type: 'drug', drugs: ['clarithromycin', 'metronidazole', 'oseltamivir'], label: 'Antibiotics within 1 hour — MUST avoid penicillins (anaphylaxis). Macrolide ± others per guidelines', withinMin: 60, critical: true, points: 15 },
      { id: 'fluids', type: 'drug', drugs: ['sodium chloride 0.9%'], label: 'Cautious IV fluids (250mL boluses with reassessment — elderly, AKI)', withinMin: 30, points: 8 },
      { id: 'news_monitor', type: 'procedure', label: 'Continuous monitoring + repeat lactate', withinMin: 60, points: 5 },
      { id: 'senior_escalate', type: 'procedure', label: 'Escalation decision — HDU/ICU if worsening', withinMin: 120, points: 5 },
      { id: 'admit', type: 'admit', label: 'Admit under medical team', withinMin: 120, points: 4 }
    ],
    phases: [
      { id: 0, name: 'Sepsis presentation', maxMin: 60, timeoutNext: 1, stabilizeNext: 1, description: 'Sepsis Six window. Every minute without antibiotics worsens outcome.' },
      { id: 1, name: 'Refractory sepsis', maxMin: 180, timeoutNext: 2, description: 'Lactate rising, AKI worsening, confusion deepening despite (or without) treatment.' },
      { id: 2, name: 'Stabilisation / treatment response', maxMin: 720, timeoutNext: 3, description: 'With correct antibiotics: defervescence, lactate clearing, renal recovery.' },
      { id: 3, name: 'Recovery', recovery: true, vitals: { hr: 88, sbp: 122, dbp: 68, rr: 18, temp: 36.9, spo2: 94, gcs: 15, pain: 1 }, description: 'Day 5: afebrile 48h, back to his crossword, planning discharge with follow-up CXR in 6 weeks.' },
      { id: 'death', name: 'Death from sepsis', death: true, description: 'Sepsis mortality rises 4-8% per hour of delayed antibiotics.' }
    ],
    interventions: {
      oxygen: { spo2: 7, rr: -3 },
      clarithromycin: { temp: -1.1, hr: -12 },
      metronidazole: { temp: -0.5 },
      'sodium chloride 0.9%': { sbp: 10, hr: -10, creatinine: -20 },
      paracetamol: { temp: -0.8 }
    },
    complications: [
      { id: 'septic_shock', name: 'Septic shock', trigger: { phase: 1, afterMin: 60, ifNotDone: ['antibiotics'] }, vitals: { hr: 138, sbp: 76, dbp: 44, rr: 34, spo2: 82, gcs: 10 }, description: 'Now cold and mottled, lactate 6.1. Needs vasopressors and ICU.' },
      { id: 'co2_retention', name: 'Hypercapnic respiratory failure (oxygen-induced)', trigger: { phase: 0, afterMin: 30, ifOverTreated: true }, vitals: { spo2: 98, gcs: 10, rr: 12 }, description: 'SpO2 pushed to 98% in a COPD retainer — drowsy, pCO2 rising. Reduce oxygen to 88-92% target.' },
      { id: 'afib', name: 'New atrial fibrillation with rapid rate', trigger: { phase: 1, afterMin: 120, chance: 0.35 }, vitals: { hr: 152 }, description: 'Irregularly irregular at 152. Septis-driven AF — fluids, treat the sepsis, rate control.' }
    ],
    rubric: {
      history: { points: 8, criteria: ['Collateral history from daughter', 'Allergy history — penicillin anaphylaxis captured', 'Functional baseline established'] },
      examination: { points: 10, criteria: ['Respiratory examination with focal signs', 'Confusion assessed (CAM/GCS)', 'Signs of sepsis recognised'] },
      investigations: { points: 12, criteria: ['Chest X-ray', 'Lactate', 'Blood cultures', 'U&E for AKI'] },
      diagnosis: { points: 10, criteria: ['CAP with sepsis recognised', 'Sepsis criteria identified early'] },
      management: { points: 22, criteria: ['Oxygen with COPD-appropriate target', 'Antibiotics within 1 hour avoiding penicillins', 'Cautious fluid resuscitation', 'Escalation planning'] },
      safety: { points: 14, criteria: ['NO penicillin prescribed (anaphylaxis)', 'COPD oxygen target respected', 'Renal-aware prescribing'] },
      communication: { points: 8, criteria: ['Involves daughter in decisions', 'Explains delirium to family'] },
      documentation: { points: 4, criteria: ['Sepsis Six documented with times'] },
      timeliness: { points: 12, criteria: ['Antibiotics within 60 minutes', 'Oxygen within 10 minutes'] }
    },
    debrief: {
      summary: 'Right lower lobe pneumococcal pneumonia presenting as sepsis with delirium in a 78-year-old with COPD. Core errors to avoid: giving penicillins despite documented anaphylaxis, over-oxygenating a CO2 retainer, and delayed antibiotics. The Sepsis Six saves lives: oxygen, cultures, antibiotics, fluids, lactate, urine output.',
      learningPoints: [
        'Confusion in the elderly is sepsis until proven otherwise — and often the only sign.',
        'CURB-65 score: Confusion, Urea >7, RR ≥30, BP systolic <90 — Hendrik scores 4 (severe, needs admission ± ICU).',
        'Penicillin anaphylaxis: macrolides or respiratory fluoroquinolones are the alternatives; document the allergy clearly.',
        'COPD oxygen target 88-92%: too much oxygen causes hypercapnic coma.',
        'Fluids in septic AKI: boluses with reassessment, not litres blind — elderly hearts fail.',
        'Delirium management: treat the cause, reorient, involve family, avoid sedatives.'
      ],
      references: ['NICE guideline CG191 — pneumonia in adults', 'Surviving Sepsis Campaign 2021 guidelines']
    }
  }
},

// ═════════════════════════ CASE 8: UPPER GI BLEED ═════════════════════════
{
  key: 'gib-66m-melaena',
  title: 'Melaena and dizziness',
  specialty: 'gastroenterology',
  difficulty: 'specialist',
  scenario_type: 'emergency',
  description: 'A 66-year-old man on warfarin for atrial fibrillation presents with three days of black stools, dizziness and epigastric pain. A high-stakes anticoagulation and endoscopy case.',
  scenario: {
    patient: { name: 'Piotr Kaminski', age: 66, sex: 'M', occupation: 'Retired bus driver', city: 'Port Meridian' },
    presentation: { setting: 'Emergency & Traffic Department', triage: 'category 2', initial: 'Piotr is pale and clammy, sitting forward. "Three days of black stools — like tar. Today I stood up and the room spun. My stomach aches." His wife carries a bag of his medications.' },
    history: {
      complaint: 'Melaena for 3 days, epigastric pain, postural dizziness',
      pmh: ['Atrial fibrillation (warfarin, CHA2DS2-VASc 4)', 'Osteoarthritis — takes ibuprofen regularly', 'Peptic ulcer disease aged 45 (treated)', 'Ex-smoker'],
      meds: ['Warfarin (target INR 2-3)', 'Ibuprofen 400mg TDS (self-medicated for knee pain)', 'Atorvastatin 40mg'],
      allergies: [],
      family: ['Father had "a bleeding ulcer" in his 60s'],
      social: { smoking: 'Stopped 10 years ago, 25 pack-years', alcohol: 'Half a bottle of vodka most evenings for 30 years', notes: 'Lives with wife. Recently doubled his ibuprofen because of knee pain.' }
    },
    emotions: { pain: 5, anxiety: 7, confusion: 0 },
    interview: [
      { tags: ['stool'], match: ['stool','poo','black','bowel','melaena','motion'], a: 'Black like tar, sticky, and the smell — terrible, like nothing normal. Three days now, four or five times a day.' },
      { tags: ['blood_vomit'], match: ['vomit','blood','sick','haematemesis','coffee'], a: 'No vomiting blood. I felt sick yesterday but nothing came up except clear fluid.' },
      { tags: ['dizziness'], match: ['dizzy','dizziness','faint','light','collapse','black out'], a: 'When I stand up the room spins and my vision greys out. Nearly fell in the bathroom this morning.' },
      { tags: ['onset'], match: ['when','start','how long','begin'], a: 'Three days ago the stools turned black. The stomach ache started around the same time — burning, at the top.' },
      { tags: ['pain_site'], match: ['where','site','pain','tummy','stomach','epigastric'], a: 'Top of the belly, just under the breastbone. Burning. Worse when my stomach is empty.' },
      { tags: ['anticoag'], match: ['warfarin','blood thinner','anticoag','inr'], a: 'Yes — warfarin for my irregular heartbeat. I have taken it for six years. They check my blood at the clinic. Last check... two weeks ago, they said it was fine.' },
      { tags: ['nsaid'], match: ['ibuprofen','nsaid','anti-inflammatory','painkillers','voltaren','brufen'], a: 'Ibuprofen, three times a day for my knee. I doubled them last week because the pain was bad. My wife says that is when the black stools started.' },
      { tags: ['alcohol'], match: ['alcohol','drink','vodka','beer','wine','units'], a: '(Pauses) I drink. More than I should. Vodka, most evenings. It helps the knee, you know? (Likely gastritis and variceal risk contributor.)' },
      { tags: ['pmh'], match: ['medical history','past','ulcer','problems','illness'], a: 'An ulcer when I was forty-five — they gave me tablets and it healed. The heart rhythm problem. Arthritis in my knees.' },
      { tags: ['meds'], match: ['tablet','medicine','medication','pills'], a: 'Warfarin, the cholesterol tablet, and ibuprofen from the pharmacy. Nothing else.' },
      { tags: ['allergies'], match: ['allerg','reaction'], a: 'None.' },
      { tags: ['weight_appetite'], match: ['weight','appetite','lost','eat'], a: 'I have not eaten properly for three days — the pain puts me off. Maybe lost a kilo or two this month, my belt is loose.' },
      { tags: ['syncope'], match: ['faint','collapse','unconscious','black out'], a: 'Not completely. The greying-out when I stand, but I have not fallen.' }
    ],
    exam: {
      general: 'Pale, clammy, cool peripheries. Conjunctival pallor. Restless with pain.',
      systems: {
        cardiovascular: 'HR 116 (irregularly irregular — AF), BP 98/60 lying, 82/48 standing (postural drop). JVP flat. Muffled S1/S2, no murmur.',
        abdominal: 'Epigastric tenderness, no guarding. No organomegaly. Bowel sounds present. No ascites. Melaena on digital rectal examination.',
        respiratory: 'RR 20. Chest clear.',
        neuro: 'GCS 15/15. No asterixis (no encephalopathy).',
        peripheral: 'CRT 5s. Stigmata of chronic liver disease: palmar erythema, several spider naevi — no jaundice or ascites.'
      }
    },
    baselineVitals: { hr: 116, sbp: 98, dbp: 60, rr: 20, temp: 36.4, spo2: 96, gcs: 15, pain: 5 },
    labs: {
      baseline: { hb: 79, wcc: 12.4, platelets: 188, na: 133, k: 4.8, urea: '21.4 (raised out of proportion to creatinine — upper GI bleed)', creatinine: 112, egfr: 62, coag_screen: 'INR 4.8 (target 2-3), APTT 1.4, Fibrinogen 2.8 — over-anticoagulated', alt: 68, ast: 95, alp: 140, bilirubin: 18, albumin: 31, lactate: 3.1, 'group_save': 'Group A RhD positive', crossmatch: '4 units compatible red cells reserved (units 1-4)', 'iron_studies': 'Ferritin 22 (low — chronic loss)' },
      phases: { 1: { hb: 64, lactate: 4.6, urea: 24.8 }, 2: { hb: 82, lactate: 1.8, urea: 16.2 } }
    },
    imaging: {
      ecg_12: { finding: 'Atrial fibrillation at 116/min. No ischaemic changes. Rate needs control.', phases: [0, 1, 2] },
      upper_endo: { finding: 'Active spurting vessel (Forrest Ia) in a duodenal bulb ulcer, 1.5cm. Achieved haemostasis with adrenaline injection + clips. No varices. Biopsies: H. pylori negative. CLO test negative.', phases: [0, 1, 2] },
      ct_abdo: { finding: 'Not first-line in stable upper GI bleed. Would show: no active extravasation, no mass. Reserved for obscure bleeding.', phases: [0, 1, 2] }
    },
    hidden: {
      diagnosis: 'Bleeding duodenal ulcer (NSAID + warfarin-related) with over-anticoagulation (INR 4.8)',
      aliases: ['duodenal ulcer', 'upper gi bleed', 'gi bleed', 'bleeding ulcer', 'peptic ulcer', 'melaena', 'gib'],
      differentials: [
        { dx: 'Peptic ulcer bleeding', why: 'Melaena, epigastric pain, NSAIDs + anticoagulant, raised urea:creatinine ratio' },
        { dx: 'Oesophageal varices', why: 'Alcohol history + stigmata of chronic liver disease — must exclude with endoscopy' },
        { dx: 'Malignancy (gastric cancer)', why: 'Weight loss and age — biopsy during endoscopy' },
        { dx: 'Oesophagitis/Mallory-Weiss', why: 'No haematemesis here' },
        { dx: 'Lower GI source', why: 'Melaena indicates upper GI origin (unless very distal + slow)' }
      ]
    },
    management: [
      { id: 'abc_resus', type: 'procedure', label: 'ABC + large-bore IV access x2 + crossmatch', withinMin: 15, critical: true, points: 10 },
      { id: 'transfuse_criteria', type: 'procedure', label: 'Restrictive transfusion strategy — transfuse only if Hb <70 (or <80 with cardiac history)', withinMin: 60, points: 8 },
      { id: 'reverse_anticoag', type: 'procedure', label: 'Warfarin reversal decision (vitamin K + prothrombin complex concentrate — simulator: any reversal step logged)', withinMin: 45, critical: true, points: 10 },
      { id: 'ppi', type: 'drug', drugs: ['pantoprazole', 'omeprazole'], label: 'High-dose IV proton pump inhibitor', withinMin: 45, critical: true, points: 10 },
      { id: 'stop_nsaids', type: 'procedure', label: 'Stop NSAIDs permanently', withinMin: 30, points: 5 },
      { id: 'endoscopy', type: 'procedure', label: 'Endoscopy within 24h (ideally <12h after resuscitation)', withinMin: 720, critical: true, points: 12 },
      { id: 'helicobacter', type: 'procedure', label: 'H. pylori testing at endoscopy', withinMin: 780, points: 4 },
      { id: 'anticoag_plan', type: 'procedure', label: 'Plan AF anticoagulation restart (balance stroke vs rebleed — typically restart after haemostasis, consider DOAC)', withinMin: 1440, points: 6 },
      { id: 'admit', type: 'admit', label: 'Admit to monitored bed (HDU if unstable)', withinMin: 90, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Acute upper GI bleed with haemodynamic compromise', maxMin: 60, timeoutNext: 1, stabilizeNext: 1, description: 'Postural hypotension, Hb 79, INR 4.8. Resuscitate, reverse, PPI, scope.' },
      { id: 1, name: 'Ongoing bleeding / re-bleed risk', maxMin: 360, timeoutNext: 'death', description: 'Without endoscopy and reversal: haemoglobin falls, lactate rises, massive haemorrhage risk.' },
      { id: 2, name: 'Post-endoscopy stabilisation', maxMin: 1440, stabilizeNext: 3, timeoutNext: 3, description: 'Haemostasis achieved. Hb recovering, eating, planning anticoagulation restart.' },
      { id: 3, name: 'Discharge planning', recovery: true, vitals: { hr: 84, sbp: 128, dbp: 74, rr: 16, temp: 36.6, spo2: 98, gcs: 15, pain: 1 }, description: 'Day 4: Hb 96, stable. Discharged on oral PPI, NSAIDs stopped, anticoagulation plan agreed with cardiology.' },
      { id: 'death', name: 'Death from massive haemorrhage', death: true, description: 'Untreated upper GI bleeding in an over-anticoagulated patient is fatal.' }
    ],
    interventions: {
      'sodium chloride 0.9%': { sbp: 12, hr: -10 },
      pantoprazole: { pain: -2 },
      omeprazole: { pain: -2 },
      morphine: { pain: -4 },
      paracetamol: { pain: -2 }
    },
    complications: [
      { id: 'massive_haemorrhage', name: 'Massive haemorrhage', trigger: { phase: 1, afterMin: 90, ifNotDone: ['endoscopy'] }, vitals: { hr: 140, sbp: 62, dbp: 38, rr: 28, spo2: 90, gcs: 11 }, description: 'Fresh haematemesis, collapse of circulation. Massive transfusion protocol activation.' },
      { id: 'cardiac_ischaemia', name: 'Acute coronary syndrome (anaemia-driven)', trigger: { phase: 1, afterMin: 150, chance: 0.3 }, vitals: { hr: 128, sbp: 88, spo2: 93 }, description: 'Troponin rises — demand ischaemia from severe anaemia in an AF patient with cardiovascular disease.' },
      { id: 'aspiration', name: 'Aspiration during endoscopy', trigger: { phase: 1, afterMin: 200, chance: 0.2 }, description: 'Blood in the airway — sit up, suction, airway protection. Unprotected airway + GI bleed = danger.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Melaena characterised', 'Warfarin + NSAID history identified', 'Alcohol history (variceal risk)', 'Weight loss / malignancy features'] },
      examination: { points: 10, criteria: ['Postural BP measured', 'Rectal examination', 'Stigmata of liver disease sought', 'Signs of shock assessed'] },
      investigations: { points: 14, criteria: ['FBC + coagulation (INR)', 'Crossmatch ordered early', 'U&E (raised urea:creatinine ratio)', 'ECG'] },
      diagnosis: { points: 12, criteria: ['Upper GI bleed from peptic ulcer identified', 'Anticoagulation as contributing factor recognised'] },
      management: { points: 22, criteria: ['Two large-bore access + crossmatch', 'IV PPI', 'Warfarin reversal', 'Endoscopy within 24h', 'NSAIDs stopped'] },
      safety: { points: 14, criteria: ['Transfusion threshold respected (restrictive strategy)', 'No NSAIDs continued', 'No over-transfusion', 'Anticoagulation restart planned deliberately'] },
      communication: { points: 8, criteria: ['Explains need to stop ibuprofen', 'Involves wife in alcohol discussion'] },
      documentation: { points: 4, criteria: ['Glasgow-Blatchford score calculated/documented'] },
      timeliness: { points: 6, criteria: ['PPI within 45 minutes', 'Endoscopy within 24 hours'] }
    },
    debrief: {
      summary: 'NSAID + warfarin duodenal ulcer bleed with INR 4.8 and postural hypotension. Priorities: resuscitation with restrictive transfusion (Hb target 70-80), warfarin reversal with vitamin K + PCC, high-dose IV PPI, and endoscopy within 24 hours. Then address the cause: stop NSAIDs, test for H. pylori, plan safe anticoagulation for AF.',
      learningPoints: [
        'Glasgow-Blatchford score ≥1 (here: urea 21, Hb 79, systolic <100, pulse ≥100, melaena, syncope — high risk) predicts need for intervention.',
        'Raised urea with normal creatinine suggests upper GI bleeding (protein digestion absorbs urea).',
        'Restrictive transfusion (Hb <70 trigger) improves survival vs liberal — even in cardiac patients, 80 is the ceiling.',
        'Reversal of warfarin: vitamin K + prothrombin complex concentrate (not FFP) when actively bleeding.',
        'NSAIDs + anticoagulants = the classic ulcer combination. The pharmacy safety system should have flagged it.',
        'Restarting anticoagulation after a bleed: balance thrombotic vs bleeding risk — usually resume after haemostasis, often switching to a DOAC.'
      ],
      references: ['ESGE guideline: nonvariceal upper gastrointestinal haemorrhage', 'TRICC trial — restrictive transfusion strategies']
    },
    theatre: {
      procedure: 'Emergency upper GI endoscopy (OGD) with haemostasis — adrenaline injection plus thermal coagulation',
      anaesthesia: 'Conscious sedation (midazolam ± fentanyl) if stable and cooperative; general anaesthesia with airway protection if unstable or massive haemorrhage (aspiration risk)',
      asa: 'ASA III (age 66, anticoagulated, acutely anaemic)',
      risks: [
        'Aspiration of blood during the procedure',
        'Perforation of the oesophagus, stomach or duodenum',
        'Failed haemostasis requiring surgery or radiological embolisation',
        'Rebleeding after apparent haemostasis',
        'Reaction to sedation — respiratory depression in an older patient',
        'The bleeding lesion may not be found at endoscopy',
        'Oesophageal intubation or dental damage during scope insertion'
      ],
      steps: [
        'WHO sign-in: identity, allergies (sedation), airway risk, resuscitation status confirmed',
        'Time-out: team introductions, endoscopy checklist, suction and intubation equipment ready',
        'Sedation titrated carefully — older patients are sensitive',
        'Scope passed under direct vision into the oesophagus',
        'Stomach inspected — blood clot aspirated, pool suctioned to reveal the mucosa',
        'Duodenum inspected to the second part (D2)',
        'Bleeding point identified — visible vessel with adherent clot at the ulcer base',
        'Adrenaline injected in four quadrants around the bleeding point',
        'Thermal coagulation (heater probe or bipolar) applied to the vessel',
        'Haemostasis tested — washing the site to confirm no rebleeding',
        'Oesophagus re-inspected for varices or Mallory-Weiss tear',
        'Biopsies taken for Helicobacter pylori testing',
        'Scope withdrawn; procedure documented with Forrest classification',
        'WHO sign-out: specimen labelled, sedation reversal plan, monitoring for rebleeding, restart-anticoagulation timing planned'
      ]
    }
  }
}
];

module.exports = { CASES_PART2 };
