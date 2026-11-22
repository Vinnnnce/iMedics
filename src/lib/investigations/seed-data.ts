import type { InvestigationDomain, InvestigationReportFormat } from "@prisma/client";

/**
 * Starter content for the central investigation catalogue. Facilities and
 * platform administrators extend it at runtime; nothing here is hard-coded into
 * a UI component.
 *
 * Standard codes: this file ships LOINC codes ONLY for common analytes whose
 * code the authors are certain of (see ANALYTES), and every item is seeded with
 * standardCodesVerified = false. No SNOMED CT concept ids are shipped (SNOMED CT
 * needs a licence / affiliate release); import them with the catalogue import
 * script once clinical informatics has verified them. Local codes (M19-...) are
 * clearly not international codes.
 */

export interface SeedCategory {
  domain: InvestigationDomain;
  key: string;
  name: string;
  description: string;
  icon: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  // Laboratory disciplines
  { domain: "LABORATORY", key: "haematology", name: "Haematology", description: "Blood counts, coagulation and specialised haematology.", icon: "Droplets" },
  { domain: "LABORATORY", key: "microbiology", name: "Microbiology", description: "Cultures, microscopy, susceptibility, virology and mycology.", icon: "Bug" },
  { domain: "LABORATORY", key: "clinical-biochemistry", name: "Clinical Biochemistry", description: "Renal, liver, glucose, lipids, cardiac markers, endocrinology.", icon: "FlaskConical" },
  { domain: "LABORATORY", key: "histopathology", name: "Histopathology and Cytopathology", description: "Tissue, cytology, frozen section and special stains.", icon: "Microscope" },
  { domain: "LABORATORY", key: "immunology-serology", name: "Immunology and Serology", description: "Serology, autoimmune and allergy testing.", icon: "ShieldCheck" },
  { domain: "LABORATORY", key: "molecular-genetics", name: "Molecular Diagnostics and Genetics", description: "PCR, sequencing, cytogenetics and pharmacogenomics.", icon: "Dna" },
  { domain: "LABORATORY", key: "parasitology", name: "Parasitology", description: "Stool, blood and urine parasite examination.", icon: "Worm" },
  { domain: "LABORATORY", key: "blood-transfusion", name: "Blood Transfusion", description: "Grouping, crossmatching and antibody investigations.", icon: "Syringe" },
  { domain: "LABORATORY", key: "urinalysis-body-fluids", name: "Urinalysis and Body Fluids", description: "Urine, stool and other body fluid analysis.", icon: "TestTube" },
  { domain: "LABORATORY", key: "toxicology", name: "Toxicology", description: "Drug screening and therapeutic drug monitoring.", icon: "Skull" },
  { domain: "LABORATORY", key: "other-laboratory", name: "Other Laboratory Investigations", description: "Investigations not listed elsewhere.", icon: "FlaskRound" },
  // Diagnostic departments
  { domain: "DIAGNOSTIC", key: "radiology", name: "Radiology and X-ray", description: "General, digital, contrast and dental radiography; DEXA.", icon: "ScanLine" },
  { domain: "DIAGNOSTIC", key: "ct", name: "CT Imaging", description: "Computed tomography.", icon: "Scan" },
  { domain: "DIAGNOSTIC", key: "mri", name: "MRI", description: "Magnetic resonance imaging.", icon: "Magnet" },
  { domain: "DIAGNOSTIC", key: "ultrasound", name: "Ultrasound and Sonography", description: "Ultrasound, Doppler and echocardiography.", icon: "Waves" },
  { domain: "DIAGNOSTIC", key: "mammography", name: "Mammography", description: "Breast imaging.", icon: "ScanHeart" },
  { domain: "DIAGNOSTIC", key: "nuclear-medicine", name: "Nuclear Medicine", description: "PET, SPECT and scintigraphy.", icon: "Atom" },
  { domain: "DIAGNOSTIC", key: "cardiology", name: "Cardiology Diagnostics", description: "ECG, monitoring, stress testing and cardiac procedures.", icon: "HeartPulse" },
  { domain: "DIAGNOSTIC", key: "neurology", name: "Neurological Diagnostics", description: "EEG, EMG, evoked potentials and sleep studies.", icon: "Brain" },
  { domain: "DIAGNOSTIC", key: "respiratory", name: "Respiratory Diagnostics", description: "Lung function testing and bronchoscopy.", icon: "Wind" },
  { domain: "DIAGNOSTIC", key: "gastroenterology-endoscopy", name: "Gastroenterology and Endoscopy", description: "Endoscopic procedures.", icon: "Cable" },
  { domain: "DIAGNOSTIC", key: "urology", name: "Urological Diagnostics", description: "Cystoscopy, urodynamics and renal tract studies.", icon: "Droplet" },
  { domain: "DIAGNOSTIC", key: "ophthalmology", name: "Ophthalmological Diagnostics", description: "OCT, fundus, visual fields and ocular studies.", icon: "Eye" },
  { domain: "DIAGNOSTIC", key: "ent-audiology", name: "ENT and Audiology", description: "Audiometry, vestibular testing and ENT endoscopy.", icon: "Ear" },
  { domain: "DIAGNOSTIC", key: "obstetric-gynaecology", name: "Obstetric and Gynaecological Diagnostics", description: "Fetal monitoring, HSG, colposcopy, hysteroscopy.", icon: "Baby" },
  { domain: "DIAGNOSTIC", key: "interventional-radiology", name: "Interventional Radiology", description: "Image-guided diagnostic procedures.", icon: "Crosshair" },
  { domain: "DIAGNOSTIC", key: "other-diagnostics", name: "Other Diagnostic Procedures", description: "Procedures not listed elsewhere.", icon: "Stethoscope" },
];

/** How the doctor's diagnostic browser groups departments (view-layer only). */
export const DOCTOR_DIAGNOSTIC_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Radiology and Medical Imaging", keys: ["radiology", "ct", "mri", "mammography"] },
  { title: "Ultrasound and Sonography", keys: ["ultrasound"] },
  { title: "Nuclear Medicine and Molecular Imaging", keys: ["nuclear-medicine"] },
  { title: "Cardiology and Cardiovascular Diagnostics", keys: ["cardiology"] },
  { title: "Neurological Diagnostics", keys: ["neurology"] },
  { title: "Respiratory and Pulmonary Diagnostics", keys: ["respiratory"] },
  { title: "Gastroenterology and Endoscopy", keys: ["gastroenterology-endoscopy"] },
  { title: "Urology and Renal Diagnostics", keys: ["urology"] },
  { title: "Ophthalmological Diagnostics", keys: ["ophthalmology"] },
  { title: "ENT and Audiology", keys: ["ent-audiology"] },
  { title: "Obstetric and Gynaecological Diagnostics", keys: ["obstetric-gynaecology"] },
  { title: "Interventional Radiology and Image-guided Procedures", keys: ["interventional-radiology"] },
  { title: "Other Diagnostics", keys: ["other-diagnostics"] },
];

export interface SeedItem {
  domain: InvestigationDomain;
  category: string;
  subcategory: string;
  name: string;
  abbreviation?: string;
  synonyms: string[];
  specimen?: string;
  modality?: string;
  dicom?: string;
  bodySite?: string;
  format: InvestigationReportFormat;
  prep?: string;
  tatMinutes?: number;
  discipline?: string;
}

interface Group {
  domain: InvestigationDomain;
  category: string;
  subcategory: string;
  format: InvestigationReportFormat;
  specimen?: string;
  modality?: string;
  dicom?: string;
  prep?: string;
  tatMinutes?: number;
  discipline?: string;
  /** "Name|ABBR|synonym;synonym" — abbreviation and synonyms are optional. */
  items: string[];
}

const H = 60;
const D = 24 * 60;

const GROUPS: Group[] = [
  // ------------------------------ LABORATORY ------------------------------
  { domain: "LABORATORY", category: "haematology", subcategory: "Full blood and cell count", format: "LAB_PANEL", specimen: "Whole blood (EDTA)", tatMinutes: 4 * H, discipline: "Haematology", items: [
    "Full Blood Count|FBC|full blood count;complete blood count;CBC;hemogram", "Complete Blood Count|CBC|full blood count", "CBC with differential|CBC diff|full blood count with differential",
    "Haemoglobin|Hb|hemoglobin;Hgb", "Haematocrit|Hct|hematocrit;PCV;packed cell volume", "Red Blood Cell Count|RBC|erythrocyte count", "White Blood Cell Count|WBC|leucocyte count;leukocyte count", "Differential White Blood Cell Count|Diff|WBC differential",
    "Platelet Count|PLT|thrombocyte count", "Mean Corpuscular Volume|MCV", "Mean Corpuscular Haemoglobin|MCH", "Mean Corpuscular Haemoglobin Concentration|MCHC", "Red Cell Distribution Width|RDW",
    "Reticulocyte Count|Retic|reticulocytes", "Peripheral Blood Film|PBF|blood film;blood smear", "Blood Film Morphology|BFM|blood film morphology", "Erythrocyte Sedimentation Rate|ESR|sed rate"] },
  { domain: "LABORATORY", category: "haematology", subcategory: "Coagulation", format: "LAB_PANEL", specimen: "Citrated plasma", tatMinutes: 4 * H, discipline: "Haematology", items: [
    "Prothrombin Time|PT|protime", "INR|INR|international normalised ratio;international normalized ratio", "Activated Partial Thromboplastin Time|APTT|aPTT;PTT", "Thrombin Time|TT", "Fibrinogen|Fib", "D-dimer|D-dimer|ddimer", "Coagulation Profile|Coag|coag screen;clotting screen", "Other coagulation studies"] },
  { domain: "LABORATORY", category: "haematology", subcategory: "Specialised haematology", format: "LAB_PANEL", specimen: "Whole blood (EDTA)", tatMinutes: 3 * D, discipline: "Haematology", items: [
    "Haemoglobin Electrophoresis|Hb electrophoresis|hemoglobin electrophoresis;Hb genotype", "Sickle Cell Screening|Sickling test|sickle test;sickling", "Sickle Cell Genotyping|HbSS genotype", "G6PD Testing|G6PD|glucose-6-phosphate dehydrogenase",
    "Bone Marrow Aspiration|BMA", "Bone Marrow Biopsy|BMB|trephine biopsy", "Flow Cytometry|Flow|immunophenotyping", "Other specialised haematological tests"] },

  { domain: "LABORATORY", category: "microbiology", subcategory: "Bacteriology", format: "NARRATIVE", tatMinutes: 3 * D, discipline: "Medical microbiology", items: [
    "Blood Culture|BC|blood culture and sensitivity", "Urine Culture|MSU culture|urine m/c/s;urine mcs", "Stool Culture|Stool MCS|stool m/c/s", "Sputum Culture|Sputum MCS", "Wound Swab Culture|Wound MCS", "Throat Swab Culture|Throat swab MCS",
    "Ear Swab Culture|Ear swab MCS", "Eye Swab Culture|Eye swab MCS", "Vaginal Swab Culture|HVS|high vaginal swab", "Urethral Swab Culture|Urethral swab MCS", "Cerebrospinal Fluid Culture|CSF culture", "Pus Culture|Pus MCS", "Semen Culture|Semen MCS",
    "Catheter Tip Culture|Cath tip culture", "Other bacterial cultures"] },
  { domain: "LABORATORY", category: "microbiology", subcategory: "Microscopy", format: "NARRATIVE", tatMinutes: 1 * D, discipline: "Medical microbiology", items: [
    "Gram Stain|Gram|gram film", "Ziehl-Neelsen Stain|ZN|ZN stain;AFB stain", "Acid-Fast Bacilli Examination|AFB|AAFB", "Wet Mount Microscopy|Wet mount|wet prep", "Sputum Microscopy", "Stool Microscopy", "Urine Microscopy|Urine MC", "Other microscopic examinations"] },
  { domain: "LABORATORY", category: "microbiology", subcategory: "Antimicrobial susceptibility", format: "NARRATIVE", tatMinutes: 3 * D, discipline: "Medical microbiology", items: [
    "Antibiotic Sensitivity Testing|AST|sensitivity;antibiogram", "Antimicrobial Susceptibility Testing|AST|susceptibility", "Minimum Inhibitory Concentration|MIC", "Resistance Pattern Analysis", "Other susceptibility investigations"] },
  { domain: "LABORATORY", category: "microbiology", subcategory: "Virology and mycology", format: "NARRATIVE", tatMinutes: 3 * D, discipline: "Medical microbiology", items: [
    "Viral investigations", "Fungal Culture", "Fungal Microscopy|KOH mount|KOH prep", "Other specialised microbiology tests"] },
  { domain: "LABORATORY", category: "microbiology", subcategory: "Infectious disease investigations", format: "NARRATIVE", tatMinutes: 1 * D, discipline: "Medical microbiology", items: [
    "Tuberculosis testing|TB test", "Malaria testing|Malaria RDT", "HIV testing|HIV test", "Hepatitis testing|Hepatitis screen", "Other pathogen-specific investigations"] },

  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Renal function", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 6 * H, discipline: "Clinical biochemistry", items: [
    "Urea|Urea|blood urea nitrogen;BUN", "Creatinine|Creat", "Estimated Glomerular Filtration Rate|eGFR", "Uric Acid|Urate", "Electrolytes|E/U|electrolytes;U&E;urea and electrolytes", "Sodium|Na", "Potassium|K", "Chloride|Cl", "Bicarbonate|HCO3|total CO2", "Calcium|Ca", "Phosphate|PO4|phosphorus", "Magnesium|Mg", "Renal Function Panel|RFT|renal function test;kidney function test;urea electrolytes creatinine"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Liver function", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 6 * H, discipline: "Clinical biochemistry", items: [
    "ALT|ALT|alanine aminotransferase;SGPT", "AST|AST|aspartate aminotransferase;SGOT", "ALP|ALP|alkaline phosphatase", "GGT|GGT|gamma glutamyl transferase", "Total Bilirubin|T Bil", "Direct Bilirubin|D Bil|conjugated bilirubin", "Albumin|Alb", "Total Protein|TP", "Liver Function Panel|LFT|liver function test;LFTs"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Glucose and metabolic testing", format: "LAB_PANEL", specimen: "Plasma (fluoride oxalate) / serum", tatMinutes: 4 * H, discipline: "Clinical biochemistry", items: [
    "Fasting Blood Glucose|FBG|FBS;fasting blood sugar", "Random Blood Glucose|RBG|RBS;random blood sugar", "Postprandial Blood Glucose|PPBG|2hr post prandial", "HbA1c|HbA1c|glycated haemoglobin;glycosylated haemoglobin", "Oral Glucose Tolerance Test|OGTT|glucose tolerance test",
    "Insulin", "C-peptide|C-pep", "Other diabetes-related investigations"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Lipid profile", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 6 * H, discipline: "Clinical biochemistry", items: [
    "Total Cholesterol|TC|cholesterol", "HDL Cholesterol|HDL", "LDL Cholesterol|LDL", "Triglycerides|TG|TAG", "Other lipid investigations", "Lipid Profile|Lipids|fasting lipid profile;lipid panel"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Cardiac biomarkers", format: "LAB_PANEL", specimen: "Serum / plasma", tatMinutes: 2 * H, discipline: "Clinical biochemistry", items: [
    "Troponin|Trop|cardiac troponin;hs-troponin", "CK-MB|CKMB", "Creatine Kinase|CK|CPK", "BNP|BNP|brain natriuretic peptide", "NT-proBNP|NT-proBNP"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Endocrinology", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 2 * D, discipline: "Clinical biochemistry", items: [
    "TSH|TSH|thyroid stimulating hormone", "Free T3|FT3", "Free T4|FT4", "Cortisol", "ACTH|ACTH|adrenocorticotropic hormone", "Prolactin|PRL", "Testosterone", "Oestrogen|E2|estrogen;estradiol", "Progesterone", "LH|LH|luteinising hormone", "FSH|FSH|follicle stimulating hormone", "Growth Hormone|GH", "Other hormone investigations"] },
  { domain: "LABORATORY", category: "clinical-biochemistry", subcategory: "Other biochemical investigations", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 1 * D, discipline: "Clinical biochemistry", items: [
    "Amylase", "Lipase", "Lactate", "C-reactive Protein|CRP", "Procalcitonin|PCT", "Iron Studies|Iron studies|serum iron;TIBC", "Ferritin", "Vitamin B12|B12|cobalamin", "Folate|Folic acid", "Vitamin D|25-OH vitamin D|25-hydroxyvitamin D", "Tumour Markers|Tumor markers|tumor markers", "Other specialised biochemical tests"] },

  { domain: "LABORATORY", category: "histopathology", subcategory: "Tissue and cellular investigations", format: "NARRATIVE", specimen: "Tissue / cytology preparation", tatMinutes: 7 * D, discipline: "Histopathology", items: [
    "Histopathology|Histo", "Surgical Pathology", "Tissue Biopsy Examination|Biopsy", "Excision Specimen Examination", "Fine Needle Aspiration Cytology|FNAC|FNA", "Cytology", "Cervical Cytology / Pap Smear|Pap smear|pap test;cervical smear;cervical screening", "Body Fluid Cytology",
    "Pleural Fluid Cytology", "Ascitic Fluid Cytology", "Cerebrospinal Fluid Cytology|CSF cytology", "Immunohistochemistry|IHC", "Special Stains", "Frozen Section|Intra-op frozen section", "Bone Marrow Histopathology", "Molecular Pathology", "Other tissue and cellular investigations"] },

  { domain: "LABORATORY", category: "immunology-serology", subcategory: "Immunology and serology", format: "LAB_PANEL", specimen: "Serum", tatMinutes: 2 * D, discipline: "Immunology", items: [
    "HIV Screening|HIV screen", "Hepatitis B Surface Antigen|HBsAg", "Hepatitis C Antibody|HCV Ab|anti-HCV", "Syphilis Serology|VDRL|VDRL;TPHA", "Rheumatoid Factor|RF|RF factor", "Anti-CCP|Anti-CCP|anti cyclic citrullinated peptide", "ANA|ANA|antinuclear antibody", "Anti-dsDNA|Anti-dsDNA",
    "Complement C3 and C4|C3 C4", "Immunoglobulins|Igs|IgG IgA IgM", "Allergy Testing|Allergy panel|specific IgE", "Autoimmune Antibody Panels", "TORCH Screening|TORCH", "Other immunological and serological tests"] },

  { domain: "LABORATORY", category: "molecular-genetics", subcategory: "Molecular and genetic investigations", format: "NARRATIVE", specimen: "Whole blood / tissue / swab", tatMinutes: 5 * D, discipline: "Molecular genetics", items: [
    "PCR|PCR|polymerase chain reaction", "Real-Time PCR|qPCR|real time PCR", "RT-PCR|RT-PCR|reverse transcription PCR", "Gene Mutation Analysis", "Genetic Screening", "Chromosomal Analysis", "Karyotyping|Karyotype", "FISH|FISH|fluorescence in situ hybridisation",
    "DNA Sequencing|Sanger sequencing", "Next-Generation Sequencing|NGS", "Pharmacogenomic Testing|PGx", "Molecular Infectious Disease Testing", "Other genetic and molecular investigations"] },

  { domain: "LABORATORY", category: "parasitology", subcategory: "Parasitology", format: "NARRATIVE", tatMinutes: 1 * D, discipline: "Parasitology", items: [
    "Stool Ova and Parasite Examination|O&P|ova cysts and parasites;stool O/P", "Malaria Parasite Test|MP|MP;malaria parasite;malaria smear", "Malaria Parasite Quantification|MP count|parasite density", "Blood Parasite Examination", "Blood Film for Parasites|BFFP|blood film for malaria",
    "Urine Parasite Examination", "Schistosomiasis Testing|Schisto", "Other parasitological investigations"] },

  { domain: "LABORATORY", category: "blood-transfusion", subcategory: "Immunohaematology", format: "NARRATIVE", specimen: "Whole blood (EDTA)", tatMinutes: 2 * H, discipline: "Transfusion medicine", items: [
    "ABO Blood Grouping|ABO|blood group", "Rh Typing|Rh|rhesus typing;Rh D typing", "Blood Group Confirmation", "Crossmatching|XM|cross match;crossmatch", "Antibody Screening|Ab screen", "Antibody Identification|Ab ID", "Direct Antiglobulin Test|DAT|direct Coombs",
    "Indirect Antiglobulin Test|IAT|indirect Coombs", "Compatibility Testing", "Blood Product Testing", "Other transfusion investigations"] },

  { domain: "LABORATORY", category: "urinalysis-body-fluids", subcategory: "Urine", format: "LAB_PANEL", specimen: "Urine", tatMinutes: 4 * H, discipline: "Clinical pathology", items: [
    "Routine Urinalysis|Urinalysis|urine analysis;urine R/E;urine routine", "Urine Dipstick|Dipstick|urine dip", "Urine Protein", "Urine Albumin", "Urine Albumin-Creatinine Ratio|ACR|uACR", "Urine Protein-Creatinine Ratio|PCR (urine)|uPCR",
    "24-Hour Urine Collection|24h urine", "Urine Pregnancy Test|UPT|pregnancy test;hCG urine", "Urine Toxicology", "Other urine investigations"] },
  { domain: "LABORATORY", category: "urinalysis-body-fluids", subcategory: "Stool", format: "LAB_PANEL", specimen: "Stool", tatMinutes: 1 * D, discipline: "Clinical pathology", items: [
    "Stool Routine Examination|Stool R/E|stool analysis;stool routine", "Faecal Occult Blood|FOB|FOBT;occult blood", "Faecal Calprotectin|Calprotectin", "Stool Antigen Testing|Stool Ag", "Stool Parasite Examination", "Other stool investigations"] },
  { domain: "LABORATORY", category: "urinalysis-body-fluids", subcategory: "Other body fluids", format: "NARRATIVE", specimen: "Body fluid", tatMinutes: 1 * D, discipline: "Clinical pathology", items: [
    "Cerebrospinal Fluid Analysis|CSF analysis", "Pleural Fluid Analysis", "Ascitic Fluid Analysis", "Synovial Fluid Analysis", "Pericardial Fluid Analysis", "Semen Analysis|SFA|seminal fluid analysis", "Other body fluid investigations"] },

  { domain: "LABORATORY", category: "toxicology", subcategory: "Toxicology and therapeutic drug monitoring", format: "LAB_PANEL", specimen: "Serum / urine", tatMinutes: 2 * D, discipline: "Toxicology", items: [
    "Drug Screening", "Urine Drug Screen|UDS", "Blood Alcohol Testing|BAC|blood ethanol", "Toxicology Screening", "Therapeutic Drug Monitoring|TDM", "Digoxin Level", "Lithium Level", "Valproate Level|Valproic acid level", "Phenytoin Level", "Carbamazepine Level", "Other drug concentration tests"] },

  // ------------------------------ DIAGNOSTICS ------------------------------
  { domain: "DIAGNOSTIC", category: "radiology", subcategory: "General radiography", format: "XRAY", modality: "X-ray", dicom: "DX", tatMinutes: 1 * D, discipline: "Radiology", items: [
    "General X-ray|XR", "Digital X-ray|DR|digital radiography", "Portable X-ray|Portable XR|mobile X-ray", "Chest X-ray|CXR|chest radiograph", "Abdominal X-ray|AXR", "Skull X-ray", "Spine X-ray", "Pelvic X-ray", "Extremity X-ray|Limb X-ray", "Dental X-ray|OPG|dental radiograph"] },
  { domain: "DIAGNOSTIC", category: "radiology", subcategory: "Fluoroscopy and contrast studies", format: "XRAY", modality: "Fluoroscopy", dicom: "RF", prep: "Preparation depends on the study; the facility confirms.", tatMinutes: 2 * D, discipline: "Radiology", items: [
    "Fluoroscopy", "Contrast radiography|Barium studies|contrast study"] },
  { domain: "DIAGNOSTIC", category: "radiology", subcategory: "Bone densitometry", format: "XRAY", modality: "DEXA", tatMinutes: 2 * D, discipline: "Radiology", items: ["Bone densitometry (DEXA/DXA)|DEXA|DXA;bone density;bone mineral density"] },
  { domain: "DIAGNOSTIC", category: "mammography", subcategory: "Breast imaging", format: "MAMMOGRAPHY", modality: "Mammography", dicom: "MG", tatMinutes: 2 * D, discipline: "Radiology", items: [
    "Mammography|Mammogram", "Digital mammography|Digital mammogram", "Breast tomosynthesis|Tomosynthesis|3D mammography"] },
  { domain: "DIAGNOSTIC", category: "ct", subcategory: "Computed tomography", format: "CT", modality: "CT", dicom: "CT", tatMinutes: 2 * D, discipline: "Radiology", items: [
    "Computed Tomography (CT)|CT|CT scan", "CT brain|CT head", "CT chest|CT thorax", "CT abdomen", "CT pelvis", "CT angiography|CTA", "CT pulmonary angiography|CTPA", "CT spine", "CT cardiac imaging|Cardiac CT", "CT urography|CTU"] },
  { domain: "DIAGNOSTIC", category: "mri", subcategory: "Magnetic resonance imaging", format: "MRI", modality: "MRI", dicom: "MR", tatMinutes: 3 * D, discipline: "Radiology", items: [
    "Magnetic Resonance Imaging (MRI)|MRI|MR scan", "MRI brain|MRI head", "MRI spine", "MRI musculoskeletal system|MRI MSK", "MRI abdomen", "MRI pelvis", "MRI cardiac|Cardiac MRI|CMR", "MR angiography|MRA", "MR venography|MRV", "Magnetic resonance cholangiopancreatography (MRCP)|MRCP"] },

  { domain: "DIAGNOSTIC", category: "ultrasound", subcategory: "General and obstetric ultrasound", format: "ULTRASOUND", modality: "Ultrasound", dicom: "US", tatMinutes: 1 * D, discipline: "Radiology / sonography", items: [
    "Abdominal ultrasound|Abdominal USS|abdominal scan;abdominal sonography", "Pelvic ultrasound|Pelvic USS|pelvic scan", "Obstetric ultrasound|Obstetric USS|antenatal scan;pregnancy scan", "Pregnancy dating scan|Dating scan", "Fetal anomaly scan|Anomaly scan", "Fetal growth scan|Growth scan",
    "Transvaginal ultrasound|TVS|TVUSS", "Transrectal ultrasound|TRUS", "Breast ultrasound", "Thyroid ultrasound|Neck scan", "Renal ultrasound|KUB scan", "Prostate ultrasound", "Scrotal ultrasound", "Musculoskeletal ultrasound|MSK ultrasound", "Soft-tissue ultrasound", "Neonatal cranial ultrasound|Cranial USS", "Other specialised ultrasound examinations"] },
  { domain: "DIAGNOSTIC", category: "ultrasound", subcategory: "Doppler and vascular ultrasound", format: "ULTRASOUND", modality: "Ultrasound Doppler", dicom: "US", tatMinutes: 1 * D, discipline: "Radiology / sonography", items: [
    "Testicular Doppler", "Carotid Doppler", "Venous Doppler", "Arterial Doppler", "Lower-limb Doppler", "Upper-limb Doppler", "Peripheral vascular ultrasound", "Abdominal Doppler"] },
  { domain: "DIAGNOSTIC", category: "ultrasound", subcategory: "Echocardiography", format: "ECHOCARDIOGRAPHY", modality: "Echocardiography", dicom: "US", tatMinutes: 1 * D, discipline: "Cardiology", items: [
    "Echocardiography|Echo|cardiac ultrasound", "Transthoracic echocardiography|TTE", "Transoesophageal echocardiography|TOE|TEE;transesophageal echocardiography", "Stress echocardiography|Stress echo"] },

  { domain: "DIAGNOSTIC", category: "nuclear-medicine", subcategory: "Nuclear medicine and molecular imaging", format: "NARRATIVE", modality: "Nuclear medicine", dicom: "NM", prep: "Radiopharmaceutical preparation is provided by the facility.", tatMinutes: 3 * D, discipline: "Nuclear medicine", items: [
    "PET scan|PET", "PET-CT|PET/CT", "PET-MRI|PET/MRI", "SPECT", "SPECT-CT|SPECT/CT", "Bone scintigraphy|Bone scan", "Thyroid scintigraphy|Thyroid scan", "Renal scintigraphy|Renal scan;DMSA;MAG3", "Hepatobiliary scintigraphy|HIDA scan", "Myocardial perfusion imaging|MPI|myocardial perfusion scan",
    "Lung ventilation/perfusion scan|V/Q scan|VQ scan", "Sentinel lymph node imaging", "Other nuclear medicine studies"] },

  { domain: "DIAGNOSTIC", category: "cardiology", subcategory: "Cardiology and cardiovascular diagnostics", format: "ECG", modality: "Cardiac", tatMinutes: 1 * D, discipline: "Cardiology", items: [
    "12-lead ECG|ECG|EKG;electrocardiogram", "Resting ECG", "Exercise ECG|Exercise tolerance test;ETT", "Stress testing|Treadmill test;stress test", "Holter monitoring|Holter|24 hour ECG", "Ambulatory blood pressure monitoring|ABPM|24 hour blood pressure", "Event recorder", "Long-term ECG monitoring",
    "Vascular Doppler", "Cardiac catheterisation|Cath|cardiac catheterization", "Coronary angiography|Coronary angiogram", "Peripheral angiography", "Electrophysiology studies|EP study", "Other cardiac investigations"] },

  { domain: "DIAGNOSTIC", category: "neurology", subcategory: "Neurological diagnostics", format: "EEG", modality: "Neurophysiology", tatMinutes: 2 * D, discipline: "Neurophysiology", items: [
    "Electroencephalography (EEG)|EEG", "Video EEG|VEEG", "Ambulatory EEG", "Electromyography (EMG)|EMG", "Nerve conduction studies|NCS|NCV", "Evoked potentials|EP", "Visual evoked potentials|VEP", "Auditory evoked potentials|AEP", "Somatosensory evoked potentials|SSEP", "Sleep studies", "Polysomnography|PSG", "Other neurological investigations"] },

  { domain: "DIAGNOSTIC", category: "respiratory", subcategory: "Respiratory and pulmonary diagnostics", format: "GENERIC", modality: "Pulmonary function", tatMinutes: 1 * D, discipline: "Respiratory medicine", items: [
    "Spirometry", "Pulmonary function testing|PFT|lung function test", "Lung volume measurement", "Diffusion capacity testing|DLCO|TLCO", "Peak expiratory flow testing|PEFR|peak flow", "Bronchoscopy", "Flexible bronchoscopy", "Sleep respiratory studies", "Exercise oximetry", "Arterial blood gas analysis|ABG|blood gas", "Other pulmonary investigations"] },

  { domain: "DIAGNOSTIC", category: "gastroenterology-endoscopy", subcategory: "Endoscopy", format: "ENDOSCOPY", modality: "Endoscopy", dicom: "ES", prep: "Fasting and bowel preparation instructions are provided by the facility.", tatMinutes: 2 * D, discipline: "Gastroenterology", items: [
    "Upper gastrointestinal endoscopy|Upper GI endoscopy|OGD;oesophagogastroduodenoscopy", "Gastroscopy", "Oesophagoscopy|Esophagoscopy", "Colonoscopy", "Sigmoidoscopy", "Capsule endoscopy", "ERCP|ERCP|endoscopic retrograde cholangiopancreatography", "Endoscopic ultrasound|EUS", "Other endoscopic procedures"] },

  { domain: "DIAGNOSTIC", category: "urology", subcategory: "Urological and renal diagnostics", format: "GENERIC", modality: "Urology", tatMinutes: 2 * D, discipline: "Urology", items: [
    "Cystoscopy", "Urodynamic studies|Urodynamics", "Uroflowmetry|Flow rate", "Bladder scan", "Renal tract imaging", "Retrograde pyelography|RPG", "Other urological investigations"] },

  { domain: "DIAGNOSTIC", category: "ophthalmology", subcategory: "Ophthalmological diagnostics", format: "GENERIC", modality: "Ophthalmic", tatMinutes: 1 * D, discipline: "Ophthalmology", items: [
    "Optical coherence tomography (OCT)|OCT", "Fundus photography", "Fluorescein angiography|FFA", "Visual field testing|Perimetry;visual fields", "Tonometry|IOP", "Corneal topography", "Slit-lamp examination", "Ocular ultrasound", "Other ophthalmic investigations"] },

  { domain: "DIAGNOSTIC", category: "ent-audiology", subcategory: "ENT and audiology", format: "GENERIC", modality: "Audiology / ENT", tatMinutes: 1 * D, discipline: "ENT", items: [
    "Pure-tone audiometry|PTA|audiogram", "Tympanometry", "Otoacoustic emissions|OAE", "Auditory brainstem response|ABR|BERA", "Vestibular function testing", "Nasal endoscopy", "Laryngoscopy", "Other ENT investigations"] },

  { domain: "DIAGNOSTIC", category: "obstetric-gynaecology", subcategory: "Obstetric and gynaecological diagnostics", format: "GENERIC", modality: "Obstetric / gynaecological", tatMinutes: 1 * D, discipline: "Obstetrics and gynaecology", items: [
    "Fetal biophysical profile|BPP", "Fetal Doppler", "Cardiotocography (CTG)|CTG", "Non-stress test|NST", "Hysterosalpingography|HSG", "Colposcopy", "Hysteroscopy", "Other obstetric and gynaecological investigations"] },

  { domain: "DIAGNOSTIC", category: "interventional-radiology", subcategory: "Image-guided diagnostic procedures", format: "GENERIC", modality: "Interventional radiology", dicom: "XA", prep: "Consent and pre-procedure checks are managed by the facility.", tatMinutes: 3 * D, discipline: "Interventional radiology", items: [
    "Image-guided biopsy", "Ultrasound-guided aspiration", "CT-guided biopsy", "Image-guided drainage", "Angiography-guided procedures", "Image-guided catheter placement", "Other interventional diagnostic procedures"] },
];

function parse(g: Group, line: string): SeedItem {
  const [name, abbr, syn] = line.split("|");
  return {
    domain: g.domain,
    category: g.category,
    subcategory: g.subcategory,
    name: name.trim(),
    abbreviation: abbr?.trim() || undefined,
    synonyms: syn ? syn.split(";").map((s) => s.trim()).filter(Boolean) : [],
    specimen: g.specimen,
    modality: g.modality,
    dicom: g.dicom,
    format: g.format,
    prep: g.prep,
    tatMinutes: g.tatMinutes,
    discipline: g.discipline,
  };
}

export const SEED_ITEMS: SeedItem[] = GROUPS.flatMap((g) => g.items.map((l) => parse(g, l)));

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Stable local code. The "M19" prefix marks it as a Medic1905 local code, never an international one. */
export function localCode(item: Pick<SeedItem, "domain" | "category" | "name">): string {
  return `M19-${item.domain === "LABORATORY" ? "LAB" : "DX"}-${slug(item.category).toUpperCase()}-${slug(item.name).toUpperCase()}`;
}

export interface SeedAnalyte {
  code: string;
  name: string;
  /** LOINC code, only where certain. Reference ranges are intentionally NOT seeded: facilities configure validated ranges. */
  loinc?: string;
  ucum?: string;
}

/** Analytes per catalogue item name (UCUM units; ranges are set per facility). */
export const SEED_ANALYTES: Record<string, SeedAnalyte[]> = {
  "Full Blood Count": [
    { code: "HB", name: "Haemoglobin", loinc: "718-7", ucum: "g/dL" }, { code: "HCT", name: "Haematocrit", loinc: "4544-3", ucum: "%" }, { code: "RBC", name: "Red blood cell count", loinc: "789-8", ucum: "10*12/L" },
    { code: "WBC", name: "White blood cell count", loinc: "6690-2", ucum: "10*9/L" }, { code: "PLT", name: "Platelet count", loinc: "777-3", ucum: "10*9/L" }, { code: "MCV", name: "MCV", loinc: "787-2", ucum: "fL" },
    { code: "MCH", name: "MCH", loinc: "785-6", ucum: "pg" }, { code: "MCHC", name: "MCHC", loinc: "786-4", ucum: "g/dL" }, { code: "RDW", name: "RDW", loinc: "788-0", ucum: "%" },
  ],
  "Haemoglobin": [{ code: "HB", name: "Haemoglobin", loinc: "718-7", ucum: "g/dL" }],
  "Haematocrit": [{ code: "HCT", name: "Haematocrit", loinc: "4544-3", ucum: "%" }],
  "Platelet Count": [{ code: "PLT", name: "Platelet count", loinc: "777-3", ucum: "10*9/L" }],
  "White Blood Cell Count": [{ code: "WBC", name: "White blood cell count", loinc: "6690-2", ucum: "10*9/L" }],
  "Renal Function Panel": [
    { code: "NA", name: "Sodium", loinc: "2951-2", ucum: "mmol/L" }, { code: "K", name: "Potassium", loinc: "2823-3", ucum: "mmol/L" }, { code: "CL", name: "Chloride", loinc: "2075-0", ucum: "mmol/L" },
    { code: "HCO3", name: "Bicarbonate", loinc: "1963-8", ucum: "mmol/L" }, { code: "UREA", name: "Urea", ucum: "mmol/L" }, { code: "CREAT", name: "Creatinine", loinc: "2160-0", ucum: "umol/L" },
  ],
  "Electrolytes": [
    { code: "NA", name: "Sodium", loinc: "2951-2", ucum: "mmol/L" }, { code: "K", name: "Potassium", loinc: "2823-3", ucum: "mmol/L" }, { code: "CL", name: "Chloride", loinc: "2075-0", ucum: "mmol/L" }, { code: "HCO3", name: "Bicarbonate", loinc: "1963-8", ucum: "mmol/L" },
  ],
  "Sodium": [{ code: "NA", name: "Sodium", loinc: "2951-2", ucum: "mmol/L" }],
  "Potassium": [{ code: "K", name: "Potassium", loinc: "2823-3", ucum: "mmol/L" }],
  "Creatinine": [{ code: "CREAT", name: "Creatinine", loinc: "2160-0", ucum: "umol/L" }],
  "Liver Function Panel": [
    { code: "ALT", name: "ALT", loinc: "1742-6", ucum: "U/L" }, { code: "AST", name: "AST", loinc: "1920-8", ucum: "U/L" }, { code: "ALP", name: "ALP", loinc: "6768-6", ucum: "U/L" }, { code: "GGT", name: "GGT", loinc: "2324-2", ucum: "U/L" },
    { code: "TBIL", name: "Total bilirubin", loinc: "1975-2", ucum: "umol/L" }, { code: "DBIL", name: "Direct bilirubin", loinc: "1968-7", ucum: "umol/L" }, { code: "ALB", name: "Albumin", loinc: "1751-7", ucum: "g/L" }, { code: "TP", name: "Total protein", loinc: "2885-2", ucum: "g/L" },
  ],
  "ALT": [{ code: "ALT", name: "ALT", loinc: "1742-6", ucum: "U/L" }],
  "AST": [{ code: "AST", name: "AST", loinc: "1920-8", ucum: "U/L" }],
  "Lipid Profile": [
    { code: "TC", name: "Total cholesterol", loinc: "2093-3", ucum: "mmol/L" }, { code: "HDL", name: "HDL cholesterol", loinc: "2085-9", ucum: "mmol/L" }, { code: "LDL", name: "LDL cholesterol", ucum: "mmol/L" }, { code: "TG", name: "Triglycerides", loinc: "2571-8", ucum: "mmol/L" },
  ],
  "Fasting Blood Glucose": [{ code: "GLU", name: "Glucose (fasting)", loinc: "2345-7", ucum: "mmol/L" }],
  "Random Blood Glucose": [{ code: "GLU", name: "Glucose (random)", loinc: "2345-7", ucum: "mmol/L" }],
  "HbA1c": [{ code: "HBA1C", name: "HbA1c", loinc: "4548-4", ucum: "%" }],
};

/**
 * Starter order-set templates. These are configurable examples that a doctor
 * can copy into their own sets; they are NOT clinical recommendations. Members
 * are catalogue item names resolved at runtime.
 */
export const ORDER_SET_TEMPLATES: { name: string; domain: InvestigationDomain; members: string[] }[] = [
  { name: "Full Blood Count + Urea and Electrolytes", domain: "LABORATORY", members: ["Full Blood Count", "Electrolytes", "Urea", "Creatinine"] },
  { name: "Liver Function Panel", domain: "LABORATORY", members: ["Liver Function Panel"] },
  { name: "Renal Function Panel", domain: "LABORATORY", members: ["Renal Function Panel"] },
  { name: "Lipid Profile", domain: "LABORATORY", members: ["Lipid Profile"] },
  { name: "Diabetes Monitoring Panel", domain: "LABORATORY", members: ["HbA1c", "Fasting Blood Glucose", "Renal Function Panel", "Lipid Profile", "Urine Albumin-Creatinine Ratio"] },
  { name: "Antenatal Investigation Panel", domain: "LABORATORY", members: ["Full Blood Count", "ABO Blood Grouping", "Rh Typing", "HIV Screening", "Hepatitis B Surface Antigen", "Syphilis Serology", "Routine Urinalysis"] },
  { name: "Preoperative Investigation Panel", domain: "LABORATORY", members: ["Full Blood Count", "Renal Function Panel", "Coagulation Profile", "ABO Blood Grouping", "Rh Typing"] },
  { name: "Sepsis Investigation Panel", domain: "LABORATORY", members: ["Blood Culture", "Full Blood Count", "C-reactive Protein", "Lactate", "Renal Function Panel", "Liver Function Panel"] },
];
