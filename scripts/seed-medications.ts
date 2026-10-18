/**
 * Seed the curated medication reference table (idempotent, safe to re-run).
 *
 * Data is a small, reviewable set of widely used medications with their
 * standard therapeutic/antibiotic class and common coverage tags, drawn from
 * public-domain pharmacology references. It is NOT a complete drug database:
 * the prescriber interface clearly marks curated rows and falls back to
 * "information unavailable" for interaction/spectrum data it cannot verify.
 *
 * Run with: npm run db:seed:medications
 */
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface MedSeed {
  name: string;
  activeIngredient: string;
  drugClass: string;
  pharmacologicalClass?: string;
  antibioticClass?: string;
  antimicrobialSpectrum?: string[];
  commonRoutes?: string[];
  formulations: string[];
  notes?: string;
}

const MEDICATIONS: MedSeed[] = [
  // --- Analgesics / antipyretics ---
  { name: "Paracetamol", activeIngredient: "paracetamol (acetaminophen)", drugClass: "Analgesics, antipyretics", pharmacologicalClass: "Non-opioid analgesic", commonRoutes: ["oral", "intravenous", "rectal"], formulations: ["500 mg tablet", "120 mg/5 mL suspension", "1 g/100 mL infusion"], notes: "Check total daily dose and liver disease." },
  { name: "Ibuprofen", activeIngredient: "ibuprofen", drugClass: "Non-steroidal anti-inflammatory drugs (NSAIDs)", pharmacologicalClass: "COX inhibitor", commonRoutes: ["oral", "topical"], formulations: ["200 mg tablet", "400 mg tablet", "600 mg tablet", "100 mg/5 mL suspension"], notes: "Caution with peptic ulcer disease, renal impairment and third-trimester pregnancy." },
  { name: "Diclofenac", activeIngredient: "diclofenac sodium", drugClass: "Non-steroidal anti-inflammatory drugs (NSAIDs)", commonRoutes: ["oral", "topical"], formulations: ["50 mg tablet", "75 mg/3 mL injection", "1% gel"] },

  // --- Antibiotics: penicillins ---
  { name: "Amoxicillin", activeIngredient: "amoxicillin", drugClass: "Antibiotics", antibioticClass: "penicillins", antimicrobialSpectrum: ["GRAM_POSITIVE"], commonRoutes: ["oral"], formulations: ["500 mg capsule", "250 mg/5 mL suspension"], notes: "Typical coverage includes streptococci; not reliable against penicillin-resistant organisms." },
  { name: "Amoxicillin/clavulanic acid", activeIngredient: "amoxicillin + clavulanic acid", drugClass: "Antibiotics", antibioticClass: "penicillins", antimicrobialSpectrum: ["GRAM_POSITIVE", "ANAEROBES"], commonRoutes: ["oral"], formulations: ["500/125 mg tablet", "875/125 mg tablet", "250/62.5 mg/5 mL suspension"], notes: "Beta-lactamase inhibitor combination; coverage depends on local resistance patterns." },
  { name: "Benzylpenicillin", activeIngredient: "benzylpenicillin", drugClass: "Antibiotics", antibioticClass: "penicillins", antimicrobialSpectrum: ["GRAM_POSITIVE"], commonRoutes: ["intravenous", "intramuscular"], formulations: ["1 MU (600 mg) powder for injection"] },

  // --- Antibiotics: cephalosporins ---
  { name: "Cephalexin", activeIngredient: "cephalexin", drugClass: "Antibiotics", antibioticClass: "cephalosporins", antimicrobialSpectrum: ["GRAM_POSITIVE"], commonRoutes: ["oral"], formulations: ["500 mg capsule", "250 mg/5 mL suspension"], notes: "First-generation cephalosporin." },
  { name: "Cefuroxime", activeIngredient: "cefuroxime", drugClass: "Antibiotics", antibioticClass: "cephalosporins", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE"], commonRoutes: ["oral", "intravenous"], formulations: ["250 mg tablet", "750 mg injection"] },
  { name: "Ceftriaxone", activeIngredient: "ceftriaxone", drugClass: "Antibiotics", antibioticClass: "cephalosporins", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE"], commonRoutes: ["intravenous", "intramuscular"], formulations: ["1 g powder for injection"], notes: "Third-generation cephalosporin; no oral form." },

  // --- Antibiotics: macrolides ---
  { name: "Azithromycin", activeIngredient: "azithromycin", drugClass: "Antibiotics", antibioticClass: "macrolides", antimicrobialSpectrum: ["GRAM_POSITIVE", "ATYPICALS"], commonRoutes: ["oral"], formulations: ["250 mg tablet", "200 mg/5 mL suspension"], notes: "Also covers some atypical respiratory organisms." },
  { name: "Erythromycin", activeIngredient: "erythromycin", drugClass: "Antibiotics", antibioticClass: "macrolides", commonRoutes: ["oral", "intravenous"], formulations: ["250 mg tablet", "200 mg/5 mL suspension"] },

  // --- Antibiotics: tetracyclines ---
  { name: "Doxycycline", activeIngredient: "doxycycline", drugClass: "Antibiotics", antibioticClass: "tetracyclines", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE", "ATYPICALS"], commonRoutes: ["oral"], formulations: ["100 mg capsule"], notes: "Avoid in pregnancy and children under 8 years." },

  // --- Antibiotics: fluoroquinolones ---
  { name: "Ciprofloxacin", activeIngredient: "ciprofloxacin", drugClass: "Antibiotics", antibioticClass: "fluoroquinolones", antimicrobialSpectrum: ["GRAM_NEGATIVE", "PSEUDOMONAS"], commonRoutes: ["oral", "intravenous"], formulations: ["250 mg tablet", "500 mg tablet", "200 mg/100 mL infusion"], notes: "Tendon and QT precautions; check local guidance on restricted use." },
  { name: "Levofloxacin", activeIngredient: "levofloxacin", drugClass: "Antibiotics", antibioticClass: "fluoroquinolones", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE", "ATYPICALS"], commonRoutes: ["oral", "intravenous"], formulations: ["250 mg tablet", "500 mg tablet"] },

  // --- Antibiotics: aminoglycosides ---
  { name: "Gentamicin", activeIngredient: "gentamicin", drugClass: "Antibiotics", antibioticClass: "aminoglycosides", antimicrobialSpectrum: ["GRAM_NEGATIVE"], commonRoutes: ["intravenous", "intramuscular"], formulations: ["40 mg/mL injection"], notes: "Therapeutic drug monitoring required (levels, renal function, hearing)." },

  // --- Antibiotics: others ---
  { name: "Clindamycin", activeIngredient: "clindamycin", drugClass: "Antibiotics", antibioticClass: "lincosamides", antimicrobialSpectrum: ["GRAM_POSITIVE", "ANAEROBES"], commonRoutes: ["oral", "intravenous"], formulations: ["150 mg capsule", "300 mg/2 mL injection"] },
  { name: "Metronidazole", activeIngredient: "metronidazole", drugClass: "Antibiotics", antibioticClass: "nitroimidazoles", antimicrobialSpectrum: ["ANAEROBES"], commonRoutes: ["oral", "intravenous"], formulations: ["400 mg tablet", "500 mg/100 mL infusion"], notes: "Advise against alcohol during treatment." },
  { name: "Vancomycin", activeIngredient: "vancomycin", drugClass: "Antibiotics", antibioticClass: "glycopeptides", antimicrobialSpectrum: ["GRAM_POSITIVE", "MRSA"], commonRoutes: ["intravenous", "oral"], formulations: ["500 mg powder for infusion"], notes: "Oral form is used for C. difficile; IV requires level monitoring." },
  { name: "Meropenem", activeIngredient: "meropenem", drugClass: "Antibiotics", antibioticClass: "carbapenems", antimicrobialSpectrum: ["BROAD_SPECTRUM"], commonRoutes: ["intravenous"], formulations: ["1 g powder for injection"], notes: "Reserve agent; follow local antimicrobial stewardship policy." },
  { name: "Nitrofurantoin", activeIngredient: "nitrofurantoin", drugClass: "Antibiotics", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE"], commonRoutes: ["oral"], formulations: ["100 mg tablet"], notes: "Uncomplicated lower urinary tract infection only; avoid with significant renal impairment." },
  { name: "Sulfamethoxazole/trimethoprim", activeIngredient: "sulfamethoxazole + trimethoprim", drugClass: "Antibiotics", antibioticClass: "sulfonamides", antimicrobialSpectrum: ["GRAM_POSITIVE", "GRAM_NEGATIVE"], commonRoutes: ["oral"], formulations: ["400/80 mg tablet"] },

  // --- Chronic-disease medications ---
  { name: "Metformin", activeIngredient: "metformin hydrochloride", drugClass: "Antidiabetics", pharmacologicalClass: "Biguanide", commonRoutes: ["oral"], formulations: ["500 mg tablet", "850 mg tablet", "1000 mg tablet"], notes: "Stop before procedures involving iodinated contrast per local protocol; monitor renal function." },
  { name: "Glibenclamide", activeIngredient: "glibenclamide", drugClass: "Antidiabetics", pharmacologicalClass: "Sulfonylurea", commonRoutes: ["oral"], formulations: ["5 mg tablet"], notes: "Hypoglycaemia risk, especially in the elderly." },
  { name: "Insulin glargine", activeIngredient: "insulin glargine", drugClass: "Antidiabetics", pharmacologicalClass: "Long-acting insulin analogue", commonRoutes: ["subcutaneous"], formulations: ["100 units/mL pen"] },
  { name: "Amlodipine", activeIngredient: "amlodipine", drugClass: "Antihypertensives", pharmacologicalClass: "Calcium-channel blocker", commonRoutes: ["oral"], formulations: ["5 mg tablet", "10 mg tablet"] },
  { name: "Lisinopril", activeIngredient: "lisinopril", drugClass: "Antihypertensives", pharmacologicalClass: "ACE inhibitor", commonRoutes: ["oral"], formulations: ["5 mg tablet", "10 mg tablet", "20 mg tablet"], notes: "Avoid in pregnancy; monitor potassium and renal function." },
  { name: "Losartan", activeIngredient: "losartan potassium", drugClass: "Antihypertensives", pharmacologicalClass: "Angiotensin-II receptor blocker", commonRoutes: ["oral"], formulations: ["50 mg tablet", "100 mg tablet"], notes: "Avoid in pregnancy." },
  { name: "Hydrochlorothiazide", activeIngredient: "hydrochlorothiazide", drugClass: "Antihypertensives", pharmacologicalClass: "Thiazide diuretic", commonRoutes: ["oral"], formulations: ["12.5 mg tablet", "25 mg tablet"] },
  { name: "Atenolol", activeIngredient: "atenolol", drugClass: "Antihypertensives", pharmacologicalClass: "Beta-blocker", commonRoutes: ["oral"], formulations: ["25 mg tablet", "50 mg tablet", "100 mg tablet"] },
  { name: "Atorvastatin", activeIngredient: "atorvastatin", drugClass: "Lipid-lowering agents", pharmacologicalClass: "HMG-CoA reductase inhibitor (statin)", commonRoutes: ["oral"], formulations: ["10 mg tablet", "20 mg tablet", "40 mg tablet"], notes: "Report muscle pain; check liver function per local protocol." },
  { name: "Warfarin", activeIngredient: "warfarin sodium", drugClass: "Anticoagulants", pharmacologicalClass: "Vitamin K antagonist", commonRoutes: ["oral"], formulations: ["1 mg tablet", "5 mg tablet"], notes: "INR monitoring mandatory; many interactions." },
  { name: "Clopidogrel", activeIngredient: "clopidogrel", drugClass: "Antithrombotics", pharmacologicalClass: "P2Y12 inhibitor", commonRoutes: ["oral"], formulations: ["75 mg tablet"] },
  { name: "Furosemide", activeIngredient: "furosemide", drugClass: "Diuretics", pharmacologicalClass: "Loop diuretic", commonRoutes: ["oral", "intravenous"], formulations: ["20 mg tablet", "40 mg tablet", "20 mg/2 mL injection"] },
  { name: "Omeprazole", activeIngredient: "omeprazole", drugClass: "Acid-suppressing agents", pharmacologicalClass: "Proton-pump inhibitor", commonRoutes: ["oral"], formulations: ["20 mg capsule"] },
  { name: "Salbutamol", activeIngredient: "salbutamol", drugClass: "Bronchodilators", pharmacologicalClass: "Short-acting beta-2 agonist", commonRoutes: ["inhaled"], formulations: ["100 micrograms/actuation inhaler", "5 mg/mL nebuliser solution"] },
  { name: "Beclometasone (inhaled)", activeIngredient: "beclometasone dipropionate", drugClass: "Inhaled corticosteroids", commonRoutes: ["inhaled"], formulations: ["100 micrograms/actuation inhaler"] },
  { name: "Fluticasone/Salmeterol", activeIngredient: "fluticasone + salmeterol", drugClass: "Inhaled combination therapy", commonRoutes: ["inhaled"], formulations: ["250/25 micrograms inhaler"] },
  { name: "Prednisolone", activeIngredient: "prednisolone", drugClass: "Corticosteroids", commonRoutes: ["oral"], formulations: ["5 mg tablet", "20 mg tablet"], notes: "Taper on withdrawal; monitor glucose and blood pressure." },
  { name: "Oral rehydration salts", activeIngredient: "sodium chloride + glucose + electrolytes", drugClass: "Rehydration therapy", commonRoutes: ["oral"], formulations: ["Sachet for 200 mL or 1 L"] },
  { name: "Ferrous sulfate", activeIngredient: "ferrous sulfate", drugClass: "Iron supplements", commonRoutes: ["oral"], formulations: ["200 mg tablet (65 mg elemental iron)"] },
  { name: "Aluminium hydroxide", activeIngredient: "aluminium hydroxide", drugClass: "Antacids", commonRoutes: ["oral"], formulations: ["500 mg tablet"] },
  { name: "Ondansetron", activeIngredient: "ondansetron", drugClass: "Anti-emetics", pharmacologicalClass: "5-HT3 antagonist", commonRoutes: ["oral", "intravenous"], formulations: ["4 mg tablet", "4 mg/2 mL injection"], notes: "QT precautions." },
  { name: "Chlorphenamine", activeIngredient: "chlorphenamine maleate", drugClass: "Antihistamines", commonRoutes: ["oral"], formulations: ["4 mg tablet"] },
  { name: "Hydrocortisone (topical)", activeIngredient: "hydrocortisone", drugClass: "Topical corticosteroids", commonRoutes: ["topical"], formulations: ["1% cream"] },
  { name: "Mupirocin (topical)", activeIngredient: "mupirocin", drugClass: "Topical antibiotics", antimicrobialSpectrum: ["GRAM_POSITIVE"], commonRoutes: ["topical"], formulations: ["2% ointment"] },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const med of MEDICATIONS) {
    const existing = await prisma.medicationReference.findFirst({ where: { name: med.name } });
    const data = {
      name: med.name,
      activeIngredient: med.activeIngredient,
      drugClass: med.drugClass,
      pharmacologicalClass: med.pharmacologicalClass ?? null,
      antibioticClass: med.antibioticClass ?? null,
      antimicrobialSpectrum: med.antimicrobialSpectrum ?? [],
      commonRoutes: med.commonRoutes ?? [],
      formulations: med.formulations,
      interactionSource: "rxnav",
      verified: true,
      verifiedSource: "curated:platform",
      lastReviewedAt: new Date(),
      notes: med.notes ?? null,
    };
    if (existing) {
      await prisma.medicationReference.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.medicationReference.create({ data });
      created++;
    }
  }
  console.log(`Medication reference seed complete: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
