import { NextRequest, NextResponse } from "next/server";
import { generateMedicalSummary, type MedicalHistoryInput } from "@/lib/ai-pipeline";

export async function POST(request: NextRequest) {
  try {
    const body: MedicalHistoryInput = await request.json();
    const apiKey = process.env.KIMI_API_KEY;

    if (!apiKey || apiKey === "placeholder_kimi_api_key") {
      // Return a mock response when API key is not configured
      const mockResponse = {
        clinicianSummary: generateMockClinicianSummary(body),
        patientRecap: generateMockPatientRecap(body),
        followUpQuestions: generateMockQuestions(body),
      };
      return NextResponse.json(mockResponse);
    }

    const result = await generateMedicalSummary(body, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI Pipeline Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI summary. Please try again." },
      { status: 500 }
    );
  }
}

function generateMockClinicianSummary(data: MedicalHistoryInput): string {
  const chronicConditions = [
    data.historyOfDiabetes && "diabetes",
    data.historyOfStroke && "stroke",
    data.historyOfHeartAttack && "heart attack",
  ].filter(Boolean);

  return `CLINICIAN SUMMARY:

1. CHIEF COMPLAINT: ${data.complaint || "Not specified"}

2. HISTORY OF PRESENT ILLNESS: Patient reports ${data.complaint || "unspecified symptoms"}${data.symptomOnset ? ` with onset ${data.symptomOnset}` : ""}. Symptoms are ${data.symptomCharacter || "uncharacterized"}${data.symptomWorseningTime ? `, worsening ${data.symptomWorseningTime}` : ""}${data.symptomReliefTime ? `, relieved ${data.symptomReliefTime}` : ""}.

3. PAST MEDICAL HISTORY: ${chronicConditions.length > 0 ? `Significant for ${chronicConditions.join(", ")}` : "No major chronic conditions reported"}. ${data.pastHistory ? `Additional history: ${data.pastHistory}` : ""}

4. MEDICATIONS & ALLERGIES: Current medications: ${data.currentMedications || "none reported"}. Known allergies: ${data.allergies || "none reported"}.

5. FAMILY HISTORY: ${data.familyHistory || "Not significant"}

6. LIFESTYLE FACTORS: Smoking: ${data.smokingStatus || "non-smoker"}. Alcohol: ${data.alcoholUse || "no use"}. Activity: ${data.activityLevel || "moderate"}. Sleep: ${data.sleepPatterns || "normal"}. Pain scale: ${data.painScale || 0}/10.

7. RISK FACTORS: ${data.smokingStatus === "current" ? "Active smoking is a significant risk factor. " : ""}${data.painScale && data.painScale > 6 ? "High pain levels warrant further investigation. " : ""}${data.alcoholUse === "heavy" ? "Heavy alcohol use noted. " : ""}Clinical correlation recommended.

8. RECOMMENDED FOLLOW-UP: Consider clinical correlation and appropriate workup based on presenting symptoms.

This AI-generated summary is assistive only and does not constitute a medical diagnosis, prescription, or emergency instruction. Clinical correlation and professional judgment are required.`;
}

function generateMockPatientRecap(data: MedicalHistoryInput): string {
  return `Thank you for sharing your health information. Here's a summary of what you've told us:

You mentioned that you're experiencing ${data.complaint || "some health concerns"}. ${data.currentMedications ? `You're currently taking ${data.currentMedications || "some medications"}. ` : "You're not currently taking any medications. "}${data.allergies ? `You've noted allergies to ${data.allergies}. ` : ""}

${data.historyOfDiabetes || data.historyOfStroke || data.historyOfHeartAttack ? "You have a history of some chronic conditions, so it's important to monitor your health regularly and follow your doctor's recommendations. " : "Your overall health profile looks good based on what you've shared. "}

Remember to keep following up with your doctor for personalized medical advice. Your health information is securely stored and available for your healthcare team to review.`;
}

function generateMockQuestions(data: MedicalHistoryInput): string[] {
  return [
    "Can you describe the onset of your symptoms — was it sudden or gradual?",
    "What makes the symptoms better or worse?",
    "Have you noticed any patterns in your symptoms throughout the day?",
    "Are there any activities that trigger or relieve your symptoms?",
    "Have you recently traveled or been exposed to any illnesses?",
  ];
}
