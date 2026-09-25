/**
 * Medic1905 AI Pipeline — Kimi K3 Integration
 * 
 * Prompt templates for:
 * 1. Clinician Summary
 * 2. Patient Recap
 * 3. Guided Questions
 * 
 * Safety constraints:
 * - No diagnosis
 * - No prescriptions
 * - No emergency instructions
 */

export interface MedicalHistoryInput {
  complaint?: string;
  symptomOnset?: string;
  symptomWorseningTime?: string;
  symptomReliefTime?: string;
  symptomCharacter?: string;
  currentMedications?: string;
  woundInjury?: string;
  historyOfDiabetes?: boolean;
  historyOfStroke?: boolean;
  historyOfHeartAttack?: boolean;
  familyHistory?: string;
  pastHistory?: string;
  allergies?: string;
  smokingStatus?: string;
  alcoholUse?: string;
  activityLevel?: string;
  mentalHealthNotes?: string;
  immunizationRecords?: string;
  travelHistory?: string;
  occupationalExposure?: string;
  painScale?: number;
  sleepPatterns?: string;
}

export interface AIOutput {
  clinicianSummary: string;
  patientRecap: string;
  followUpQuestions: string[];
}

/**
 * CLINICIAN SUMMARY PROMPT
 * Generates a structured summary for healthcare professionals
 */
export const CLINICIAN_SUMMARY_PROMPT = `You are a medical AI assistant integrated into the Medic1905 telemedicine platform. Your role is to generate structured clinician summaries from patient-provided medical history data.

CRITICAL SAFETY CONSTRAINTS:
- You MUST NOT provide a diagnosis
- You MUST NOT prescribe medications
- You MUST NOT provide emergency medical instructions
- You MUST NOT interpret lab values as definitive medical conclusions
- You MUST include a disclaimer that this summary is assistive only

Your task: Analyze the following structured medical history data and produce a concise, well-organized clinician summary.

Format the summary as:
1. CHIEF COMPLAINT: [one-line summary]
2. HISTORY OF PRESENT ILLNESS: [2-3 sentences synthesizing complaint, symptom onset, character, worsening/relief patterns]
3. PAST MEDICAL HISTORY: [relevant positives and negatives from diabetes, stroke, heart attack, past history]
4. MEDICATIONS & ALLERGIES: [current medications and known allergies]
5. FAMILY HISTORY: [relevant family history]
6. LIFESTYLE FACTORS: [smoking, alcohol, activity level, sleep, pain scale]
7. RISK FACTORS: [identified risk factors based on the data]
8. RECOMMENDED FOLLOW-UP: [suggested areas for clinical correlation — NOT a prescription or diagnosis]

Always conclude with: "This AI-generated summary is assistive only and does not constitute a medical diagnosis, prescription, or emergency instruction. Clinical correlation and professional judgment are required."

PATIENT DATA:
{{patientData}}`;

/**
 * PATIENT RECAP PROMPT
 * Generates a friendly, easy-to-understand summary for the patient
 */
export const PATIENT_RECAP_PROMPT = `You are a friendly medical AI assistant on the Medic1905 telemedicine platform. Your role is to help patients understand the information they've shared about their health.

CRITICAL SAFETY CONSTRAINTS:
- You MUST NOT provide a diagnosis
- You MUST NOT recommend specific medications
- You MUST NOT provide emergency medical instructions
- You MUST encourage the patient to consult their doctor for medical advice
- Keep the language simple, warm, and non-technical

Your task: Create a patient-friendly recap of the medical history they just completed. This should:
1. Acknowledge what they've shared (validate their effort)
2. Summarize the key points in plain, friendly language
3. Highlight any areas they might want to discuss with their doctor
4. Remind them to follow up with their healthcare provider
5. Be encouraging and supportive

Tone: Warm, friendly, reassuring, non-alarmist. Use "you" and "your" directly.
Length: 3-4 short paragraphs maximum.

PATIENT DATA:
{{patientData}}`;

/**
 * GUIDED QUESTIONS PROMPT
 * Generates follow-up questions to guide the patient through a more complete history
 */
export const GUIDED_QUESTIONS_PROMPT = `You are a medical AI assistant on the Medic1905 telemedicine platform. Your role is to generate relevant follow-up questions to help patients provide a more complete medical history.

CRITICAL SAFETY CONSTRAINTS:
- Questions MUST be informational only — not leading toward any diagnosis
- Do NOT ask questions that could be interpreted as diagnostic
- Focus on collecting factual information about symptoms, history, and lifestyle
- Questions should be clear, non-technical, and easy for patients to answer
- Generate 5 questions maximum

Your task: Based on the patient's provided medical history, generate 5 relevant follow-up questions that would help a healthcare provider better understand the patient's situation.

Question guidelines:
- Ask about symptom details (timing, severity, triggers)
- Ask about lifestyle factors that may be relevant
- Ask about family history details
- Ask about medication adherence if applicable
- Ask about any concerns the patient may have

Each question should be standalone and answerable without medical knowledge.

PATIENT DATA:
{{patientData}}`;

/**
 * FULL PIPELINE PROMPT
 * Combined prompt for generating all three outputs in one call
 */
export const FULL_PIPELINE_PROMPT = `You are Medic1905's AI Medical Assistant, powered by Kimi K3. You analyze patient medical history data and generate three structured outputs.

SAFETY CONSTRAINTS (NON-NEGOTIABLE):
- You MUST NOT provide diagnoses
- You MUST NOT prescribe medications or treatments
- You MUST NOT provide emergency medical instructions
- All outputs must be clearly labeled as assistive only
- Clinical correlation is always required

Based on the patient's medical history data below, generate:

=== CLINICIAN SUMMARY ===
[Structured summary for healthcare professionals including: chief complaint, history of present illness, past medical history, medications & allergies, family history, lifestyle factors, risk factors, and recommended follow-up areas. Use medical terminology appropriate for clinicians.]

=== PATIENT RECAP ===
[Friendly, plain-language summary of what the patient shared. Warm tone, 3-4 paragraphs. Encourage follow-up with their doctor.]

=== FOLLOW-UP QUESTIONS ===
[5 relevant questions to help the patient provide more complete information. Non-diagnostic, factual, easy to answer.]

=== SAFETY DISCLAIMER ===
[Standard disclaimer that all AI outputs are assistive only and do not constitute medical advice, diagnosis, or prescription.]

PATIENT DATA:
{{patientData}}`;

/**
 * Generate AI summary using Kimi K3 API
 */
export async function generateMedicalSummary(
  patientData: MedicalHistoryInput,
  apiKey: string
): Promise<AIOutput> {
  const dataString = JSON.stringify(patientData, null, 2);

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "kimi-k3",
      messages: [
        {
          role: "system",
          content: FULL_PIPELINE_PROMPT.replace("{{patientData}}", dataString),
        },
        {
          role: "user",
          content: "Please generate the clinician summary, patient recap, and follow-up questions based on my medical history data.",
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi K3 API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";

  // Parse the three sections from the response
  const clinicianMatch = content.match(/=== CLINICIAN SUMMARY ===\s*([\s\S]*?)(?===|\Z)/);
  const patientMatch = content.match(/=== PATIENT RECAP ===\s*([\s\S]*?)(?===|\Z)/);
  const questionsMatch = content.match(/=== FOLLOW-UP QUESTIONS ===\s*([\s\S]*?)(?===|\Z)/);

  const followUpQuestions = (questionsMatch?.[1] || "")
    .split(/\d+\./)
    .map((q: string) => q.trim())
    .filter((q: string) => q.length > 0)
    .slice(0, 5);

  return {
    clinicianSummary: clinicianMatch?.[1]?.trim() || content,
    patientRecap: patientMatch?.[1]?.trim() || "",
    followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : [
      "Can you describe the onset of your symptoms — was it sudden or gradual?",
      "What makes the symptoms better or worse?",
      "Have you noticed any patterns in your symptoms throughout the day?",
      "Are there any activities that trigger or relieve your symptoms?",
      "Have you recently traveled or been exposed to any illnesses?",
    ],
  };
}
