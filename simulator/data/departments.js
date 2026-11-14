// All departments of the Medic1905 virtual hospital network.
const DEPARTMENTS = [
  ['emergency', 'Emergency & Trauma Department', 'emergency'],
  ['outpatient', 'Outpatient Department', 'outpatient'],
  ['inpatient', 'Inpatient Department', 'inpatient'],
  ['general-medicine-ward', 'General Medical Wards', 'inpatient'],
  ['surgical-ward', 'Surgical Wards', 'inpatient'],
  ['icu', 'Intensive Care Unit', 'critical-care'],
  ['hdu', 'High Dependency Unit', 'critical-care'],
  ['paediatrics', 'Paediatric Department', 'women-children'],
  ['nicu', 'Neonatal Intensive Care Unit', 'women-children'],
  ['maternity', 'Maternity & Obstetrics', 'women-children'],
  ['gynaecology', 'Gynaecology', 'women-children'],
  ['general-surgery', 'General Surgery', 'surgical'],
  ['orthopaedics', 'Orthopaedics', 'surgical'],
  ['neurosurgery', 'Neurosurgery', 'surgical'],
  ['cardiothoracic-surgery', 'Cardiothoracic Surgery', 'surgical'],
  ['urology', 'Urology', 'surgical'],
  ['plastic-surgery', 'Plastic Surgery', 'surgical'],
  ['ophthalmology', 'Ophthalmology', 'surgical'],
  ['ent', 'ENT (Ear, Nose & Throat)', 'surgical'],
  ['cardiology', 'Cardiology', 'medical'],
  ['neurology', 'Neurology', 'medical'],
  ['oncology', 'Oncology', 'medical'],
  ['nephrology', 'Nephrology', 'medical'],
  ['gastroenterology', 'Gastroenterology', 'medical'],
  ['respiratory-medicine', 'Respiratory Medicine', 'medical'],
  ['infectious-diseases', 'Infectious Diseases', 'medical'],
  ['psychiatry', 'Psychiatry', 'medical'],
  ['dermatology', 'Dermatology', 'medical'],
  ['anaesthesia', 'Anaesthesia', 'perioperative'],
  ['laboratory', 'Laboratory Services', 'diagnostics'],
  ['radiology', 'Radiology & Diagnostic Imaging', 'diagnostics'],
  ['pharmacy', 'Pharmacy', 'support'],
  ['nursing', 'Nursing Services', 'support'],
  ['physiotherapy', 'Physiotherapy & Rehabilitation', 'support'],
  ['blood-bank', 'Blood Bank & Transfusion Services', 'diagnostics'],
  ['administration', 'Hospital Administration', 'administration'],
  ['medical-records', 'Medical Records', 'administration'],
  ['billing', 'Billing & Insurance', 'administration'],
  ['mortuary', 'Mortuary & Death Documentation (Simulated)', 'administration']
];

// Which departments exist at which hospital tier (all tiers get administration, medical-records, billing, nursing, mortuary)
const TIER_DEPARTMENTS = {
  'rural-clinic': ['emergency', 'outpatient', 'nursing', 'physiotherapy'],
  'health-centre': ['emergency', 'outpatient', 'inpatient', 'general-medicine-ward', 'paediatrics', 'maternity', 'nursing', 'physiotherapy', 'laboratory', 'pharmacy', 'radiology'],
  'district-hospital': ['emergency', 'outpatient', 'inpatient', 'general-medicine-ward', 'surgical-ward', 'icu', 'paediatrics', 'maternity', 'gynaecology', 'general-surgery', 'orthopaedics', 'cardiology', 'anaesthesia', 'laboratory', 'radiology', 'pharmacy', 'nursing', 'physiotherapy', 'blood-bank'],
  'general-hospital': ['emergency', 'outpatient', 'inpatient', 'general-medicine-ward', 'surgical-ward', 'icu', 'hdu', 'paediatrics', 'maternity', 'gynaecology', 'general-surgery', 'orthopaedics', 'neurosurgery', 'cardiothoracic-surgery', 'urology', 'ent', 'cardiology', 'neurology', 'nephrology', 'gastroenterology', 'respiratory-medicine', 'infectious-diseases', 'psychiatry', 'dermatology', 'anaesthesia', 'laboratory', 'radiology', 'pharmacy', 'nursing', 'physiotherapy', 'blood-bank'],
  'teaching-hospital': '*', // all departments
  'specialist-centre': ['outpatient', 'icu', 'hdu', 'cardiology', 'neurology', 'oncology', 'nephrology', 'gastroenterology', 'respiratory-medicine', 'neurosurgery', 'cardiothoracic-surgery', 'plastic-surgery', 'ophthalmology', 'anaesthesia', 'laboratory', 'radiology', 'pharmacy', 'nursing', 'physiotherapy', 'blood-bank', 'inpatient', 'general-medicine-ward', 'surgical-ward']
};

const HOSPITAL_NAME_POOLS = {
  'teaching-hospital': ['University Hospital', 'Central Teaching Hospital', 'Academic Medical Centre', 'Royal Teaching Hospital'],
  'specialist-centre': ['National Specialist Centre', 'Institute of Advanced Medicine', 'Saint Raphael Specialist Hospital', 'Flagship Specialist Centre'],
  'general-hospital': ['General Hospital', 'Sacred Heart Hospital', 'Mercy General Hospital', 'Riverside Hospital', 'Providence Hospital', 'Saint Luke Hospital'],
  'district-hospital': ['District Hospital', 'Community Hospital', 'Saint Camillus Hospital', 'Regional Hospital', 'Hillcrest Hospital'],
  'health-centre': ['Health Centre', 'Community Health Centre', 'Family Health Centre', 'Primary Care Centre'],
  'rural-clinic': ['Rural Clinic', 'Village Clinic', 'Outpost Clinic', 'Community Clinic']
};

module.exports = { DEPARTMENTS, TIER_DEPARTMENTS, HOSPITAL_NAME_POOLS };
