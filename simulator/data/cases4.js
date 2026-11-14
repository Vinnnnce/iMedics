// Medic1905 clinical case library — Part 4: paediatric specialties.

const CASES_PART4 = [

// ═══════════════════ CASE 15: BRONCHIOLITIS ═══════════════════
{
  key: 'bronchiolitis-7mo-rsv',
  title: 'A wheezy, breathless seven-month-old',
  specialty: 'paediatrics',
  difficulty: 'undergraduate',
  scenario_type: 'paediatric',
  description: 'A seven-month-old infant presents with coryza, worsening cough, wheeze and poor feeding. The winter epidemic has arrived.',
  scenario: {
    patient: { name: 'Poppy Nakamura', age: 0.6, sex: 'F', occupation: 'Infant', city: 'Highgarden' },
    presentation: { setting: 'Emergency & Trauma Department (paediatric area)', triage: 'category 2', initial: 'Poppy is carried in by her mother, floppy and irritable, breathing fast with visible subcostal recession. Mum: "She had a snotty cold for three days, then the cough got worse yesterday. Today she has taken barely half her bottles — she just will not feed."' },
    history: {
      complaint: 'Coryza, worsening cough, wheeze and poor feeding',
      pmh: ['Born at term, normal delivery', 'Fully vaccinated for age', 'No previous wheeze'],
      meds: ['None'],
      allergies: [],
      family: ['Older brother, 3, currently recovering from "a nasty cold"'],
      social: { notes: 'Mother smoked in pregnancy; household has two smokers. No pets. Exclusive formula feeding until weaning started.' }
    },
    emotions: { pain: 2, anxiety: 9, confusion: 0, paediatric_parent: true },
    interview: [
      { tags: ['onset_parent'], match: ['when','start','how long','begin'], a: '(Mother) Snotty nose three days ago, then the cough started yesterday, and today she is breathing fast and will not feed. It has all got worse so quickly.', speaker: 'mother' },
      { tags: ['feeding_parent'], match: ['feed','feeding','milk','bottle','eating','drink'], a: '(Mother) Normally she takes five bottles of 180mL. Today — maybe two, half-finished. She gets puffed out feeding, has to stop to breathe. Wet nappies are fewer too.', speaker: 'mother' },
      { tags: ['breathing_parent'], match: ['breath','breathe','fast','wheeze','chest'], a: '(Mother) Breathing fast all day — her whole chest sucks in under the ribs. There is a whistling sound when she breathes out. No pauses in breathing that I have seen.', speaker: 'mother' },
      { tags: ['apnoea_parent'], match: ['stop breathing','pause','apnoea','blue','turn','colour'], a: '(Mother) Never stopped breathing, never went blue. Her lips are pink — I keep checking.', speaker: 'mother' },
      { tags: ['fever_parent'], match: ['fever','temperature','hot'], a: '(Mother) Slightly warm — 37.8 at home. Not the raging fevers her brother gets.', speaker: 'mother' },
      { tags: ['brother_parent'], match: ['brother','sibling','family ill','contacts','cold'], a: '(Mother) Her big brother had a streaming cold last week — RSV is going round the nursery, they said.', speaker: 'mother' },
      { tags: ['birth_parent'], match: ['birth','born','premature','delivery','normal'], a: '(Mother) Born at term, normal delivery, home the same day. Never been in hospital.', speaker: 'mother' },
      { tags: ['vaccines_parent'], match: ['vaccin','immunis','jabs'], a: '(Mother) All her jabs up to date. Nothing missed.', speaker: 'mother' },
      { tags: ['smoking_parent'], match: ['smoke','smoking','cigarette','vape'], a: '(Mother, awkwardly) Her dad smokes, and I do too — not near her, but... in the house. I know.', speaker: 'mother' }
    ],
    exam: {
      general: 'Irritable, mildly dehydrated, working hard at breathing. Temperature 37.9°C.',
      systems: {
        respiratory: 'RR 62. Subcostal and intercostal recession, nasal flaring, tracheal tug. Widespread fine crackles AND expiratory wheeze throughout both fields. Air entry symmetric. SpO2 89% in air. Head bobbing present.',
        cardiovascular: 'HR 172. Capillary refill 3s. Pale peripheries.',
        ent: 'Copious nasal discharge, congested. Tympanic membranes normal. No tonsillitis.',
        neuro: 'Alert but tired. Normal tone. No meningism.',
        dehydration: 'Mildly dry mucous membranes, reduced skin turgor, reduced urine output (fewer wet nappies).'
      }
    },
    baselineVitals: { hr: 172, sbp: 82, dbp: 48, rr: 62, temp: 37.9, spo2: 89, gcs: 15, pain: 2 },
    labs: {
      baseline: { wcc: 11.2, hb: 112, platelets: 340, crp: 18, na: 134, k: 4.4, urea: 4.2, creatinine: 22, capillary_glucose: 4.8, 'urinalysis': 'Not applicable in bronchiolitis — avoid catheterisation without indication', nasopharyngeal_note: 'RSV antigen positive on nasopharyngeal aspirate (result available)' },
      phases: { 1: { abg_note: 'Capillary gas: pH 7.29, pCO2 7.8 kPa — CO2 retention from exhaustion' } }
    },
    imaging: {
      cxr: { finding: 'Hyperinflation with flattened diaphragms and increased perihilar markings. No consolidation, no pneumothorax. Typical viral bronchiolitis. (Chest X-ray is NOT routinely indicated in bronchiolitis — only if the diagnosis is unclear or deterioration is unexplained.)', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Acute viral bronchiolitis (RSV-positive)',
      aliases: ['bronchiolitis', 'rsv', 'bronchiol', 'viral wheeze'],
      differentials: [
        { dx: 'Viral bronchiolitis', why: 'Age <2, coryzal prodrome, crackles + wheeze, poor feeding, winter epidemic' },
        { dx: 'Viral-induced wheeze / early asthma', why: 'First wheeze at 7 months is bronchiolitis until proven otherwise' },
        { dx: 'Pneumonia', why: 'Focal signs or toxicity — this is a diffuse picture' },
        { dx: 'Heart failure', why: 'Can mimic bronchiolitis: poor feeding, tachypnoea — check for hepatomegaly, sweatiness' },
        { dx: 'Foreign body', why: 'Sudden onset in a mobile infant — not this prodrome' }
      ]
    },
    management: [
      { id: 'oxygen', type: 'oxygen', label: 'Oxygen if SpO2 <90-92% (maintain 92%+)', withinMin: 10, critical: true, points: 12 },
      { id: 'feeding_assessment', type: 'procedure', label: 'Assess feeding and hydration — consider NG or IV fluids if >5% dehydrated', withinMin: 60, points: 8 },
      { id: 'monitoring', type: 'procedure', label: 'Continuous cardiorespiratory monitoring (apnoea risk under 2 months — Poppy is 7 months, still monitor)', withinMin: 30, points: 6 },
      { id: 'physio_nasal', type: 'procedure', label: 'Nasal suction / saline drops for airway clearance', withinMin: 45, points: 5 },
      { id: 'admit', type: 'admit', label: 'Admit — oxygen-dependent bronchiolitis cannot go home', withinMin: 120, points: 8 },
      { id: 'smoking_advice', type: 'procedure', label: 'Parental smoking cessation advice (strong evidence for severity reduction)', withinMin: 240, points: 6 },
      { id: 'senior_review', type: 'procedure', label: 'Senior review if deteriorating (HDU/PICU if rising CO2 or exhaustion)', withinMin: 180, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Moderate bronchiolitis', maxMin: 240, timeoutNext: 1, description: 'Hypoxic and working hard. Supportive care: oxygen, feeding, monitoring.' },
      { id: 1, name: 'Severe bronchiolitis — exhaustion', maxMin: 240, timeoutNext: 2, description: 'CO2 rising, feeding failing, exhaustion. High-dependency care needed.' },
      { id: 2, name: 'Impending respiratory failure', maxMin: 120, timeoutNext: 'death', description: 'Apnoeas and exhaustion — ventilatory support needed.' },
      { id: 'stable', name: 'Recovery', recovery: true, vitals: { hr: 128, sbp: 86, dbp: 52, rr: 38, temp: 37.2, spo2: 96, gcs: 15, pain: 1 }, description: 'Day 3: oxygen weaned, feeding happily again, discharged with parental smoking advice and red-flag safety netting.' }
    ],
    interventions: {
      oxygen: { spo2: 6, rr: -4 }
    },
    complications: [
      { id: 'apnoea', name: 'Apnoeic episode', trigger: { phase: 1, afterMin: 60, chance: 0.3 }, vitals: { rr: 18, spo2: 70, gcs: 12 }, description: 'A 20-second pause in breathing with desaturation. Bag-mask ventilation and PICU transfer — apnoea in bronchiolitis means respiratory failure until proven otherwise.' },
      { id: 'dehydration', name: 'Significant dehydration', trigger: { phase: 1, afterMin: 120, ifNotDone: ['feeding_assessment'] }, description: 'Sunken fontanelle, dry mucosae, urine output minimal. Needs fluid replacement — carefully calculated, divided.' }
    ],
    rubric: {
      history: { points: 10, criteria: ['Coryzal prodrome in a contact', 'Feeding assessment quantified', 'Apnoea/cyanosis excluded', 'Smoking exposure identified'] },
      examination: { points: 12, criteria: ['Recession and work of breathing graded', 'Crackles AND wheeze recognised', 'Hydration assessed', 'Danger signs recognised (head bobbing, exhaustion)'] },
      investigations: { points: 8, criteria: ['Minimal, appropriate testing (no routine bloods/X-ray)', 'Oxygen saturation measured'] },
      diagnosis: { points: 10, criteria: ['Bronchiolitis identified', 'Age-appropriate differential (heart failure, foreign body) considered'] },
      management: { points: 20, criteria: ['Oxygen for hypoxia', 'Feeding/hydration plan', 'Monitoring', 'Supportive care without unnecessary bronchodilators/antibiotics'] },
      safety: { points: 10, criteria: ['No unnecessary interventions', 'Appropriate oxygen targets for age', 'Safety-netting given'] },
      communication: { points: 10, criteria: ['Explains illness trajectory to parents', 'Non-judgemental smoking discussion', 'Clear red-flag advice for home'] },
      documentation: { points: 4, criteria: ['Work of breathing and feeding documented'] },
      timeliness: { points: 16, criteria: ['Oxygen within 10 minutes'] }
    },
    debrief: {
      summary: 'Acute viral bronchiolitis (RSV): the commonest lower respiratory tract infection of infancy, peaking at 2-7 months of age. Management is supportive — oxygen for hypoxia, hydration/nutrition, monitoring — because bronchodilators, steroids and antibiotics change nothing in typical cases.',
      learningPoints: [
        'Bronchiolitis is a CLINICAL diagnosis: coryzal prodrome, then crackles + wheeze + poor feeding in an infant under 2.',
        'Assess severity by WORK OF BREATHING, FEEDING and OXYGENATION — not by auscultation alone.',
        'The three questions: is she breathing? is she feeding? is she blue? — the triage of every bronchiolitic infant.',
        'Bronchodilators, steroids, antibiotics and chest physiotherapy are NOT recommended routinely — a trial of bronchodilator only if there is a clear response.',
        'Under 2 months, premature infants and those with congenital heart disease are high risk for apnoea — monitor closely.',
        'Parental smoking cessation is one of the few interventions that genuinely reduces severity and recurrence.',
        'Do not routinely X-ray or take bloods — distress and iatrogenic harm exceed benefit.'
      ],
      references: ['NICE guideline NG9 — bronchiolitis in children', 'AAP clinical practice guideline — diagnosis and management of bronchiolitis']
    }
  }
},

// ═══════════════════ CASE 16: INTUSSUSCEPTION ═══════════════════
{
  key: 'intussusception-18mo',
  title: 'Screaming attacks and red currant jelly stools',
  specialty: 'paediatric surgery',
  difficulty: 'resident',
  scenario_type: 'paediatric',
  description: 'An 18-month-old toddler has recurrent screaming episodes, drawing up his legs, vomiting, and now passes a stool like red currant jelly. A paediatric surgical emergency.',
  scenario: {
    patient: { name: 'Theo Brandt', age: 1.5, sex: 'M', occupation: 'Toddler', city: 'Rivermoor' },
    presentation: { setting: 'Emergency & Trauma Department (paediatric area)', triage: 'category 2', initial: 'Theo screams and draws his knees to his chest, goes pale, then settles for ten minutes — then it happens again. Between episodes he is listless, which frightens his mother more than the screaming. She holds a nappy: "And now THIS — his poo looks like red currant jelly."' },
    history: {
      complaint: 'Recurrent screaming with leg-drawing, vomiting, red currant jelly stool',
      pmh: ['Recent viral upper respiratory infection (last week)', 'Born at term', 'Fully vaccinated'],
      meds: ['None'],
      allergies: [],
      family: ['No family history of bowel problems'],
      social: { notes: 'Recently started nursery. No travel. No sick contacts beyond the recent cold. Normally a "cheerful little boy who never stops moving" — his mother is alarmed by the listlessness between attacks.' }
    },
    emotions: { pain: 9, anxiety: 9, confusion: 0, paediatric_parent: true },
    interview: [
      { tags: ['onset_parent'], match: ['when','start','how long','begin','attack'], a: '(Mother) The first screaming attack was about eight hours ago. He screams like nothing I have ever heard, pulls his knees up, goes grey — then it stops and he goes floppy and quiet for ten minutes. Then it starts again.', speaker: 'mother' },
      { tags: ['pattern_parent'], match: ['again','pattern','recurr','episodes','waves','cyclical'], a: '(Mother) Every fifteen to twenty minutes, like clockwork. The screaming lasts a minute or two, then he is exhausted, pale, and withdrawn until the next one.', speaker: 'mother' },
      { tags: ['stool_parent'], match: ['poo','stool','nappy','jelly','blood','bowel'], a: '(Mother) About an hour ago he passed this — (shows nappy) — like red currant jelly. Mucus and blood mixed. That is when I called the ambulance.', speaker: 'mother' },
      { tags: ['vomiting_parent'], match: ['sick','vomit','throw'], a: '(Mother) He has vomited four times — first his lunch, then green bile-stained fluid.', speaker: 'mother' },
      { tags: ['between_parent'], match: ['between','normal','listless','lethargic','quiet','floppy'], a: '(Mother) That is the frightening part — between attacks he is NOT himself. Listless, glassy-eyed, lying still. Theo never lies still.', speaker: 'mother' },
      { tags: ['recent_illness'], match: ['cold','ill','virus','infection','recently','snot'], a: '(Mother) He had a rotten cold last week — nursery is a petri dish. He had just recovered from that.', speaker: 'mother' },
      { tags: ['feeding_parent'], match: ['feed','eat','drink','milk','food'], a: '(Mother) He will not touch food or drink. Even water comes back up.', speaker: 'mother' },
      { tags: ['fever_parent'], match: ['fever','temperature','hot'], a: '(Mother) No real fever — 37.5 at most. It is the screaming and the jelly stool.', speaker: 'mother' }
    ],
    exam: {
      general: 'Ill-looking toddler, pale, intermittently screaming with knees drawn up, listless between attacks. Mildly dehydrated.',
      systems: {
        abdominal: 'During an attack: distended, diffuse tenderness. BETWEEN attacks: a sausage-shaped mass palpable in the RIGHT upper quadrant. Empty right lower quadrant (Dance sign). Stool on examination: red currant jelly.',
        cardiovascular: 'HR 158. CRT 3-4s. BP 84/52. Mildly shocked.',
        respiratory: 'RR 30 — pain and crying. Clear chest.',
        neuro: 'Drowsy between attacks, rousable. No meningism. Normal fontanelle (closed).'
      }
    },
    baselineVitals: { hr: 158, sbp: 84, dbp: 52, rr: 30, temp: 37.5, spo2: 97, gcs: 13, pain: 9 },
    labs: {
      baseline: { wcc: 15.8, hb: 116, platelets: 310, crp: 42, na: 133, k: 4.1, urea: 7.8, creatinine: 26, 'group_save': 'Group O RhD positive', capillary_glucose: 4.6 },
      phases: { 1: { wcc: 19.2, crp: 96, lactate: 4.2 } }
    },
    imaging: {
      'us_abdo': { finding: 'Target sign (donut sign) in the right upper quadrant — transverse view of the intussuscepted bowel with concentric rings. Trace free fluid. Consistent with ileocolic intussusception. Ultrasound is the diagnostic modality of choice.', phases: [0, 1] },
      axr: { finding: 'Non-specific — early. May show a soft-tissue mass and absence of gas in the ascending colon. (Ultrasound is first-line.)', phases: [0, 1] },
      'ct_abdo': { finding: 'Not indicated in children with a diagnostic ultrasound — radiation exposure. Reserved for unclear adult presentations.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Ileocolic intussusception',
      aliases: ['intussusception', 'intussuscept', 'telescoping bowel', 'target sign'],
      differentials: [
        { dx: 'Intussusception', why: 'Age 6-36 months, cyclical screaming with leg-drawing, red currant jelly stool, sausage mass, recent viral illness' },
        { dx: 'Gastroenteritis', why: 'Vomiting and blood in stool — but the cyclical pain pattern and listlessness point to obstruction' },
        { dx: 'Malrotation with volvulus', why: 'Bilious vomiting in a distressed infant — Doppler/ultrasound distinguishes' },
        { dx: 'Incarcerated hernia', why: 'Examine the inguinal canals in every child with abdominal pain' },
        { dx: 'Henoch-Schönlein purpura', why: 'Can cause colicky pain and bloody stool — but the mass and age pattern favour intussusception' }
      ]
    },
    management: [
      { id: 'abc_resus', type: 'procedure', label: 'ABC + IV access + fluid bolus (20mL/kg) — shocked toddler', withinMin: 15, critical: true, points: 12 },
      { id: 'bloods', type: 'lab', label: 'FBC, U&E, glucose, group & save', withinMin: 30, points: 6 },
      { id: 'ultrasound', type: 'imaging', item: 'us_abdo', label: 'Ultrasound abdomen (diagnostic modality of choice)', withinMin: 60, critical: true, points: 10 },
      { id: 'surgical_referral', type: 'procedure', label: 'Immediate paediatric surgical referral', withinMin: 45, critical: true, points: 12 },
      { id: 'air_enema', type: 'procedure', label: 'Pneumatic (air) enema reduction — the treatment of choice if no peritonitis', withinMin: 120, critical: true, points: 14 },
      { id: 'surgery', type: 'procedure', label: 'Laparotomy/laparoscopy if enema reduction fails or perforation/peritonitis', withinMin: 300, points: 8 },
      { id: 'admit', type: 'admit', label: 'Admit for observation (recurrence risk 10%)', withinMin: 240, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Intussusception — viable bowel', maxMin: 120, timeoutNext: 1, description: 'The window for non-operative reduction is measured in hours.' },
      { id: 1, name: 'Ischaemia developing', maxMin: 120, timeoutNext: 2, description: 'Bowel oedema rising, child more shocked — reduction is getting harder and riskier.' },
      { id: 2, name: 'Bowel necrosis / perforation', maxMin: 120, timeoutNext: 'death', description: 'Peritonitic toddler — emergency surgery and possible resection.' },
      { id: 'stable', name: 'Post-reduction', recovery: true, vitals: { hr: 116, sbp: 92, dbp: 58, rr: 24, temp: 37.1, spo2: 98, gcs: 15, pain: 2 }, description: 'Air enema reduction successful on first attempt — the mass disappeared under fluoroscopy and Theo passed a normal stool. Drinking milk and smiling. Observed 24h for recurrence.' }
    ],
    interventions: {
      'sodium chloride 0.9%': { sbp: 10, hr: -14 }
    },
    complications: [
      { id: 'perforation', name: 'Perforation during/after reduction', trigger: { phase: 1, afterMin: 60, chance: 0.25 }, description: 'Sudden deterioration during enema reduction — tension on ischaemic bowel. Immediate surgery.' },
      { id: 'recurrence', name: 'Recurrence of intussusception', trigger: { phase: 'stable', afterMin: 720, chance: 0.1 }, description: 'The screaming pattern returns within 24 hours — 10% recur. Repeat enema or surgery.' }
    ],
    rubric: {
      history: { points: 12, criteria: ['Cyclical pain pattern identified', 'Red currant jelly stool recognised', 'Listlessness between episodes', 'Recent viral illness (lead point hyperplasia)'] },
      examination: { points: 12, criteria: ['Sausage mass sought and found', 'Dance sign awareness', 'Hydration and shock assessment', 'Hernial orifices checked'] },
      investigations: { points: 10, criteria: ['Ultrasound as first-line', 'Group & save', 'No unnecessary CT radiation'] },
      diagnosis: { points: 12, criteria: ['Intussusception identified early', 'Distinguished from gastroenteritis'] },
      management: { points: 20, criteria: ['Fluid resuscitation', 'Surgical referral', 'Air enema reduction', 'Surgery when indicated'] },
      safety: { points: 10, criteria: ['Shock treated before imaging', 'Correct fluid volumes for age/weight', 'Peritonitis recognised as surgical emergency'] },
      communication: { points: 10, criteria: ['Explains air enema to parents', 'Consent for reduction and possible surgery', 'Recurrence warning given'] },
      documentation: { points: 4, criteria: ['Mass and stool findings documented'] },
      timeliness: { points: 10, criteria: ['Ultrasound within 60 minutes', 'Reduction attempted within 2 hours'] }
    },
    debrief: {
      summary: 'Ileocolic intussusception: telescoping of bowel into itself, typically at 6-36 months after a viral illness (Peyer patch hyperplasia acting as a lead point). The triad is cyclical screaming with leg-drawing, vomiting, and red currant jelly stools. Diagnosis is by ultrasound (target sign); treatment is pneumatic enema reduction, with surgery for failures and complications.',
      learningPoints: [
        'The classic triad (cyclical pain, vomiting, red currant jelly stool) is complete in only a minority — a high index of suspicion saves bowels.',
        'A child who is listless BETWEEN screaming attacks is more worrying than one who screams constantly.',
        'Ultrasound target sign is diagnostic — no CT needed in children.',
        'Pneumatic enema reduction succeeds in ~80% when performed within 24 hours of onset; success falls steeply with delay.',
        'Resuscitate BEFORE reduction — the child is volume-depleted from third-space losses and vomiting.',
        '10% recur — admit for 24 hours observation after successful reduction.',
        'In children over 3 years, consider a pathological lead point (lymphoma, Meckel diverticulum).'
      ],
      references: ['ESPES guidelines — intussusception in children', 'NICE guideline NG51 — gastrointestinal tract obstruction']
    },
    theatre: {
      procedure: 'Laparotomy / laparoscopy: manual untwisting of the intussuscepted bowel, resection of non-viable segment with primary anastomosis if required',
      anaesthesia: 'General anaesthesia with muscle relaxation; caudal or TAP block for postoperative analgesia; aggressive warming (forced-air blanket), age-adjusted fluid resuscitation continued intra-operatively',
      asa: 'ASA III (18-month-old, dehydrated and shocked on arrival — resuscitated before induction)',
      risks: [
        'Bleeding',
        'Surgical site infection',
        'Bowel resection with primary anastomosis (or stoma if unstable)',
        'Anastomotic leak',
        'Injury to bowel or mesenteric vessels during untwisting',
        'Hypothermia and fluid shifts in a small child',
        'General anaesthetic risks in a shocked toddler',
        'Need for paediatric intensive care post-operatively'
      ],
      steps: [
        'WHO sign-in: identity confirmed with parent present and armbands checked, procedure, allergies, airway risk, blood loss plan',
        'Consent verified with parent — including risk of bowel resection, stoma and possible conversion',
        'Prophylactic antibiotics given within 60 minutes of incision',
        'Time-out: team introductions, ultrasound displayed, peritonitis status confirmed',
        'Induction of anaesthesia with rapid-sequence considerations; NG decompression; warming mattress and fluids running',
        'Laparotomy (or laparoscopy) — deliver the intussuscepted ileocolic segment onto the wound',
        'Manual untwisting — gentle retrograde pressure; assess bowel viability and mesenteric vessels',
        'Resection of non-viable bowel with primary anastomosis (or stoma if the child is unstable)',
        'Examine for a pathological lead point (Meckel diverticulum, lymphoma) and treat accordingly',
        'Haemostasis, swab and instrument counts, wound closure',
        'Sign-out: procedure recorded, counts correct, specimen labelled, key concerns for paediatric recovery',
        'Extubation and transfer to paediatric recovery with full monitoring'
      ]
    }
  }
},

// ═══════════════════ CASE 17: CROUP ═══════════════════
{
  key: 'croup-2y-stridor',
  title: 'A barking cough in the night',
  specialty: 'paediatrics',
  difficulty: 'undergraduate',
  scenario_type: 'paediatric',
  description: 'A two-year-old wakes at midnight with a seal-like barking cough, inspiratory stridor and a hoarse cry. Worse at night, worse when upset.',
  scenario: {
    patient: { name: 'Elsie Moreau', age: 2, sex: 'F', occupation: 'Toddler', city: 'Pinecrest' },
    presentation: { setting: 'Emergency & Trauma Department (paediatric area)', triage: 'category 2', initial: 'Elsie sits upright on her mother\'s lap, frightened, with a harsh barking cough that sounds like a seal. She has inspiratory stridor at rest and a hoarse cry. Mum: "It came on at bedtime — she had a mild cold all day, then suddenly this bark. It is worse when she cries."' },
    history: {
      complaint: 'Barking cough, stridor and hoarseness',
      pmh: ['Born at term', 'Fully vaccinated', 'No previous croup episodes'],
      meds: ['None'],
      allergies: [],
      family: ['Both parents had colds last week'],
      social: { notes: 'Autumn evening. Child is clingy and frightened; crying makes the stridor dramatically worse. Not drooling, able to swallow saliva, no high fever.' }
    },
    emotions: { pain: 1, anxiety: 10, confusion: 0, paediatric_parent: true },
    interview: [
      { tags: ['onset_parent'], match: ['when','start','begin','how long','tonight'], a: '(Mother) She had a run-of-the-mill cold all day — bit of a snotty nose, nothing more. At bedtime she was fine. At midnight I heard this... barking. Like a seal. It scared us both half to death.', speaker: 'mother' },
      { tags: ['sound_parent'], match: ['cough','bark','seal','sound','noise','stridor'], a: '(Mother) A harsh bark — seal-like is exactly what the internet said when I searched it. And when she breathes IN there is a high-pitched noise. Her cry has gone hoarse too.', speaker: 'mother' },
      { tags: ['worse_factors'], match: ['worse','upset','cry','night','lying','better'], a: '(Mother) Definitely worse when she cries — the noise gets louder and scarier. Better when she calms down and I hold her still. It also seems worse lying down; sitting her upright helps.', speaker: 'mother' },
      { tags: ['drooling_parent'], match: ['drool','drooling','swallow','saliva','spit'], a: '(Mother) No drooling — she swallows normally. She even drank some water in the car.', speaker: 'mother' },
      { tags: ['fever_parent'], match: ['fever','temperature','hot'], a: '(Mother) Mildly warm — 37.7 or so. Nothing like the fevers she had with her ear infections.', speaker: 'mother' },
      { tags: ['breathing_parent'], match: ['breath','breathe','struggle','hard','fast'], a: '(Mother) She is working harder than normal — her ribs pull in a bit when she breathes in. But she is pink and she is drinking.', speaker: 'mother' },
      { tags: ['vaccines_parent'], match: ['vaccin','immunis','jabs','hib'], a: '(Mother) All up to date, including the Hib one — I remember because she had a reaction to the first dose (mild fever, nothing serious).', speaker: 'mother' },
      { tags: ['previous_parent'], match: ['before','previous','ever','last time'], a: '(Mother) First time anything like this. She has had three colds in her life, that is all.', speaker: 'mother' }
    ],
    exam: {
      general: 'Sitting upright on mother\'s lap, frightened but alert. Hoarse cry. Intermittent barking cough during examination.',
      systems: {
        respiratory: 'Inspiratory STRIDOR AT REST. Mild subcostal recession. Tracheal tug. Air entry good bilaterally, no crackles or wheeze. SpO2 94% in air. NOT drooling. Able to swallow.',
        ent: 'No tonsillar swelling or membrane. No trismus. Mouth moist.',
        cardiovascular: 'HR 148 (fear + work of breathing). CRT 2s.',
        neuro: 'Alert, clingy, appropriate. No toxicity.'
      }
    },
    baselineVitals: { hr: 148, sbp: 92, dbp: 56, rr: 34, temp: 37.7, spo2: 94, gcs: 15, pain: 1 },
    labs: {
      baseline: { note: 'Croup is a clinical diagnosis — bloods and imaging are NOT indicated and distress the child unnecessarily.' }
    },
    imaging: {
      cxr: { finding: 'Not indicated. Neck X-ray (if ever obtained) may show the steeple sign — subglottic narrowing. Clinical diagnosis beats radiology here.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Viral croup (laryngotracheobronchitis)',
      aliases: ['croup', 'laryngotracheobronchitis', 'viral croup', 'barking cough', 'steeple'],
      differentials: [
        { dx: 'Viral croup', why: 'Age 6 months-3 years, barking cough, stridor, worse at night and with crying, mild fever, preceding cold' },
        { dx: 'Epiglottitis', why: 'The killer to exclude: toxic, drooling, tripod posture, high fever, no barking cough — Hib vaccination makes it rare' },
        { dx: 'Bacterial tracheitis', why: 'Toxic-looking child, high fever, croupy cough that fails steroid therapy' },
        { dx: 'Inhaled foreign body', why: 'Sudden onset without prodrome, history of choking' },
        { dx: 'Angio-oedema / anaphylaxis', why: 'Rapid onset with urticaria, exposure history' }
      ]
    },
    management: [
      { id: 'keep_calm', type: 'procedure', label: 'Keep the child calm on parent\'s lap — distress worsens stridor (avoid examination of the throat!)', withinMin: 5, points: 8 },
      { id: 'steroids', type: 'drug', drugs: ['dexamethasone', 'prednisolone', 'hydrocortisone'], label: 'Corticosteroid — dexamethasone 0.15mg/kg PO (or prednisolone 1-2mg/kg); the cornerstone treatment', withinMin: 30, critical: true, points: 16 },
      { id: 'nebulised_epinephrine', type: 'drug', drugs: ['adrenaline'], label: 'Nebulised adrenaline (1:1000, 5mL) if severe stridor at rest / impending obstruction', withinMin: 30, points: 8 },
      { id: 'oxygen', type: 'oxygen', label: 'Oxygen if SpO2 <92% (but hypoxia is late — do not be reassured by normal saturations)', withinMin: 20, points: 4 },
      { id: 'monitoring', type: 'procedure', label: 'Continuous monitoring — any child with stridor at rest', withinMin: 30, points: 6 },
      { id: 'senior_escalation', type: 'procedure', label: 'Senior/anaesthetic review if severe (stridor at rest + recession + distress) — theatre on standby for intubation', withinMin: 60, points: 8 },
      { id: 'admit_observe', type: 'admit', label: 'Admit for observation if stridor persists at rest or poor oral intake', withinMin: 180, points: 5 },
      { id: 'discharge_safety', type: 'procedure', label: 'Discharge with safety-netting only when stridor resolved at rest, drinking, steroids given', withinMin: 300, points: 5 }
    ],
    phases: [
      { id: 0, name: 'Croup — moderate severity', maxMin: 120, timeoutNext: 1, description: 'Stridor at rest with recession — needs steroids promptly and monitoring.' },
      { id: 1, name: 'Severe croup / impending obstruction', maxMin: 60, timeoutNext: 2, description: 'Stridor at rest + marked recession + distress + rising HR. Nebulised adrenaline and anaesthetic help NOW.' },
      { id: 2, name: 'Airway obstruction', maxMin: 30, timeoutNext: 'death', description: 'Exhausted child, silent chest, falling saturations — intubation by the most experienced person available.' },
      { id: 'stable', name: 'Recovered', recovery: true, vitals: { hr: 118, sbp: 94, dbp: 58, rr: 24, temp: 37.2, spo2: 97, gcs: 15, pain: 1 }, description: 'Dexamethasone given, stridor settled, drinking juice, barking at the nurses. Discharged after 4 hours observation with safety-netting advice.' }
    ],
    interventions: {
      'hydrocortisone': { rr: -4, hr: -10 }, 'prednisolone': { rr: -4, hr: -10 },
      'adrenaline': { rr: -6, spo2: 3 },
      oxygen: { spo2: 4 }
    },
    complications: [
      { id: 'obstruction', name: 'Complete airway obstruction', trigger: { phase: 1, afterMin: 45, ifNotDone: ['steroids'] }, vitals: { rr: 12, spo2: 72, gcs: 9, hr: 90 }, description: 'Exhausted child, stridor softening (a QUIETENING stridor is a WARNING, not improvement), saturations falling. Intubate.' }
    ],
    rubric: {
      history: { points: 12, criteria: ['Barking cough characterised', 'Worse with crying/night identified', 'Epiglottitis red flags excluded (drooling, toxicity)', 'Vaccination status (Hib) confirmed'] },
      examination: { points: 12, criteria: ['Stridor at rest graded', 'Recursion/work of breathing assessed', 'Throat NOT examined (risk of obstruction)', 'Hydration and swallowing assessed'] },
      investigations: { points: 6, criteria: ['No unnecessary bloods or X-rays', 'Recognises croup as clinical diagnosis'] },
      diagnosis: { points: 12, criteria: ['Croup identified', 'Epiglottitis/bacterial tracheitis differentiated'] },
      management: { points: 20, criteria: ['Child kept calm', 'Dexamethasone given', 'Nebulised adrenaline if severe', 'Anaesthetic escalation plan'] },
      safety: { points: 10, criteria: ['Never examines the throat', 'Recognises quietening stridor as danger', 'Appropriate monitoring'] },
      communication: { points: 10, criteria: ['Explains illness to parents', 'Keeps child calm with parent present', 'Clear discharge safety-netting'] },
      documentation: { points: 4, criteria: ['Severity grading documented'] },
      timeliness: { points: 14, criteria: ['Steroids within 30 minutes'] }
    },
    debrief: {
      summary: 'Viral croup (laryngotracheobronchitis): subglottic inflammation of a young child\'s narrow airway, presenting with barking cough, inspiratory stridor and hoarseness, worse at night and with distress. Treatment is a single dose of dexamethasone — one of the highest-value interventions in all of paediatrics — with nebulised adrenaline and anaesthetic support for severe cases.',
      learningPoints: [
        'Dexamethasone 0.15mg/kg orally is the cornerstone: it reduces severity, hospitalisation and return visits — give it to EVERY child with croup, even mild.',
        'Never examine the throat of a child with stridor — instrumentation can precipitate complete obstruction.',
        'A quietening stridor in a tiring child is deterioration, not improvement.',
        'Epiglottitis is the differential that kills: toxic, drooling, tripod, no bark — call anaesthetics, do not lie the child flat, do not examine.',
        'Keep the child on the parent\'s lap — a calm child is a child with a patent airway.',
        'Nebulised adrenaline (1:1000) buys time in severe croup but wears off in 2 hours — observe for rebound.',
        'SpO2 is a late sign in upper airway obstruction — normal saturations do not mean a safe airway.'
      ],
      references: ['NICE guideline — croup in children', 'Cochrane review — steroids for croup']
    }
  }
},

// ═══════════════════ CASE 18: KAWASAKI DISEASE ═══════════════════
{
  key: 'kawasaki-3y-fever',
  title: 'Five days of fever in a three-year-old',
  specialty: 'paediatrics',
  difficulty: 'specialist',
  scenario_type: 'clinical',
  description: 'A three-year-old has had high fever for five days, red eyes, a strawberry tongue, swollen hands and a rash. Missing the diagnosis risks coronary aneurysms.',
  scenario: {
    patient: { name: 'Aria Kohistani', age: 3, sex: 'F', occupation: 'Nursery child', city: 'Aurelia City' },
    presentation: { setting: 'Paediatric Assessment Unit', triage: 'category 3', initial: 'Aria is miserable and irritable, lying listlessly on the trolley. Her eyes are bright red without discharge, her lips are cracked, and her tongue looks like a strawberry. Her mother says the fever will not break — "Five days. Nothing touches it. And now her hands are puffy."' },
    history: {
      complaint: 'Five days of high fever, red eyes, rash, swollen hands',
      pmh: ['Normal birth and development', 'Fully vaccinated', 'No allergies'],
      meds: ['Paracetamol and ibuprofen at home — no effect on fever'],
      allergies: [],
      family: ['No family history of note'],
      social: { notes: 'No travel. No pets. No sick contacts. No immunisations in the last month. Nursery attendee. The fever has not responded to antipyretics — a red flag.' }
    },
    emotions: { pain: 3, anxiety: 8, confusion: 0, paediatric_parent: true },
    interview: [
      { tags: ['onset_parent'], match: ['when','start','how long','fever','days'], a: '(Mother) Five days now. It spikes to 39.5, sometimes 40. Calpol and ibuprofen bring it down half a degree for an hour, then it roars back. The doctor saw her on day two and said viral.', speaker: 'mother' },
      { tags: ['eyes_parent'], match: ['eye','red','conjunctiv','discharge','pussy'], a: '(Mother) Both eyes went bright red on day two — bloodshot all over, but NO discharge, no pus, nothing sticky. She is not rubbing them like conjunctivitis.', speaker: 'mother' },
      { tags: ['mouth_parent'], match: ['mouth','lip','tongue','throat','strawberry','cracked'], a: '(Mother) Her lips are dry and cracked — they bleed a little. Her tongue has gone all bumpy and red like a strawberry. She will not eat or drink properly.', speaker: 'mother' },
      { tags: ['rash_parent'], match: ['rash','skin','spots','blister','itch'], a: '(Mother) A rash came on day three — blotchy red patches over her trunk and nappy area, especially the groin. It does not itch and there are no blisters. It fades when you press it.', speaker: 'mother' },
      { tags: ['hands_parent'], match: ['hand','feet','swell','puffy','peel','desquam'], a: '(Mother) Her hands and feet are puffy — she could not wear her shoes yesterday. And this morning the skin at the tips of her fingers looked like it was starting to peel.', speaker: 'mother' },
      { tags: ['neck_parent'], match: ['neck','gland','lump','swollen node','lymph'], a: '(Mother) There is a lump on the left side of her neck — about the size of a walnut, firm. The doctor last time called it a swollen gland.', speaker: 'mother' },
      { tags: ['behaviour_parent'], match: ['behaviour','irritable','clingy','lethargic','not herself'], a: '(Mother) She is NOT herself — incredibly irritable, inconsolable, then floppy. Much more unwell than any virus she has had.', speaker: 'mother' },
      { tags: ['infection_parent'], match: ['infection','antibiotic','sore throat','ear','cough','cold'], a: '(Mother) No cough, no runny nose, no ear pulling, no trouble weeing. The GP gave antibiotics on day three in case it was a throat infection — no change whatsoever.', speaker: 'mother' }
    ],
    exam: {
      general: 'Toxic-looking, irritable child. Fever 39.8°C despite antipyretics. Markedly unwell but no focal infection.',
      systems: {
        ent: 'Bilateral NON-PURULENT conjunctival injection. Dry cracked lips with fissures. Strawberry tongue — prominent papillae on an injected tongue. Oropharynx red without exudate.',
        lymph: 'Single left cervical lymph node, 2.5cm, firm, non-fluctuant.',
        skin: 'Polymorphous erythematous rash over trunk and groin (blanches). Indurative oedema of hands and feet. Early periungual desquamation of fingertips.',
        cardiovascular: 'HR 156 — tachycardic out of proportion to fever. BP 88/54. No murmurs. Pulses bounding and symmetrical.',
        respiratory: 'RR 28. Clear chest.',
        neuro: 'Irritable but no meningism. No focal signs. (Meningeal irritation can occur in Kawasaki — aseptic meningitis.)'
      }
    },
    baselineVitals: { hr: 156, sbp: 88, dbp: 54, rr: 28, temp: 39.8, spo2: 97, gcs: 15, pain: 3 },
    labs: {
      baseline: { wcc: 17.8, hb: 108, platelets: 620, crp: 148, esr: 78, na: 132, k: 4.0, urea: 5.2, creatinine: 28, alt: 96, albumin: 28, 'urinalysis': 'Sterile pyuria (WCC positive, no nitrites, culture negative) — a classic Kawasaki finding', nose_throat_note: 'Viral swabs negative', echo_note: 'Echocardiogram booked — coronary arteries NOT yet assessed' },
      phases: { 1: { platelets: 820, crp: 190, echo_note: 'Echocardiogram: mild dilation of the left main coronary artery (z-score 2.6) — evolving coronary involvement' } }
    },
    imaging: {
      echo: { finding: 'Baseline echocardiogram: mild ectasia of the left main coronary artery. No aneurysms yet. Aortic root normal. Pericardium normal. (Serial echoes are essential — coronary changes evolve over 4-6 weeks.)', phases: [0, 1] },
      'us_abdo': { finding: 'Normal abdominal ultrasound. Gallbladder hydrops (distension without stones) may be seen in Kawasaki — not present here.', phases: [0, 1] }
    },
    hidden: {
      diagnosis: 'Kawasaki disease (incomplete features evolving to complete)',
      aliases: ['kawasaki', 'mucocutaneous lymph node syndrome'],
      differentials: [
        { dx: 'Kawasaki disease', why: '5+ days of fever PLUS four features: non-purulent conjunctivitis, oral changes, extremity changes, rash, cervical node — and no response to antibiotics' },
        { dx: 'Scarlet fever', why: 'Strawberry tongue overlaps — but no purulent tonsillitis and no response to antibiotics' },
        { dx: 'Viral illness (adenovirus, measles)', why: 'Fever and conjunctivitis — but no respiratory prodrome, no Koplik spots, features too persistent' },
        { dx: 'Stevens-Johnson syndrome', why: 'Mucosal involvement — but no drug exposure, no skin blistering' },
        { dx: 'Juvenile idiopathic arthritis (systemic)', why: 'Fever + rash — but the rash is evanescent, and extremity changes/sterile pyuria point to Kawasaki' }
      ]
    },
    management: [
      { id: 'recognise', type: 'procedure', label: 'Recognise 5 days of fever + ≥4 features = complete Kawasaki (or incomplete with raised CRP/ESR + echo)', withinMin: 60, critical: true, points: 16 },
      { id: 'bloods_inflamm', type: 'lab', label: 'FBC (thrombocytosis), CRP + ESR, LFTs, urinalysis (sterile pyuria)', withinMin: 90, points: 8 },
      { id: 'echo', type: 'imaging', item: 'echo', label: 'Baseline echocardiogram — coronary assessment', withinMin: 240, critical: true, points: 10 },
      { id: 'ivig', type: 'drug', drugs: ['immunoglobulin'], label: 'IV immunoglobulin 2g/kg single infusion within 10 days (ideally days 5-7)', withinMin: 480, critical: true, points: 18 },
      { id: 'aspirin', type: 'drug', drugs: ['aspirin'], label: 'Aspirin — anti-inflammatory dose (30-50mg/kg/day in UK practice) then low-dose antiplatelet once afebrile', withinMin: 480, points: 10 },
      { id: 'cardiology_followup', type: 'procedure', label: 'Serial echocardiography (weeks 2 and 6) + cardiology follow-up', withinMin: 1440, points: 6 },
      { id: 'admit', type: 'admit', label: 'Admit under paediatrics', withinMin: 120, points: 5 },
      { id: 'no_steroids', type: 'procedure', label: 'Avoid corticosteroids as first-line (IVIG-refractory disease only) — and note aspirin + ibuprofen interaction (stop ibuprofen)', withinMin: 480, points: 6 }
    ],
    phases: [
      { id: 0, name: 'Diagnostic window — days 5-7', maxMin: 480, timeoutNext: 1, description: 'IVIG within the first 10 days reduces coronary aneurysm risk five-fold. The clock is running.' },
      { id: 1, name: 'Untreated evolution', maxMin: 480, timeoutNext: 2, description: 'Platelets climbing, coronary arteries dilating. Every day untreated raises aneurysm risk.' },
      { id: 2, name: 'Coronary artery disease established', maxMin: 720, description: 'Aneurysms formed — lifelong cardiology, anticoagulation risk, and the spectre of childhood MI.' },
      { id: 'stable', name: 'Post-IVIG recovery', recovery: true, vitals: { hr: 112, sbp: 90, dbp: 56, rr: 22, temp: 37.1, spo2: 98, gcs: 15, pain: 1 }, description: 'IVIG 2g/kg given on day 6, aspirin started, ibuprofen stopped. Afebrile within 24h. Serial echoes at 2 and 6 weeks normal. Low-dose aspirin continues for 6 weeks.' }
    ],
    interventions: {},
    complications: [
      { id: 'coronary_aneurysm', name: 'Coronary artery aneurysm', trigger: { phase: 1, afterMin: 360, ifNotDone: ['ivig'] }, description: 'Echo shows a 5mm saccular aneurysm of the right coronary artery. This is the complication the whole treatment pathway exists to prevent — lifelong cardiology follow-up and antithrombotic therapy.' },
      { id: 'ivig_refractory', name: 'IVIG-refractory fever', trigger: { phase: 'stable', afterMin: 1440, chance: 0.15 }, description: 'Fever returns within 36 hours of IVIG in 10-20% of children — second IVIG dose, steroids or infliximab needed. Treatment resistance is itself a risk factor for aneurysms.' }
    ],
    rubric: {
      history: { points: 12, criteria: ['Fever duration quantified (≥5 days)', 'Feature inventory: eyes, mouth, rash, extremities, node', 'Antibiotic non-response noted', 'No response to antipyretics'] },
      examination: { points: 12, criteria: ['Non-purulent conjunctivitis documented', 'Oral changes documented', 'Extremity changes (oedema/peeling)', 'Cervical node measured'] },
      investigations: { points: 12, criteria: ['CRP + ESR', 'Platelet count (thrombocytosis)', 'Sterile pyuria on urinalysis', 'Echocardiogram ordered'] },
      diagnosis: { points: 14, criteria: ['Kawasaki disease identified', 'Incomplete vs complete recognised', 'Scarlet fever/viral illness differentiated'] },
      management: { points: 22, criteria: ['IVIG 2g/kg within 10 days', 'Aspirin dosing (anti-inflammatory then antiplatelet)', 'Ibuprofen stopped with aspirin', 'Serial echo planning'] },
      safety: { points: 10, criteria: ['No corticosteroids first-line', 'Aspirin-ibuprofen interaction avoided', 'Reye syndrome counselling for aspirin in children'] },
      communication: { points: 8, criteria: ['Explains coronary risk honestly', 'Long-term follow-up plan explained', 'Vaccination timing after IVIG (live vaccines delayed 11 months)'] },
      documentation: { points: 4, criteria: ['Diagnostic criteria tally documented'] },
      timeliness: { points: 6, criteria: ['IVIG within 10 days of fever onset'] }
    },
    debrief: {
      summary: 'Kawasaki disease: fever for ≥5 days with ≥4 of the five features (bilateral non-purulent conjunctivitis, oral mucosal changes, peripheral extremity changes, polymorphous rash, cervical lymphadenopathy) — or incomplete disease with supportive labs. Treatment within 10 days (IVIG 2g/kg + aspirin) reduces the coronary aneurysm risk from ~25% to under 5%.',
      learningPoints: [
        'Fever for five days that does not respond to antipyretics or antibiotics is Kawasaki until proven otherwise.',
        'The five features: red eyes WITHOUT pus, cracked lips and strawberry tongue, puffy then peeling hands and feet, blanching polymorphous rash (worst in the groin), and a single large cervical node.',
        'Thrombocytosis after day 7 is a hallmark — platelets here are 620 and climbing.',
        'Sterile pyuria (WCC in urine, negative culture) is a classic supportive finding.',
        'IVIG 2g/kg within 10 days is one of paediatrics\' great interventions — coronary aneurysm risk falls five-fold.',
        'Aspirin: anti-inflammatory dose while febrile, then low-dose antiplatelet for ~6 weeks. NEVER combine with ibuprofen (interaction, and NSAIDs blunt aspirin effect).',
        'Live vaccines are delayed for 11 months after IVIG (passive antibody interference).',
        'IVIG-refractory disease (10-20%) needs second-dose IVIG, steroids or infliximab — refractoriness itself predicts aneurysms.'
      ],
      references: ['AHA scientific statement — diagnosis and treatment of Kawasaki disease', 'RCPSCH guidance — Kawasaki disease']
    }
  }
}
];

module.exports = { CASES_PART4 };
