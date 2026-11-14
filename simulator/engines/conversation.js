// Hybrid AI patient conversation engine.
// Deterministic interview script drives WHAT the patient can reveal;
// a rule-based natural language layer shapes HOW they say it.
// The hidden diagnosis is never exposed by the patient — patients do not
// know their diagnosis. Emotional state (pain/anxiety/confusion) colours tone.

const GREETINGS = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
const THANKS = ['thank', 'thanks'];
const APOLOGY = ['sorry', 'apolog'];
const REASSURE = ['don\'t worry', 'you will be fine', 'you\'ll be fine', 'we will look after', 'you are in good hands', 'safe here'];

const PAIN_PREFIX = { 8: '(wincing) ', 6: '(shifting uncomfortably) ', 4: '(quietly) ' };
const ANXIETY_PREFIX = { 8: 'Oh doctor, ', 6: '(voice trembling) ', 4: '' };
const CONFUSED_PREFIX = { 6: '(vaguely) ', 3: '' };

function classify(message, scenario) {
  const m = ' ' + message.toLowerCase().replace(/[^a-z0-9\s']/g, ' ') + ' ';
  // exact script matches first
  let best = null;
  for (const item of scenario.interview) {
    for (const kw of item.match) {
      if (m.includes(' ' + kw) || m.includes(kw + ' ')) {
        if (!best || kw.length > (best.kw || '').length) best = { item, kw };
      }
    }
  }
  if (best) return { type: 'script', item: best.item };

  if (GREETINGS.some(g => m.includes(g))) return { type: 'greeting' };
  if (THANKS.some(g => m.includes(g))) return { type: 'thanks' };
  if (APOLOGY.some(g => m.includes(g))) return { type: 'ack' };
  if (REASSURE.some(g => m.includes(g))) return { type: 'reassure' };
  if (/\b(name|call you)\b/.test(m)) return { type: 'name' };
  if (/\b(age|old are you)\b/.test(m)) return { type: 'age' };
  if (/\b(understand|diagnos|what is wrong|what's wrong|know what)\b/.test(m)) return { type: 'ask_diagnosis' };
  if (/\b(die|death|dying|mortal|serious)\b/.test(m)) return { type: 'prognosis' };
  if (/\b(hurt|pain|painful)\b/.test(m)) return { type: 'pain_now' };
  return null;
}

const GENERIC = [
  'I am not sure how to answer that, doctor.',
  'Hmm — nobody has asked me that before. I do not really know.',
  'You are the doctor — I just know I feel terrible.',
  'Maybe? I cannot think straight right now.'
];

const PARENT_GENERIC = [
  '(Father) I... I do not know. Please, is she going to be alright?',
  '(Father) You are asking me things I cannot answer — you are the doctors.',
  '(Father) I just want someone to tell me what is happening.'
];

function reply(scenario, state, message, turnCount) {
  const emo = scenario.emotions || {};
  const isPaediatric = !!emo.paediatric_parent;
  const vitals = state.vitals || {};
  const intent = classify(message, scenario);
  let body;

  if (!intent) {
    const pool = isPaediatric ? PARENT_GENERIC : GENERIC;
    body = pool[turnCount % pool.length];
  } else {
    switch (intent.type) {
      case 'script': body = intent.item.a; break;
      case 'greeting': body = isPaediatric ? '(Father) Hello. Please help her.' : 'Hello doctor. Please — help me.'; break;
      case 'thanks': body = 'Thank you, doctor. It means a lot.'; break;
      case 'ack': body = 'It is fine. Just... please find out what is wrong.'; break;
      case 'reassure': body = isPaediatric ? '(Father) Thank you. We are so scared.' : 'That helps. A little. Thank you.'; break;
      case 'name': body = `My name is ${scenario.patient.name}.`; break;
      case 'age': body = `I am ${scenario.patient.age}.`; break;
      case 'ask_diagnosis':
        body = isPaediatric
          ? '(Father) That is what we are here for YOU to tell US. Please, what is wrong with her?'
          : 'That is what I am hoping you will tell me, doctor. I only know how I feel.';
        break;
      case 'prognosis': body = isPaediatric ? '(Father) Do not say that. Please. She is five.' : 'I do not want to think about that. Just make me better.'; break;
      case 'pain_now': body = `Right now the pain is about ${Math.max(0, Math.round((vitals.pain || emo.pain || 5)))} out of 10.`; break;
      default: body = GENERIC[0];
    }
  }

  // Emotional colouring — deterministic, driven by engine state
  const pain = vitals.pain != null ? vitals.pain : (emo.pain || 0);
  const anx = emo.anxiety || 0;
  const conf = emo.confusion || 0;
  let prefix = '';
  if (pain >= 8) prefix += PAIN_PREFIX[8];
  else if (pain >= 6) prefix += PAIN_PREFIX[6];
  else if (pain >= 4) prefix += PAIN_PREFIX[4];
  if (conf >= 6 && !isPaediatric && intent && intent.type !== 'script') body = CONFUSED_PREFIX[6] + body;
  else if (anx >= 8 && !prefix && intent && intent.type === 'script') body = ANXIETY_PREFIX[8] + body;
  return prefix + body;
}

// Which interview tags have been covered (for scoring)
function tagsCovered(scenario, askedMessages) {
  const covered = new Set();
  for (const msg of askedMessages) {
    const intent = classify(msg, scenario);
    if (intent && intent.type === 'script') (intent.item.tags || []).forEach(t => covered.add(t));
  }
  return [...covered];
}

module.exports = { reply, tagsCovered };
