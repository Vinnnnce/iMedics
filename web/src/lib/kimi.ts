import axios from "axios";

const KIMI_API_URL = process.env.KIMI_API_URL || "https://api.moonshot.ai/v1/chat/completions";
const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k3";

interface LabValue {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

interface LabAnalysisInput {
  patientAge?: number;
  patientSex?: string;
  patientLanguage?: string;
  panelType: string;
  values: LabValue[];
}

interface LabAnalysisResult {
  summary_for_doctor: string;
  summary_for_patient: string;
  flags: string[];
  limitations: string;
}

const DOCTOR_PROMPT = `You are an AI assistant analyzing laboratory results for a licensed physician. Your task is to provide a concise, objective summary of the lab values provided.

RULES:
- Do NOT diagnose any disease or condition.
- Do NOT prescribe medications or suggest dosages.
- Do NOT mention specific drug names.
- Use bullet points for abnormalities and trends.
- Suggest areas for further evaluation (e.g., "consider iron studies", "consider thyroid panel").
- Keep the summary concise and clinical.
- If all values are within reference ranges, state so clearly.`;

const PATIENT_PROMPT = `You are an AI assistant explaining laboratory results to a patient in plain, reassuring language. Your task is to help the patient understand their results without causing unnecessary anxiety.

RULES:
- Do NOT name any diseases or medical conditions.
- Do NOT suggest treatments, medications, or lifestyle changes.
- Do NOT use medical jargon — use simple, everyday language.
- Be encouraging and positive in tone.
- Remind the patient to discuss results with their doctor.
- If all values are normal, reassure the patient that their results look good.
- For out-of-range values, explain that some results are slightly outside typical ranges and their doctor can provide more context.`;

export async function analyzeLabResults(input: LabAnalysisInput): Promise<LabAnalysisResult> {
  const { patientAge, patientSex, patientLanguage, panelType, values } = input;

  const valuesText = values
    .map(
      (v) =>
        `- ${v.name} (${v.code}): ${v.value} ${v.unit} [Reference: ${v.refLow}-${v.refHigh} ${v.unit}]`
    )
    .join("\n");

  const patientContext = `Patient: ${patientAge || "unknown"} years old, ${patientSex || "unknown sex"}, language: ${patientLanguage || "en"}`;
  const panelContext = `Panel type: ${panelType}`;

  const flagged = values.filter((v) => {
    const val = parseFloat(v.value);
    const low = parseFloat(v.refLow);
    const high = parseFloat(v.refHigh);
    return !isNaN(val) && !isNaN(low) && !isNaN(high) && (val < low || val > high);
  });

  const flags = flagged.map(
    (v) =>
      `${v.name} (${v.code}): ${v.value} ${v.unit} is outside reference range ${v.refLow}-${v.refHigh} ${v.unit}`
  );

  const fullPrompt = `${patientContext}
${panelContext}

Lab Values:
${valuesText}

Please provide two summaries:

=== DOCTOR SUMMARY ===
${DOCTOR_PROMPT}

=== PATIENT SUMMARY ===
${PATIENT_PROMPT}

Please format your response as JSON:
{
  "summary_for_doctor": "...",
  "summary_for_patient": "...",
  "limitations": "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional."
}`;

  try {
    const response = await axios.post(
      KIMI_API_URL,
      {
        model: KIMI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a medical AI assistant that explains lab results. You never diagnose, prescribe, or mention specific drug names. You always include safety disclaimers.",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${KIMI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from Kimi K3");
    }

    // Try to parse JSON from the response
    let parsed: Partial<LabAnalysisResult>;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // If JSON parsing fails, use the raw content as both summaries
      parsed = {
        summary_for_doctor: content,
        summary_for_patient: content,
        limitations:
          "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
      };
    }

    // Apply safety filters
    const result: LabAnalysisResult = {
      summary_for_doctor: parsed.summary_for_doctor || "Unable to generate doctor summary.",
      summary_for_patient: parsed.summary_for_patient || "Unable to generate patient summary.",
      flags,
      limitations:
        parsed.limitations ||
        "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
    };

    return result;
  } catch (error) {
    console.error("Kimi K3 API error:", error);

    // Return a fallback response
    return {
      summary_for_doctor: `Lab analysis for ${panelType}. ${flags.length} value(s) outside reference range. Please review the flagged values and consider further evaluation as clinically indicated.`,
      summary_for_patient: `Your ${panelType} results have been processed. ${flags.length === 0 ? "All values appear to be within typical ranges." : "Some values are outside typical ranges. Please discuss these results with your doctor for more context."} Remember to consult your doctor about your results.`,
      flags,
      limitations:
        "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.",
    };
  }
}
