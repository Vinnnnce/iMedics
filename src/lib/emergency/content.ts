/**
 * Emergency Response and Life Support learning centre content.
 *
 * SOURCES (current at the last-reviewed date below):
 *  - American Heart Association, "Part 7: Adult Basic Life Support" and
 *    "Part 9: Adult Advanced Life Support", 2025 Guidelines for CPR and ECC
 *    (published October 2025).
 *  - European Resuscitation Council, Guidelines 2025: Adult Basic Life Support
 *    and Adult Advanced Life Support.
 *
 * This material is EDUCATIONAL ONLY. It does not replace certified BLS/ACLS
 * training, local protocols or dispatcher instructions. In a real emergency,
 * call your local emergency number immediately.
 */

export const EMERGENCY_BANNER = {
  title: "In a real emergency, call for help first",
  body: "Educational information is not a substitute for professional medical care. In a life-threatening emergency, contact your local emergency services immediately. Do not delay emergency assistance to watch a video or use this website.",
};

export interface ModuleStep {
  title: string;
  body: string;
  /** Professional-only steps are visually flagged and kept separate from lay guidance. */
  professionalOnly?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface EmergencyModule {
  id: string;
  track: "BLS" | "ALS";
  title: string;
  summary: string;
  minutes: number;
  steps: ModuleStep[];
  checklist?: string[];
  quiz?: QuizQuestion[];
}

export const GUIDELINE_SOURCE = "American Heart Association 2025 Guidelines for CPR and ECC; European Resuscitation Council Guidelines 2025";
export const LAST_REVIEWED = "2026-10-18";

export const EMERGENCY_MODULES: EmergencyModule[] = [
  {
    id: "recognise-arrest",
    track: "BLS",
    title: "1. Recognising cardiac arrest",
    summary: "How to recognise an unresponsive adult with suspected cardiac arrest, and why calling for help comes first.",
    minutes: 5,
    steps: [
      {
        title: "Check the scene, then the person",
        body: "Approach only if it is safe for you and the person. Sudden collapse, unresponsiveness and absent or abnormal (gasping, slow) breathing are the hallmarks of cardiac arrest. Athletes may show near-normal or panting breathing early after collapse.",
      },
      {
        title: "Call the emergency number for any unresponsive person",
        body: "The 2025 ERC guidance is to call the emergency services for ANY unresponsive person — you no longer need to confirm abnormal breathing before calling. Make the call first, then assess breathing while waiting; the call handler will help you recognise abnormal breathing and guide you through CPR.",
      },
      {
        title: "Do not delay",
        body: "Survival falls by roughly 7–10% for every minute without CPR and defibrillation. Early recognition, early CPR and early defibrillation are the interventions that most improve survival.",
      },
    ],
    checklist: [
      "Scene is safe for me to approach",
      "Person is unresponsive",
      "Emergency number has been called",
      "AED is being sent for or located",
    ],
    quiz: [
      {
        question: "You find an adult collapsed and unresponsive. What should you do first?",
        options: ["Start chest compressions immediately", "Call the emergency number and follow dispatcher instructions", "Give rescue breaths", "Look for an AED before calling"],
        correctIndex: 1,
        explanation: "For a lone responder, the 2025 guidelines direct you to activate the emergency response system first, then begin CPR. Call handlers can coach you.",
      },
    ],
  },
  {
    id: "scene-safety",
    track: "BLS",
    title: "2. Ensuring the scene is safe",
    summary: "Protecting yourself and the person before starting resuscitation.",
    minutes: 3,
    steps: [
      {
        title: "Stop and look",
        body: "Traffic, electricity, fire, water, unstable surfaces or hostile people can make a scene dangerous. If it is not safe, do not approach — call the emergency services and secure the area first.",
      },
      {
        title: "Use personal protective equipment when available",
        body: "The 2025 AHA guidelines state it is reasonable to use PPE (for example a CPR face shield or gloves) during CPR if available.",
      },
      {
        title: "Move the person only if needed",
        body: "Resuscitation should generally happen where the person is found, provided high-quality CPR can be delivered safely there. Move the person only if the location prevents CPR (for example danger, or no firm surface).",
      },
    ],
  },
  {
    id: "check-response-breathing",
    track: "BLS",
    title: "3. Checking responsiveness and breathing",
    summary: "How to assess an unresponsive adult without delaying help.",
    minutes: 4,
    steps: [
      {
        title: "Shout and tap",
        body: "Tap the person's shoulders firmly and shout \"Are you all right?\". No response means unresponsive.",
      },
      {
        title: "Look for normal breathing",
        body: "Open the airway with a head tilt–chin lift (jaw thrust if head or neck trauma is suspected) and look for normal breathing for no more than 10 seconds. Gasping, slow or noisy breathing is NOT normal breathing — treat it as cardiac arrest.",
      },
      {
        title: "Healthcare professionals: simultaneous pulse check",
        body: "Trained healthcare providers may check a carotid pulse at the same time as assessing breathing, taking no more than 10 seconds. If there is no pulse or you are unsure, start CPR. Lay rescuers should not delay for a pulse check.",
        professionalOnly: true,
      },
    ],
    quiz: [
      {
        question: "A person is unresponsive and breathing slowly and noisily (gasping). What does this mean?",
        options: ["They are breathing normally — monitor them", "This is a sign of cardiac arrest — start CPR", "Put them in the recovery position", "Give them water"],
        correctIndex: 1,
        explanation: "Gasping or abnormal breathing in an unresponsive person is a sign of cardiac arrest. Start CPR and call the emergency services.",
      },
    ],
  },
  {
    id: "activate-help",
    track: "BLS",
    title: "4. Activating emergency services and getting an AED",
    summary: "Getting professional help and a defibrillator on the way.",
    minutes: 4,
    steps: [
      {
        title: "Lone rescuer: call first",
        body: "After identifying an adult in cardiac arrest, a lone responder should activate the emergency response system FIRST, then immediately begin CPR. If others are present, send someone else to call and to fetch the nearest AED.",
      },
      {
        title: "Use a speakerphone",
        body: "Put the phone on speaker so the dispatcher can hear you and coach you through CPR and AED use while your hands stay free.",
      },
      {
        title: "Find the AED",
        body: "Public buildings often have AEDs near entrances or reception. The emergency dispatcher may know the nearest one. Every minute without defibrillation reduces survival.",
      },
    ],
  },
  {
    id: "high-quality-cpr",
    track: "BLS",
    title: "5. Starting high-quality CPR",
    summary: "The core skill: effective chest compressions.",
    minutes: 6,
    steps: [
      {
        title: "Position",
        body: "Kneel beside the person's chest with the person on a firm surface, and with the person's torso at approximately the level of your knees. Place the heel of one hand on the centre of the chest (lower half of the breastbone), the other hand on top, fingers interlocked and off the ribs.",
      },
      {
        title: "Push hard and fast",
        body: "Compress at least 5 cm (2 inches) but not more than 6 cm (2.4 inches) deep, at a rate of 100–120 compressions per minute. Let the chest fully recoil between compressions; leaning on the chest prevents recoil.",
      },
      {
        title: "Minimise interruptions",
        body: "Aim for a compression fraction of at least 60%. Pause only for AED analysis and shock delivery, and swap rescuers every 2 minutes to avoid fatigue.",
      },
      {
        title: "Hands-Only CPR",
        body: "If you are untrained, unwilling or unable to give rescue breaths, give continuous chest compressions (Hands-Only CPR) — it is far better than nothing. Trained rescuers may give 30 compressions to 2 breaths.",
      },
    ],
    checklist: [
      "Heel of hand on the centre of the chest",
      "Depth 5–6 cm, rate 100–120/min",
      "Full recoil between compressions",
      "Interruptions minimised",
    ],
    quiz: [
      {
        question: "What is the correct compression rate and depth for an adult?",
        options: ["60–80/min, 3 cm", "100–120/min, 5–6 cm", "100–120/min, 2 cm", "As fast as possible, as deep as possible"],
        correctIndex: 1,
        explanation: "Adult compressions: 100–120 per minute, 5–6 cm (about 2 inches) deep, allowing full recoil.",
      },
    ],
  },
  {
    id: "rescue-breaths",
    track: "BLS",
    title: "6. Rescue breaths and ratios",
    summary: "Ventilation for trained rescuers.",
    minutes: 4,
    steps: [
      {
        title: "Open the airway",
        body: "Head tilt–chin lift (or jaw thrust if head or neck trauma is suspected).",
      },
      {
        title: "Give 2 breaths after every 30 compressions",
        body: "Each breath should take about 1 second and produce visible chest rise. Avoid excessive ventilation — hyperventilation harms.",
      },
      {
        title: "Respiratory arrest with a pulse",
        body: "If the person is not breathing normally but has a pulse, healthcare professionals may give 1 breath every 6 seconds (10 breaths per minute), each producing visible chest rise.",
        professionalOnly: true,
      },
      {
        title: "Untrained? Compressions only",
        body: "Hands-Only CPR is appropriate for untrained lay rescuers. Dispatchers may coach you through it.",
      },
    ],
  },
  {
    id: "aed-use",
    track: "BLS",
    title: "7. Using an AED",
    summary: "Safe, effective automated defibrillator use.",
    minutes: 5,
    steps: [
      {
        title: "Turn it on and follow the voice prompts",
        body: "AEDs are designed for untrained users. Turn it on and it will talk you through everything.",
      },
      {
        title: "Pad placement",
        body: "Bare the chest and attach the pads exactly as pictured on the pads — typically one below the right collarbone and one on the left side below the armpit. Do not place pads over medication patches or directly over an implanted device; place at least a few centimetres away.",
      },
      {
        title: "Clear and shock",
        body: "Ensure nobody touches the person while the AED analyses the rhythm and delivers a shock — say \"ALL CLEAR\" loudly and check before pressing the shock button.",
      },
      {
        title: "Resume CPR immediately after the shock",
        body: "Continue compressions straight after the shock (or after a \"no shock advised\" prompt) and keep following the AED's voice prompts until professional help takes over.",
      },
    ],
    quiz: [
      {
        question: "After an AED delivers a shock, what should you do?",
        options: ["Wait 2 minutes before touching the person", "Resume chest compressions immediately", "Check the pulse for a full minute", "Remove the pads"],
        correctIndex: 1,
        explanation: "Resume CPR immediately after a shock; the AED will re-analyse every 2 minutes.",
      },
    ],
  },
  {
    id: "continue-and-handover",
    track: "BLS",
    title: "8. Continuing CPR and handover",
    summary: "Persisting until professionals arrive, and when resuscitation may stop.",
    minutes: 4,
    steps: [
      {
        title: "Keep going",
        body: "Continue CPR and follow AED prompts until: emergency professionals take over, the person starts breathing normally or responding, an AED directs otherwise, or you are physically exhausted.",
      },
      {
        title: "Handover",
        body: "When emergency services arrive, tell them what you saw, how long CPR has been ongoing, how many shocks were given and any known history. Follow their instructions from that point.",
      },
      {
        title: "When resuscitation may stop",
        body: "For lay rescuers, stop only when professionals take over or you cannot continue. Decisions to terminate resuscitation are made by professionals using clinical criteria and local protocols — not by this tutorial.",
      },
      {
        title: "Look after yourself",
        body: "Witnessing or performing resuscitation can be distressing. The 2025 guidelines recognise that lay rescuers may benefit from support afterwards — consider talking to someone you trust or a support service.",
      },
    ],
  },
  {
    id: "als-concepts",
    track: "ALS",
    title: "Adult advanced life support: an introduction",
    summary: "An appropriately scoped overview of ALS for trained professionals.",
    minutes: 8,
    steps: [
      {
        title: "Who this is for",
        body: "ALS interventions — medications, advanced airways, rhythm-specific algorithms — are for appropriately trained healthcare professionals only. This module is an introduction, not a substitute for certified ALS training.",
      },
      {
        title: "Priorities",
        body: "The 2025 ERC ALS priorities: recognise cardiac arrest early, start high-quality CPR immediately, defibrillate shockable rhythms rapidly (systems should aim for under 3 minutes), give adrenaline early for non-shockable rhythms, and identify and treat reversible causes.",
      },
      {
        title: "Shockable vs non-shockable",
        body: "Pulseless ventricular tachycardia and ventricular fibrillation are shockable rhythms: defibrillate early. Asystole and pulseless electrical activity are non-shockable: high-quality CPR, adrenaline, and treat reversible causes.",
      },
    ],
  },
  {
    id: "als-airway",
    track: "ALS",
    title: "Airway management and oxygenation",
    summary: "Airway options during adult resuscitation.",
    minutes: 6,
    steps: [
      {
        title: "Basic first",
        body: "Start with simple airway manoeuvres and bag-mask ventilation with 100% oxygen. Effective bag-mask ventilation is a core skill; do not persist with a failing advanced technique while CPR quality suffers.",
      },
      {
        title: "Supraglottic airways",
        body: "Supraglottic airways are a reasonable alternative to tracheal intubation for many providers, and can reduce CPR interruptions.",
      },
      {
        title: "Tracheal intubation",
        body: "Only for experienced providers with ongoing practice, with direct or video laryngoscopy, capnography confirmation, and minimal interruption to compressions.",
      },
      {
        title: "Avoid hyperventilation",
        body: "Excessive ventilation rates increase intrathoracic pressure and reduce venous return. Give enough volume to see chest rise.",
      },
    ],
  },
  {
    id: "als-rhythms",
    track: "ALS",
    title: "Cardiac rhythm recognition",
    summary: "Reading the arrest rhythms.",
    minutes: 6,
    steps: [
      {
        title: "Ventricular fibrillation (VF)",
        body: "Chaotic, irregular waveform. Shockable — the single most survival-improving rhythm to recognise. Early defibrillation is critical.",
      },
      {
        title: "Pulseless ventricular tachycardia (pVT)",
        body: "Wide-complex, fast rhythm without a pulse. Shockable — synchronised cardioversion is for VT WITH a pulse.",
      },
      {
        title: "Asystole",
        body: "A flat line. Non-shockable: high-quality CPR, adrenaline, and search for reversible causes.",
      },
      {
        title: "Pulseless electrical activity (PEA)",
        body: "Organised electrical activity without a palpable pulse. Non-shockable: treat the underlying cause (see the 4 Hs and 4 Ts).",
      },
    ],
  },
  {
    id: "als-defibrillation",
    track: "ALS",
    title: "Defibrillation principles",
    summary: "Delivering shocks safely and effectively.",
    minutes: 5,
    steps: [
      {
        title: "Energy and pads",
        body: "Follow the device manufacturer's recommendations (typically escalating doses for biphasic defibrillators). Ensure pads are placed correctly on a bare, dry chest with full contact.",
      },
      {
        title: "Safety",
        body: "Announce and visually confirm \"all clear\" before every shock. Never discharge with anyone in contact, and never shock in a wet or flammable environment.",
      },
      {
        title: "Minimise the peri-shock pause",
        body: "Resume compressions immediately after shock delivery. CPR should not pause for pad application or rhythm analysis beyond what the device requires.",
      },
    ],
  },
  {
    id: "als-reversible-causes",
    track: "ALS",
    title: "Reversible causes: the 4 Hs and 4 Ts",
    summary: "Finding and fixing what caused the arrest.",
    minutes: 6,
    steps: [
      {
        title: "The 4 Hs",
        body: "Hypoxia; Hypovolaemia; Hyperkalaemia (and other metabolic disorders); Hypothermia. Each has targeted treatments — for example high-flow oxygenation for hypoxia, fluids or blood for hypovolaemia.",
      },
      {
        title: "The 4 Ts",
        body: "Tension pneumothorax; Tamponade; Toxins (for example opioids, tricyclics); Thrombosis (coronary or pulmonary). Ultrasound at the point of care can rapidly identify several of these.",
      },
      {
        title: "Why it matters",
        body: "In non-shockable rhythms especially, identifying and treating a reversible cause is the only intervention that restores circulation.",
      },
    ],
  },
  {
    id: "als-post-resuscitation",
    track: "ALS",
    title: "Post-resuscitation care",
    summary: "What to do after the return of spontaneous circulation (ROSC).",
    minutes: 6,
    steps: [
      {
        title: "ABCDE reassessment",
        body: "Reassess airway, breathing and circulation immediately after ROSC. Support oxygenation targeting normal saturation (94–98%) and avoid hypoxia and hyperoxia.",
      },
      {
        title: "Targeted temperature management",
        body: "Survivors who remain comatose after cardiac arrest should receive targeted temperature management; fever should be treated.",
      },
      {
        title: "Cause investigation and handover",
        body: "Investigate the cause of the arrest (for example ECG, echocardiography, electrolytes) and hand over with a structured report including downtime, rhythms, shocks and medications.",
      },
    ],
  },
  {
    id: "als-team",
    track: "ALS",
    title: "Team communication and role allocation",
    summary: "Running a resuscitation as a team.",
    minutes: 5,
    steps: [
      {
        title: "Assign roles early",
        body: "Before or at the start of an arrest, allocate: team leader, compressions, airway, drugs, defibrillation, scribe/timekeeper. The team leader should not perform tasks — they direct.",
      },
      {
        title: "Closed-loop communication",
        body: "Give instructions by name, receive confirmation, and announce completed actions aloud (\"Adrenaline 1 mg given at 12:04\").",
      },
      {
        title: "Structured handover",
        body: "Use a structured tool (for example SBAR or the resuscitation record) for handover to the receiving team.",
      },
    ],
  },
  {
    id: "als-documentation",
    track: "ALS",
    title: "Emergency documentation and debriefing",
    summary: "Recording the event and learning from it.",
    minutes: 4,
    steps: [
      {
        title: "Document contemporaneously",
        body: "Record times of collapse, CPR, rhythms, shocks, medications and ROSC as they happen. The scribe role exists so the team does not rely on memory.",
      },
      {
        title: "Debrief",
        body: "The 2025 guidelines continue to recommend clinical debriefing after resuscitation events — brief, structured and blame-free — to improve team performance and support staff wellbeing.",
      },
      {
        title: "Support lay rescuers",
        body: "Bystanders and lay rescuers may find the experience traumatic. Offer information about support resources.",
      },
    ],
  },
];

export function findModule(id: string): EmergencyModule | undefined {
  return EMERGENCY_MODULES.find((m) => m.id === id);
}
