# Patient History Module — Design Document

**Platform:** Medic1905 Telemedicine Platform
**Module:** Patient History
**Document Version:** 1.0.0
**Last Updated:** September 2026
**Status:** Implementation-Ready

---

## Table of Contents

1. [Patient Identification Data Model](#1-patient-identification-data-model)
2. [Medical History Structured Data Model](#2-medical-history-structured-data-model)
3. [AI-Driven Capabilities](#3-ai-driven-capabilities)
4. [Extensibility](#4-extensibility)
5. [Implementation Notes](#5-implementation-notes)

---

## 1. Patient Identification Data Model

### 1.1 Database Schema

The patient identification layer uses two normalized tables: `patient_profiles` for core demographic and biometric data, and `emergency_contacts` for fallback contact information. Both tables are managed through Prisma ORM and stored in Neon Postgres.

#### Table: `patient_profiles`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | No | — | FK to `users.id` (1:1 relationship) |
| `case_number` | `VARCHAR(20)` | No | — | Unique, auto-generated (see §1.3) |
| `first_name` | `VARCHAR(100)` | No | — | Patient given name |
| `last_name` | `VARCHAR(100)` | No | — | Patient family name |
| `middle_name` | `VARCHAR(100)` | Yes | `NULL` | Patient middle name / patronymic |
| `gender` | `ENUM('male','female','other')` | No | — | Biological gender for clinical reference |
| `date_of_birth` | `DATE` | No | — | ISO 8601 date |
| `height_cm` | `INTEGER` | Yes | `NULL` | Height in centimeters (30–300) |
| `weight_kg` | `DECIMAL(5,2)` | Yes | `NULL` | Weight in kilograms (1–500) |
| `bmi` | `DECIMAL(4,1)` | Yes | `NULL` | Auto-calculated on save |
| `bmi_category` | `ENUM('underweight','normal','overweight','obese')` | Yes | `NULL` | Auto-calculated on save |
| `occupation` | `VARCHAR(200)` | Yes | `NULL` | Free-text occupation |
| `address_line1` | `VARCHAR(255)` | Yes | `NULL` | Street address |
| `address_line2` | `VARCHAR(255)` | Yes | `NULL` | Apartment / suite |
| `city` | `VARCHAR(100)` | Yes | `NULL` | City |
| `region` | `VARCHAR(100)` | Yes | `NULL` | State / province / region |
| `postal_code` | `VARCHAR(20)` | Yes | `NULL` | Postal / ZIP code |
| `country` | `VARCHAR(2)` | Yes | `NULL` | ISO 3166-1 alpha-2 country code |
| `phone` | `VARCHAR(15)` | Yes | `NULL` | E.164 format |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification timestamp |

**Constraints:**
- `UNIQUE(user_id)` — one profile per user
- `UNIQUE(case_number)` — globally unique case number
- `CHECK(height_cm BETWEEN 30 AND 300)`
- `CHECK(weight_kg BETWEEN 1 AND 500)`

**Indexes:**
- `idx_patient_profiles_user_id` ON `user_id`
- `idx_patient_profiles_case_number` ON `case_number`
- `idx_patient_profiles_last_first_name` ON `last_name, first_name`

#### Table: `emergency_contacts`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary key |
| `patient_id` | `UUID` | No | — | FK to `patient_profiles.id` |
| `name` | `VARCHAR(200)` | No | — | Contact full name |
| `relationship` | `VARCHAR(100)` | No | — | Relationship to patient (e.g., "Spouse", "Parent") |
| `phone` | `VARCHAR(15)` | Yes | `NULL` | E.164 format |
| `address_line1` | `VARCHAR(255)` | Yes | `NULL` | Street address |
| `address_line2` | `VARCHAR(255)` | Yes | `NULL` | Apartment / suite |
| `city` | `VARCHAR(100)` | Yes | `NULL` | City |
| `region` | `VARCHAR(100)` | Yes | `NULL` | State / province / region |
| `postal_code` | `VARCHAR(20)` | Yes | `NULL` | Postal / ZIP code |
| `country` | `VARCHAR(2)` | Yes | `NULL` | ISO 3166-1 alpha-2 country code |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE`
- `CHECK(phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$')` — E.164 pattern

**Indexes:**
- `idx_emergency_contacts_patient_id` ON `patient_id`

---

### 1.2 BMI Calculation

BMI is auto-calculated whenever `height_cm` or `weight_kg` is set or updated, and the result is stored alongside its category in the `patient_profiles` table.

#### Formula

\[
\text{BMI} = \frac{\text{weight (kg)}}{\text{height (m)}^2}
\]

Height is stored in centimeters and converted to meters for the calculation: `height_m = height_cm / 100`.

#### Categories

| Category | BMI Range |
|---|---|
| Underweight | < 18.5 |
| Normal | 18.5 – 24.9 |
| Overweight | 25.0 – 29.9 |
| Obese | ≥ 30.0 |

#### TypeScript Implementation

```typescript
/**
 * Calculates BMI and its category from height (cm) and weight (kg).
 * Returns null if inputs are invalid or missing.
 */
export interface BmiResult {
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export function calculateBmi(heightCm: number | null, weightKg: number | null): BmiResult | null {
  if (heightCm == null || weightKg == null) return null;
  if (heightCm < 30 || heightCm > 300) return null;
  if (weightKg < 1 || weightKg > 500) return null;

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const roundedBmi = Math.round(bmi * 10) / 10;

  let category: BmiResult['category'];
  if (roundedBmi < 18.5) {
    category = 'underweight';
  } else if (roundedBmi < 25) {
    category = 'normal';
  } else if (roundedBmi < 30) {
    category = 'overweight';
  } else {
    category = 'obese';
  }

  return { bmi: roundedBmi, category };
}
```

#### Prisma Hook (auto-calculation on save)

```typescript
// In the patient profile service — Prisma middleware or service-level hook
async function upsertPatientProfile(data: PatientProfileInput): Promise<PatientProfile> {
  const bmiResult = calculateBmi(data.heightCm ?? null, data.weightKg ?? null);

  return prisma.patientProfile.upsert({
    where: { userId: data.userId },
    create: {
      ...data,
      bmi: bmiResult?.bmi ?? null,
      bmiCategory: bmiResult?.category ?? null,
      caseNumber: data.caseNumber ?? (await generateCaseNumber()),
    },
    update: {
      ...data,
      bmi: bmiResult?.bmi ?? null,
      bmiCategory: bmiResult?.category ?? null,
    },
  });
}
```

---

### 1.3 Validation Rules

All validation is enforced at both the application layer (Zod schemas in NestJS) and the database layer (CHECK constraints).

#### Field-Level Validation

| Field | Rule | Error Message |
|---|---|---|
| `firstName` | Required, string, 1–100 chars | "First name is required" |
| `lastName` | Required, string, 1–100 chars | "Last name is required" |
| `caseNumber` | Required, unique, format `MED-YYYY-NNNNNN` | "Case number must be unique and follow format MED-YYYY-NNNNNN" |
| `gender` | Required, enum `male \| female \| other` | "Gender is required" |
| `height_cm` | Optional, integer, 30–300 | "Height must be between 30 and 300 cm" |
| `weight_kg` | Optional, decimal, 1–500 | "Weight must be between 1 and 500 kg" |
| `date_of_birth` | Required, ISO 8601 date, not in future | "Date of birth must be a valid past date" |
| `phone` | Optional, E.164 format `^\+[1-9][0-9]{6,14}$` | "Phone must be in E.164 format (e.g., +79991234567)" |

#### Case Number Generation

Case numbers are auto-generated server-side and follow the format `MED-YYYY-NNNNNN`, where `YYYY` is the current year and `NNNNNN` is a zero-padded sequential number scoped to that year. Generation uses a database sequence or a transactional counter to ensure uniqueness.

```typescript
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MED-${year}-`;

  // Transactional sequence to prevent race conditions
  return prisma.$transaction(async (tx) => {
    const counter = await tx.caseNumberCounter.upsert({
      where: { year },
      create: { year, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });

    const sequence = String(counter.lastSequence).padStart(6, '0');
    return `${prefix}${sequence}`;
  });
}
```

#### Phone Validation (E.164)

```typescript
import { z } from 'zod';

const e164Regex = /^\+[1-9]\d{6,14}$/;

export const phoneSchema = z.string().regex(e164Regex, 'Phone must be in E.164 format (e.g., +79991234567)').optional().or(z.literal(''));
```

#### Full Zod Schema

```typescript
export const createPatientProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && date < new Date();
  }, 'Date of birth must be a valid past date'),
  heightCm: z.number().int().min(30).max(300).optional(),
  weightKg: z.number().min(1).max(500).optional(),
  occupation: z.string().max(200).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).optional(),
  phone: phoneSchema,
});
```

---

## 2. Medical History Structured Data Model

The medical history module captures a complete clinical episode as a set of structured, normalized records. Each episode (`medical_histories`) is the root aggregate, and all sub-sections are child records linked via `medical_history_id`.

### 2.1 Database Schema

#### Table: `medical_histories`

The episode record — the root of each patient history encounter.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `patient_id` | `UUID` | No | FK to `patient_profiles.id` |
| `episode_date` | `TIMESTAMPTZ` | No | When the episode occurred (defaults to now) |
| `chief_complaint` | `TEXT` | No | Primary reason for the visit (free text) |
| `ai_summary` | `JSONB` | Yes | AI-generated clinician summary (HPI format) |
| `ai_patient_recap` | `TEXT` | Yes | AI-generated plain-language patient recap |
| `ai_followup_questions` | `JSONB` | Yes | AI-suggested follow-up questions (array of strings) |
| `ai_risk_factors` | `JSONB` | Yes | AI-extracted risk factor highlights |
| `ai_symptom_clusters` | `JSONB` | Yes | AI-grouped symptom clusters by body system |
| `ai_timeline` | `JSONB` | Yes | AI-constructed chronological timeline |
| `clinician_review` | `TEXT` | Yes | Clinician's review notes |
| `clinician_id` | `UUID` | Yes | FK to `users.id` (reviewing clinician) |
| `reviewed_at` | `TIMESTAMPTZ` | Yes | Timestamp of clinician sign-off |
| `status` | `ENUM('draft','ai_processed','clinician_reviewed','signed_off')` | No | Episode workflow status |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY(clinician_id) REFERENCES users(id) ON DELETE SET NULL`

**Indexes:**
- `idx_medical_histories_patient_id` ON `patient_id`
- `idx_medical_histories_status` ON `status`

---

#### Table: `symptoms`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `description` | `TEXT` | No | Symptom description (free text) |
| `onset` | `TIMESTAMPTZ` | Yes | When symptom started |
| `worsening_time` | `TIMESTAMPTZ` | Yes | When symptom worsened |
| `relief_time` | `TIMESTAMPTZ` | Yes | When symptom was relieved |
| `character` | `VARCHAR(100)` | Yes | Symptom character (e.g., "sharp", "dull", "throbbing") |
| `severity` | `SMALLINT` | Yes | Severity 0–10 (0 = none, 10 = worst imaginable) |
| `duration` | `VARCHAR(100)` | Yes | Duration description (e.g., "3 days", "2 hours") |
| `notes` | `TEXT` | Yes | Additional notes |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE`
- `CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10))`

---

#### Table: `medication_records`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `name` | `VARCHAR(200)` | No | Medication name |
| `dose` | `VARCHAR(100)` | Yes | Dosage (e.g., "500mg") |
| `frequency` | `VARCHAR(100)` | Yes | Dosing frequency (e.g., "twice daily") |
| `duration` | `VARCHAR(100)` | Yes | Duration of use (e.g., "2 weeks") |
| `type` | `ENUM('CURRENT','RECENT')` | No | Whether medication is current or recently stopped |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `wound_injuries`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `has_injury` | `BOOLEAN` | No | Whether patient has an injury |
| `location` | `VARCHAR(200)` | Yes | Body location of injury |
| `type` | `VARCHAR(100)` | Yes | Injury type (e.g., "laceration", "fracture", "burn") |
| `time_since_injury` | `VARCHAR(100)` | Yes | How long ago the injury occurred |
| `cause` | `TEXT` | Yes | Mechanism / cause of injury |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE`

---

#### Table: `chronic_conditions`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `has_diabetes` | `BOOLEAN` | No | Whether patient has diabetes |
| `diabetes_type` | `ENUM('type1','type2','gestational')` | Yes | Diabetes type (if has_diabetes = true) |
| `diabetes_diagnosed_year` | `INTEGER` | Yes | Year of diabetes diagnosis |
| `has_stroke` | `BOOLEAN` | No | Whether patient has had a stroke |
| `stroke_year` | `INTEGER` | Yes | Year of stroke |
| `stroke_outcome` | `VARCHAR(200)` | Yes | Stroke outcome / residual effects |
| `has_heart_attack` | `BOOLEAN` | No | Whether patient has had a heart attack |
| `heart_attack_year` | `INTEGER` | Yes | Year of heart attack |
| `heart_attack_outcome` | `VARCHAR(200)` | Yes | Heart attack outcome / residual effects |
| `other_conditions` | `JSONB` | Yes | Additional chronic conditions (flexible array) |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `family_history_entries`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `condition` | `VARCHAR(200)` | No | Condition name (e.g., "Diabetes", "Hypertension") |
| `relationship` | `VARCHAR(100)` | No | Relationship to patient (e.g., "Mother", "Father") |
| `age_at_onset` | `INTEGER` | Yes | Age of relative at onset |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `past_history_entries`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `entry_type` | `ENUM('diagnosis','surgery','hospitalization')` | No | Type of past history entry |
| `description` | `TEXT` | No | Diagnosis / surgery / hospitalization description |
| `date` | `DATE` | Yes | When it occurred |
| `outcome` | `VARCHAR(200)` | Yes | Outcome / result |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `allergies`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `type` | `ENUM('drug','food','environmental','other')` | No | Allergy type |
| `allergen` | `VARCHAR(200)` | No | Allergen name |
| `reaction` | `VARCHAR(200)` | Yes | Reaction description |
| `severity` | `ENUM('mild','moderate','severe')` | Yes | Severity of reaction |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `lifestyle_factors`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `smoking_status` | `ENUM('never','former','current')` | Yes | Smoking status |
| `smoking_details` | `TEXT` | Yes | Packs per day, years, quit date |
| `alcohol_status` | `ENUM('none','occasional','moderate','heavy')` | Yes | Alcohol consumption level |
| `alcohol_details` | `TEXT` | Yes | Drinks per week, type |
| `physical_activity` | `VARCHAR(200)` | Yes | Activity level / description |
| `sleep_patterns` | `TEXT` | Yes | Sleep duration and quality |
| `travel_history` | `TEXT` | Yes | Recent travel to high-risk areas |
| `occupational_exposure` | `TEXT` | Yes | Chemical, noise, radiation exposure at work |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `reproductive_histories`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `pregnancies_count` | `INTEGER` | Yes | Number of pregnancies (gravida) |
| `deliveries_count` | `INTEGER` | Yes | Number of deliveries (para) |
| `complications` | `TEXT` | Yes | Pregnancy / delivery complications |
| `last_menstrual_period` | `DATE` | Yes | LMP date |
| `contraceptive_use` | `VARCHAR(200)` | Yes | Current contraceptive method |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories.id) ON DELETE CASCADE)`

---

#### Table: `mental_health_records`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `condition` | `VARCHAR(200)` | No | Mental health condition (e.g., "Depression", "Anxiety") |
| `duration` | `VARCHAR(100)` | Yes | How long the condition has been present |
| `treatment_status` | `ENUM('untreated','in_treatment','resolved')` | Yes | Current treatment status |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `immunization_records`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `vaccine` | `VARCHAR(200)` | No | Vaccine name (e.g., "Influenza", "COVID-19") |
| `date` | `DATE` | Yes | Date of immunization |
| `status` | `ENUM('completed','scheduled','declined')` | Yes | Immunization status |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

---

#### Table: `extensible_fields`

Flexible custom fields for telemedicine-specific or institution-specific data that doesn't fit into the standard schema.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `UUID` | No | Primary key |
| `medical_history_id` | `UUID` | No | FK to `medical_histories.id` |
| `field_name` | `VARCHAR(200)` | No | Custom field name / label |
| `field_value` | `JSONB` | No | Field value (supports any JSON type) |
| `field_type` | `ENUM('TEXT','NUMBER','DATE','SELECT','JSON')` | No | Value type |
| `category` | `VARCHAR(100)` | Yes | Grouping category (e.g., "social_determinants", "travel") |
| `created_at` | `TIMESTAMPTZ` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | Last modification timestamp |

**Constraints:**
- `FOREIGN KEY(medical_history_id) REFERENCES medical_histories(id) ON DELETE CASCADE)`

**Indexes:**
- `idx_extensible_fields_history_id` ON `medical_history_id`
- `idx_extensible_fields_category` ON `category`

---

### 2.2 Complete Medical History JSON Example

Below is an example of a fully populated medical history record as it would appear in the API response:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "patient_id": "f0e1d2c3-b4a5-6789-0abc-def123456789",
  "episode_date": "2026-09-18T14:30:00.000Z",
  "chief_complaint": "Chest pain and shortness of breath for the past 3 days",
  "status": "ai_processed",
  "created_at": "2026-09-18T14:30:00.000Z",
  "updated_at": "2026-09-18T14:45:00.000Z",
  "symptoms": [
    {
      "id": "sym-001",
      "description": "Crushing chest pain, radiating to left arm",
      "onset": "2026-09-15T08:00:00.000Z",
      "worsening_time": "2026-09-17T10:00:00.000Z",
      "relief_time": null,
      "character": "crushing",
      "severity": 8,
      "duration": "3 days, intermittent",
      "notes": "Worse with exertion, partially relieved by rest"
    },
    {
      "id": "sym-002",
      "description": "Shortness of breath on exertion",
      "onset": "2026-09-15T08:00:00.000Z",
      "worsening_time": null,
      "relief_time": null,
      "character": "exertional",
      "severity": 6,
      "duration": "3 days",
      "notes": "Climbing one flight of stairs causes significant dyspnea"
    }
  ],
  "medications": [
    {
      "id": "med-001",
      "name": "Aspirin",
      "dose": "100mg",
      "frequency": "once daily",
      "duration": "2 years",
      "type": "CURRENT"
    },
    {
      "id": "med-002",
      "name": "Metoprolol",
      "dose": "50mg",
      "frequency": "twice daily",
      "duration": "1 year",
      "type": "CURRENT"
    }
  ],
  "wound_injury": {
    "id": "wnd-001",
    "has_injury": false,
    "location": null,
    "type": null,
    "time_since_injury": null,
    "cause": null
  },
  "chronic_condition": {
    "id": "chr-001",
    "has_diabetes": true,
    "diabetes_type": "type2",
    "diabetes_diagnosed_year": 2019,
    "has_stroke": false,
    "stroke_year": null,
    "stroke_outcome": null,
    "has_heart_attack": true,
    "heart_attack_year": 2021,
    "heart_attack_outcome": "Stent placement, full recovery",
    "other_conditions": [
      { "name": "Hypertension", "diagnosed_year": 2018 },
      { "name": "Hyperlipidemia", "diagnosed_year": 2018 }
    ]
  },
  "family_history": [
    {
      "id": "fam-001",
      "condition": "Coronary Artery Disease",
      "relationship": "Father",
      "age_at_onset": 52
    },
    {
      "id": "fam-002",
      "condition": "Type 2 Diabetes",
      "relationship": "Mother",
      "age_at_onset": 60
    }
  ],
  "past_history": [
    {
      "id": "past-001",
      "entry_type": "surgery",
      "description": "Cardiac stent placement (LAD)",
      "date": "2021-03-15",
      "outcome": "Successful, no complications"
    }
  ],
  "allergies": [
    {
      "id": "alg-001",
      "type": "drug",
      "allergen": "Penicillin",
      "reaction": "Hives",
      "severity": "moderate"
    }
  ],
  "lifestyle": {
    "id": "life-001",
    "smoking_status": "former",
    "smoking_details": "20 cigarettes/day for 15 years, quit in 2018",
    "alcohol_status": "occasional",
    "alcohol_details": "1-2 drinks per week",
    "physical_activity": "Light walking 2-3 times per week",
    "sleep_patterns": "6-7 hours per night, reports poor quality",
    "travel_history": "No recent international travel",
    "occupational_exposure": "Office worker, no significant exposures"
  },
  "reproductive_history": null,
  "mental_health": [],
  "immunizations": [
    {
      "id": "imm-001",
      "vaccine": "Influenza",
      "date": "2025-10-15",
      "status": "completed"
    },
    {
      "id": "imm-002",
      "vaccine": "COVID-19 (booster)",
      "date": "2025-09-01",
      "status": "completed"
    }
  ],
  "extensible_fields": [
    {
      "id": "ext-001",
      "field_name": "Social Determinants: Housing",
      "field_value": "Stable housing",
      "field_type": "TEXT",
      "category": "social_determinants"
    },
    {
      "id": "ext-002",
      "field_name": "Social Determinants: Food Security",
      "field_value": "No concerns",
      "field_type": "TEXT",
      "category": "social_determinants"
    }
  ]
}
```

---

### 2.3 Form UX Flow

The clinician form follows a wizard-like progressive disclosure pattern within a single-page application. The workflow is designed to minimize clicks while ensuring structured data capture.

#### Step-by-Step Workflow

1. **Select / Create Patient**
   - Clinician searches for an existing patient by name, case number, or phone.
   - If not found, a new patient profile is created (see §1).
   - Patient selection loads the patient's dashboard with past history episodes.

2. **Start New History Episode**
   - Clinician clicks "New History" on the patient dashboard.
   - A new `medical_histories` record is created in `draft` status.
   - The form opens to the Chief Complaint step.

3. **Fill Chief Complaint**
   - Single required free-text field.
   - Typing triggers debounced AI question suggestions (see §3).
   - On blur or "Continue", the complaint is saved and the form advances.

4. **Add Symptoms**
   - Dynamic list using `useFieldArray` from React Hook Form.
   - Each symptom entry has: description, onset (datetime picker), worsening time, relief time, character (select), severity (0–10 slider), duration (text), notes.
   - Clinician can add unlimited symptoms via "Add Symptom" button and remove via trash icon.
   - Empty entries are filtered out on save.

5. **Fill Structured Sections**
   - Tabbed or accordion interface for: Medications, Wound/Injury, Chronic Conditions, Family History, Past History, Allergies, Lifestyle, Reproductive, Mental Health, Immunizations.
   - Each section uses dynamic arrays (`useFieldArray`) where multiple entries are expected.
   - Conditional fields appear based on parent toggles (e.g., `has_diabetes = true` reveals diabetes type and diagnosed year).

6. **Review AI Suggestions**
   - After saving structured data, the AI panel (right sidebar) populates with:
     - Suggested follow-up questions
     - Risk factor badges
     - Symptom cluster visualization
     - Timeline
   - Clinician reviews and can dismiss or accept suggestions.

7. **Generate Summary**
   - Clinician clicks "Generate Summary".
   - AI service produces a structured HPI summary (clinician-facing) and a patient recap (plain language).
   - Both are displayed for review; all AI fields are editable.

8. **Clinician Review & Sign-Off**
   - Clinician reviews the AI-generated summary, edits as needed.
   - Adds review notes in the `clinician_review` field.
   - Clicks "Sign Off" — status transitions to `signed_off`, `reviewed_at` is set, `clinician_id` is recorded.
   - Once signed off, the record is locked from further edits (audit trail preserved).

#### Multiple Symptoms and Conditions Handling

The form uses React Hook Form's `useFieldArray` for all repeatable sections. This pattern allows:

- **Dynamic add/remove** — Each entry is managed as an array item with a unique `id`. The "Add" button appends a new empty object; the remove button filters by index.
- **Validation per entry** — Zod schemas validate each array element independently; errors are displayed inline per field.
- **Nested arrays** — Some sections support nested repeatable fields (e.g., chronic conditions with `other_conditions` as a sub-array).
- **Conditional rendering** — Fields like `diabetes_type` only render when `has_diabetes` is `true`, using `watch()` from React Hook Form.

```typescript
// Example: Symptoms field array with React Hook Form
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const symptomSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  onset: z.string().optional(),
  worseningTime: z.string().optional(),
  reliefTime: z.string().optional(),
  character: z.string().optional(),
  severity: z.number().min(0).max(10).optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

const formSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  symptoms: z.array(symptomSchema),
});

function MedicalHistoryForm() {
  const { control, register, handleSubmit, watch } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { chiefComplaint: '', symptoms: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'symptoms' });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Chief Complaint */}
      <textarea {...register('chiefComplaint')} />

      {/* Symptoms */}
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`symptoms.${index}.description`)} />
          <input type="range" min={0} max={10} {...register(`symptoms.${index}.severity`)} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({})}>Add Symptom</button>

      <button type="submit">Save & Continue</button>
    </form>
  );
}
```

---

## 3. AI-Driven Capabilities

### 3.1 AI Pipeline

The AI pipeline processes structured medical history data through a multi-stage pipeline to produce clinician summaries, patient recaps, follow-up questions, risk factor highlights, and symptom clusters.

#### Inputs

| Input | Source | Format |
|---|---|---|
| Structured form data | Form submission (Prisma query) | JSON object (see §2.2) |
| Free text | Chief complaint, symptom descriptions, notes | Plain text strings |
| Patient context | `patient_profiles` table | Age, gender, BMI, occupation |

#### Processing Steps

```
┌─────────────────────────────────────────────────────────────┐
│                     AI PIPELINE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [1] Data Normalization & Validation                         │
│       ├── Parse JSON, coerce types                           │
│       ├── Validate required fields                           │
│       └── Sanitize free text (prompt injection prevention)   │
│                                                              │
│  [2] Symptom Clustering                                      │
│       ├── Group symptoms by body system:                    │
│       │   respiratory, cardiovascular, GI, neurological,     │
│       │   musculoskeletal, dermatological, constitutional    │
│       └── Map each symptom to one or more clusters           │
│                                                              │
│  [3] Timeline Construction                                   │
│       ├── Sort events chronologically                       │
│       ├── Onset → Progression → Current state               │
│       └── Include past history, medication changes          │
│                                                              │
│  [4] Risk Factor Extraction                                   │
│       ├── From chronic conditions (diabetes, CVD, etc.)      │
│       ├── From family history (genetic predisposition)       │
│       ├── From lifestyle factors (smoking, alcohol, etc.)    │
│       └── From occupational exposures                        │
│                                                              │
│  [5] Question Generation                                     │
│       ├── Based on chief complaint                           │
│       ├── Based on symptom clusters                          │
│       ├── Based on risk factors                              │
│       └── Adapted to patient age, gender, known conditions   │
│                                                              │
│  [6] Summary Generation (HPI format)                         │
│       ├── Chief Complaint                                   │
│       ├── HPI (History of Present Illness)                  │
│       ├── Past Medical History                               │
│       ├── Family History                                     │
│       ├── Social History                                     │
│       ├── Medications                                        │
│       └── Allergies                                          │
│                                                              │
│  [7] Patient Recap Generation                                │
│       └── Plain-language explanation of what was recorded    │
│                                                              │
│  [8] Safety Filtering                                        │
│       ├── Pre-LLM: input validation, injection prevention    │
│       └── Post-LLM: pattern matching for prohibited content  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Outputs

| Output | Target | Storage | Description |
|---|---|---|---|
| Clinician Summary | Clinician | `medical_histories.ai_summary` (JSONB) | Structured HPI with all standard sections |
| Patient Recap | Patient | `medical_histories.ai_patient_recap` (TEXT) | Plain-language explanation of recorded history |
| Follow-up Questions | Clinician | `medical_histories.ai_followup_questions` (JSONB) | Array of suggested questions |
| Risk Factor Highlights | Clinician | `medical_histories.ai_risk_factors` (JSONB) | Extracted risk factors with severity tags |
| Symptom Clusters | Clinician | `medical_histories.ai_symptom_clusters` (JSONB) | Grouped symptoms by body system |
| Timeline | Clinician | `medical_histories.ai_timeline` (JSONB) | Chronological event sequence |

---

### 3.2 Prompt Templates

All prompts use the Kimi K3 LLM via the existing Python FastAPI service. Prompts are stored as versioned templates in the AI service and rendered with Jinja2.

#### 3.2.1 Clinician Summary Prompt

**System Prompt:**

```
You are an AI clinical documentation assistant integrated into the Medic1905 telemedicine platform.
Your role is to generate a structured History of Present Illness (HPI) summary from the
patient's medical history data.

CRITICAL SAFETY CONSTRAINTS:
- You MUST NOT provide a diagnosis or differential diagnosis.
- You MUST NOT prescribe medications or recommend dosages.
- You MUST NOT provide emergency instructions or triage advice.
- You MUST NOT interpret laboratory results or imaging findings.
- You MUST state "Information incomplete" when critical data is missing rather than
  inferring or fabricating.
- All output must be factual, based solely on the provided data.
- All output is ASSISTIVE ONLY and requires clinician review and approval.

Your output must follow the standard HPI structure with these sections:
1. Chief Complaint
2. HPI (History of Present Illness)
3. Past Medical History
4. Family History
5. Social History
6. Medications
7. Allergies

Format each section as a JSON object with a "section" key and a "content" key.
The content should be concise clinical prose, not a list of raw data fields.
```

**Task Prompt:**

```
Generate a structured HPI summary from the following patient medical history data.

PATIENT CONTEXT:
- Age: {{ age }}
- Gender: {{ gender }}
- BMI: {{ bmi }} ({{ bmi_category }})
- Occupation: {{ occupation }}

MEDICAL HISTORY DATA:
{{ medical_history_json }}

INSTRUCTIONS:
1. Write the Chief Complaint exactly as recorded.
2. For the HPI, synthesize the symptoms into a coherent narrative including onset,
   progression, character, severity, and associated factors. Do not list symptoms
   as bullet points — write flowing clinical prose.
3. For Past Medical History, include chronic conditions, past surgeries, hospitalizations,
   and relevant immunizations. Note any missing information.
4. For Family History, list each family member's condition and age at onset if available.
5. For Social History, summarize smoking, alcohol, physical activity, sleep, travel,
   and occupational exposures.
6. For Medications, list all current and recent medications with dose, frequency, and duration.
7. For Allergies, list each allergen, reaction type, and severity.

Return a JSON object with the following structure:
{
  "chief_complaint": "...",
  "hpi": "...",
  "past_medical_history": "...",
  "family_history": "...",
  "social_history": "...",
  "medications": "...",
  "allergies": "...",
  "incomplete_sections": ["list of sections with missing critical data"]
}

REMEMBER: Do not diagnose, prescribe, or provide emergency instructions.
All output is assistive only and requires clinician review.
```

---

#### 3.2.2 Patient Recap Prompt

**System Prompt:**

```
You are an AI assistant integrated into the Medic1905 telemedicine platform.
Your role is to generate a plain-language explanation of what medical history information
was recorded during the patient's consultation, so the patient can review and confirm accuracy.

CRITICAL SAFETY CONSTRAINTS:
- You MUST NOT provide a diagnosis or suggest possible conditions.
- You MUST NOT prescribe medications or recommend treatments.
- You MUST NOT provide emergency instructions or tell the patient to seek urgent care.
- You MUST NOT use alarming or anxiety-inducing language.
- You MUST use simple, non-technical language that a layperson can understand.
- You MUST state "Some information was not recorded" when sections are incomplete
  rather than guessing or inferring.
- All output is ASSISTIVE ONLY and does not constitute medical advice.

Your output should be a friendly, clear summary that helps the patient understand
what was discussed and recorded. Use second person ("you") to address the patient.
```

**Task Prompt:**

```
Generate a plain-language patient recap from the following medical history data.

PATIENT CONTEXT:
- Name: {{ first_name }} {{ last_name }}
- Age: {{ age }}
- Gender: {{ gender }}

MEDICAL HISTORY DATA:
{{ medical_history_json }}

INSTRUCTIONS:
Write a clear, friendly summary that explains what was recorded during the consultation.
Address the patient directly using "you".

Structure the recap as follows:
1. Opening: "Here is a summary of what was recorded during your consultation on {{ date }}."
2. Chief Complaint: Explain in simple terms what the patient reported as their main concern.
3. Symptoms: Describe the symptoms that were recorded, in plain language.
4. Medical History: Briefly mention any chronic conditions, past surgeries, or relevant history.
5. Medications: List the medications that were recorded.
6. Allergies: Mention any recorded allergies.
7. Closing: "Please review this summary and let your clinician know if anything is
   incorrect or missing. This summary is for your records and is not a medical diagnosis."

IMPORTANT:
- Do not diagnose, suggest conditions, or recommend treatments.
- Do not use medical jargon without explaining it.
- Do not provide emergency or urgent care instructions.
- Keep the language warm and reassuring.
- If information is missing, say "Some information about [section] was not recorded."

Return the recap as plain text (not JSON).
```

---

#### 3.2.3 Question Generation Prompt

**System Prompt:**

```
You are an AI clinical decision support assistant integrated into the Medic1905
telemedicine platform. Your role is to generate suggested follow-up questions that
a clinician might ask the patient to clarify or expand on the recorded history.

CRITICAL SAFETY CONSTRAINTS:
- You MUST NOT provide a diagnosis through your questions.
- You MUST NOT frame questions that imply a specific diagnosis.
- You MUST NOT recommend treatments or medications through your questions.
- Questions should be open-ended and clinical in nature.
- Questions should be adapted to the patient's age, gender, and known conditions.
- All output is ASSISTIVE ONLY and requires clinician review.

Generate 5-10 relevant follow-up questions based on the chief complaint, symptoms,
and risk factors. Prioritize questions that would help clarify the clinical picture.
```

**Task Prompt:**

```
Generate suggested follow-up questions for the clinician based on the following
patient medical history data.

PATIENT CONTEXT:
- Age: {{ age }}
- Gender: {{ gender }}
- Known chronic conditions: {{ chronic_conditions_summary }}

CHIEF COMPLAINT:
{{ chief_complaint }}

SYMPTOMS:
{{ symptoms_summary }}

RISK FACTORS:
{{ risk_factors_summary }}

INSTRUCTIONS:
1. Generate 5-10 follow-up questions that a clinician would find useful.
2. Prioritize questions about:
   - Symptom characteristics not yet captured (e.g., associated symptoms, triggers)
   - Red flag symptoms relevant to the chief complaint
   - Medication adherence and side effects
   - Functional impact of symptoms on daily life
3. Adapt questions to the patient's age, gender, and known conditions.
4. Do NOT ask questions that imply a diagnosis (e.g., "Do you think you have a heart attack?").
5. Use clinical but clear language.

Return a JSON array of strings, each being a question:
["Question 1", "Question 2", ...]

REMEMBER: All output is assistive only and requires clinician review.
```

---

### 3.3 Safety Constraints

#### Prohibited AI Actions

The AI system must adhere to the following prohibitions at all times:

| Prohibited Action | Example | Mitigation |
|---|---|---|
| Providing a diagnosis | "The patient likely has acute coronary syndrome." | Post-LLM pattern matching for diagnostic language |
| Prescribing medications or dosages | "Start the patient on 5mg amlodipine." | Post-LLM pattern matching for prescription language |
| Providing emergency instructions | "Call an ambulance immediately." | Post-LLM pattern matching for emergency triggers |
| Interpreting lab/imaging results | "The elevated troponin indicates..." | Input filtering — lab results are not sent to AI |
| Fabricating missing information | Inventing onset times or severity values | "Information incomplete" placeholder in prompts |

#### Required AI Behaviors

| Required Behavior | Implementation |
|---|---|
| Encourage consultation with qualified clinician | Included in patient recap footer and AI panel header |
| State limitations when information is incomplete | Prompt instructions + "incomplete_sections" field in output |
| Mark all outputs as assistive-only | UI banner on every AI panel |
| Maintain audit trail | All AI operations logged with input hash, output, model version, timestamp |

#### Pre-LLM Safety Layer

1. **Input validation** — All inputs are validated against Zod schemas before reaching the AI service. Invalid or malformed data is rejected.
2. **Prompt injection prevention** — Free-text fields (chief complaint, symptom descriptions, notes) are sanitized:
   - Strip control characters and null bytes
   - Remove HTML/script tags
   - Enforce max length (10,000 characters per field)
   - Detect and neutralize common injection patterns (e.g., "ignore previous instructions")

```python
# Pre-LLM sanitization (Python FastAPI service)
import re

MAX_FIELD_LENGTH = 10_000

def sanitize_text_input(text: str) -> str:
    """Sanitize free-text input before sending to LLM."""
    if not text:
        return ""
    # Truncate
    text = text[:MAX_FIELD_LENGTH]
    # Remove control characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Neutralize common injection patterns
    injection_patterns = [
        r'(?i)ignore\s+(?:previous|all|above)\s+instructions',
        r'(?i)disregard\s+(?:previous|all|above)',
        r'(?i)you\s+are\s+now\s+(?:a|an)\s+\w+',
        r'(?i)forget\s+(?:everything|all|previous)',
    ]
    for pattern in injection_patterns:
        text = re.sub(pattern, '[REDACTED]', text)
    return text.strip()
```

#### Post-LLM Safety Layer

After the LLM generates output, a post-processing step scans for prohibited content patterns and rewrites or blocks the output.

```python
# Post-LLM safety filter (Python FastAPI service)
import re

# Patterns that indicate prohibited content
DIAGNOSIS_PATTERNS = [
    r'(?i)\b(?:diagnos|suggests?\s+(?:a|the)\s+diagnosis|likely\s+(?:has|is)\s+\w+)',
    r'(?i)\b(?:consistent\s+with|ruling\s+(?:in|out)|differential\s+diagnosis)',
]

PRESCRIPTION_PATTERNS = [
    r'(?i)\b(?:prescribe|recommend\s+\d+\s*mg|start\s+(?:on|the\s+patient\s+on))',
    r'(?i)\b(?:dosage\s+of|dose\s+should\s+be)\s+\d+',
]

EMERGENCY_PATTERNS = [
    r'(?i)\b(?:call\s+(?:911|an\s+ambulance|emergency)|go\s+to\s+(?:the\s+)?(?:ER|emergency))',
    r'(?i)\b(?:seek\s+(?:immediate|urgent)\s+(?:medical|emergency)\s+(?:attention|care))',
]

SAFE_FALLBACK = (
    "AI output was filtered due to safety constraints. "
    "Please review the patient data manually. "
    "[Assistive only — requires clinician review.]"
)

def post_llm_filter(output: str) -> str:
    """Scan LLM output for prohibited content and rewrite if found."""
    for patterns in [DIAGNOSIS_PATTERNS, PRESCRIPTION_PATTERNS, EMERGENCY_PATTERNS]:
        for pattern in patterns:
            if re.search(pattern, output):
                # Log the violation for audit
                log_safety_violation(pattern, output)
                return SAFE_FALLBACK
    return output
```

#### Audit Trail

Every AI operation is logged with the following fields:

| Field | Description |
|---|---|
| `id` | UUID for the audit record |
| `medical_history_id` | FK to the episode |
| `operation_type` | `summary_generation`, `patient_recap`, `question_generation`, `symptom_clustering`, `risk_extraction` |
| `input_hash` | SHA-256 hash of the input JSON (for deduplication and traceability) |
| `model_version` | LLM model identifier (e.g., `kimi-k3-v1`) |
| `prompt_template_version` | Version of the prompt template used |
| `output` | Full LLM output (stored for audit) |
| `filtered` | Boolean — whether post-LLM safety filter was triggered |
| `filter_reason` | If filtered, which pattern was matched |
| `clinician_edited` | Boolean — whether clinician modified the AI output |
| `created_at` | Timestamp of the operation |

```sql
CREATE TABLE ai_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    prompt_template_version VARCHAR(20) NOT NULL,
    output JSONB NOT NULL,
    filtered BOOLEAN NOT NULL DEFAULT FALSE,
    filter_reason TEXT,
    clinician_edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_audit_medical_history_id ON ai_audit_trail(medical_history_id);
CREATE INDEX idx_ai_audit_operation_type ON ai_audit_trail(operation_type);
```

---

### 3.4 AI UX Integration

The AI capabilities are integrated into the form UI through a persistent sidebar panel and contextual triggers.

#### UI Components

| Component | Location | Trigger | Behavior |
|---|---|---|---|
| AI Suggestions Panel | Right sidebar (always visible on history page) | Auto-populates after form save | Shows risk factor badges, symptom clusters, timeline |
| Generate Summary Button | Top action bar of the form | Manual click | Triggers summary + recap generation pipeline |
| Suggested Questions Sidebar | Right sidebar, below AI Suggestions | Auto-populates after chief complaint + symptoms saved | List of follow-up questions with "copy" and "dismiss" actions |
| Risk Factor Badges | Inline within AI Suggestions Panel | Auto-extracted | Color-coded: red (high), amber (moderate), blue (informational) |
| Symptom Clusters Visualization | Inline within AI Suggestions Panel | Auto-generated | Grouped cards by body system with symptom chips |
| Patient Recap Modal | Modal overlay | "View Patient Recap" button in summary section | Displays plain-language recap with copy-to-clipboard button |
| AI Output Edit Indicator | Inline next to each AI field | When clinician edits | Shows "Edited by clinician" tag |

#### Layout Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  [New History]  [Save Draft]  [Generate Summary]  [Sign Off]      │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │  AI SUGGESTIONS                │
│  FORM AREA (Left, ~65% width)    │  (Right Sidebar, ~35% width)   │
│                                  │                               │
│  ┌──────────────────────────┐    │  ┌─────────────────────────┐  │
│  │ Chief Complaint          │    │  │ Risk Factors             │  │
│  │ [textarea]               │    │  │ [🔴 High] [🟡 Moderate]  │  │
│  └──────────────────────────┘    │  └─────────────────────────┘  │
│                                  │                               │
│  ┌──────────────────────────┐    │  ┌─────────────────────────┐  │
│  │ Symptoms                 │    │  │ Symptom Clusters         │  │
│  │ [+ Add Symptom]          │    │  │ Cardiovascular: 2       │  │
│  │ ┌────────────────────┐   │    │  │ Respiratory: 1          │  │
│  │ │ Symptom 1          │   │    │  └─────────────────────────┘  │
│  │ └────────────────────┘   │    │                               │
│  │ ┌────────────────────┐   │    │  ┌─────────────────────────┐  │
│  │ │ Symptom 2          │   │    │  │ Timeline                 │  │
│  │ └────────────────────┘   │    │  │ Sep 15: Onset           │  │
│  └──────────────────────────┘    │  │ Sep 17: Worsening      │  │
│                                  │  └─────────────────────────┘  │
│  ┌──────────────────────────┐    │                               │
│  │ Medications             │    │  ┌─────────────────────────┐  │
│  │ ...                     │    │  │ Suggested Questions      │  │
│  └──────────────────────────┘    │  │ 1. "..." [copy] [×]      │  │
│                                  │  │ 2. "..." [copy] [×]      │  │
│  ┌──────────────────────────┐    │  └─────────────────────────┘  │
│  │ AI Summary (editable)    │    │                               │
│  │ [View Patient Recap]     │    │  ⚠ AI output is assistive    │
│  └──────────────────────────┘    │     only — requires clinician │
│                                  │     review.                    │
└──────────────────────────────────┴───────────────────────────────┘
```

#### Key UX Principles

- **All AI outputs are editable** — Every AI-generated field in the summary section is rendered in an editable text area. Edits set `clinician_edited = true` in the audit trail.
- **AI panel is non-blocking** — The form is fully functional without the AI panel. The sidebar can be collapsed.
- **Progressive AI activation** — AI suggestions appear progressively as the form is filled, not all at once. Questions appear after chief complaint; clusters appear after symptoms; risk factors appear after structured sections.
- **Copy-to-clipboard** — The patient recap modal includes a one-click copy button so the clinician can paste it into a chat message or email to the patient.
- **Visual distinction** — All AI-generated content has a subtle blue background tint and a small "AI" badge. Clinician-edited content shows an "Edited" tag in green.

---

## 4. Extensibility

### 4.1 Additional Fields for Telemedicine

The telemedicine context requires fields beyond standard medical history. These are captured through both dedicated schema columns and the `extensible_fields` table.

#### Telemedicine-Specific Fields

| Field | Category | Type | Description |
|---|---|---|---|
| Travel history | `travel` | TEXT | Recent travel to high-risk areas (disease, environmental) |
| Occupational exposures | `occupational` | TEXT | Chemicals, noise, radiation, biological hazards at work |
| Pain scales per symptom | `symptom_detail` | NUMBER (0–10) | Numeric pain scale captured per symptom (already in `symptoms.severity`) |
| Sleep patterns | `lifestyle` | TEXT | Sleep duration, quality, disturbances (already in `lifestyle_factors.sleep_patterns`) |
| Housing stability | `social_determinants` | TEXT/SELECT | Stable, unstable, homeless |
| Food security | `social_determinants` | TEXT/SELECT | No concerns, at-risk, food insecure |
| Transportation access | `social_determinants` | TEXT/SELECT | Has vehicle, public transport, no transport |
| Financial stress | `social_determinants` | TEXT/SELECT | None, mild, moderate, severe |
| Social isolation | `social_determinants` | TEXT/SELECT | Lives alone, has support network, isolated |
| Health literacy | `social_determinants` | TEXT | Patient's ability to understand health information |

#### Social Determinants of Health (SDOH)

SDOH fields are stored in `extensible_fields` under the `social_determinants` category, allowing institutions to customize which SDOH factors they capture without schema changes:

```json
[
  {
    "field_name": "Housing Stability",
    "field_value": "Stable housing",
    "field_type": "SELECT",
    "category": "social_determinants"
  },
  {
    "field_name": "Food Security",
    "field_value": "No concerns",
    "field_type": "SELECT",
    "category": "social_determinants"
  },
  {
    "field_name": "Transportation Access",
    "field_value": "Has vehicle",
    "field_type": "SELECT",
    "category": "social_determinants"
  }
]
```

---

### 4.2 Flexible Schema Design

The `extensible_fields` table provides a JSONB-based flexible schema that supports custom fields without database migrations.

#### Architecture

```
┌─────────────────────────────────────────────────┐
│           extensible_fields table                │
├─────────────────────────────────────────────────┤
│                                                  │
│  field_name  │ field_value │ field_type │ category│
│  ────────────┼────────────┼────────────┼────────│
│  "Custom Q1" │ "Answer"   │ TEXT       │ custom  │
│  "Vital: BP" │ "120/80"   │ TEXT       │ vitals  │
│  "SDOH: Food"│ "At-risk"  │ SELECT     │ social  │
│  "Lab: HbA1c"│ 6.5        │ NUMBER     │ labs    │
│  "Mood Score"│ {"phq9": 8}│ JSON       │ mental  │
│  "Last Visit"│ "2026-09"  │ DATE       │ history │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Supported Field Types

| Type | Storage | Use Case | Example Value |
|---|---|---|---|
| `TEXT` | JSONB string | Free-text answers | `"Patient reports chest tightness"` |
| `NUMBER` | JSONB number | Numeric values | `6.5` |
| `DATE` | JSONB string (ISO 8601) | Dates | `"2026-09-18"` |
| `SELECT` | JSONB string | Predefined options | `"At-risk"` |
| `JSON` | JSONB object/array | Complex structures | `{"phq9_score": 8, "gad7_score": 5}` |

#### Custom Questionnaire Builder Pattern

Institutions can define custom questionnaires that render as form sections. A questionnaire definition is stored as metadata that the frontend reads to dynamically render fields:

```typescript
// Questionnaire definition (stored in a config table or JSON file)
interface QuestionnaireField {
  fieldName: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'JSON';
  category: string;
  required: boolean;
  options?: string[]; // For SELECT type
  placeholder?: string;
  helpText?: string;
}

interface Questionnaire {
  id: string;
  name: string;
  description: string;
  fields: QuestionnaireField[];
}

// Example: Social Determinants questionnaire
const sdohQuestionnaire: Questionnaire = {
  id: 'sdoh-standard',
  name: 'Social Determinants of Health',
  description: 'Standard SDOH screening questions',
  fields: [
    {
      fieldName: 'Housing Stability',
      label: 'What is your current housing situation?',
      fieldType: 'SELECT',
      category: 'social_determinants',
      required: true,
      options: ['Stable housing', 'Unstable housing', 'Temporary housing', 'Homeless'],
    },
    {
      fieldName: 'Food Security',
      label: 'In the past month, have you worried about having enough food?',
      fieldType: 'SELECT',
      category: 'social_determinants',
      required: false,
      options: ['No concerns', 'At-risk', 'Food insecure'],
    },
    {
      fieldName: 'Transportation Access',
      label: 'Do you have reliable transportation to medical appointments?',
      fieldType: 'SELECT',
      category: 'social_determinants',
      required: false,
      options: ['Has vehicle', 'Public transport', 'No transport'],
    },
  ],
};
```

#### Dynamic Form Rendering

```typescript
function ExtensibleFieldsSection({ questionnaire }: { questionnaire: Questionnaire }) {
  const { control } = useFormContext();

  return (
    <div className="space-y-4">
      <h3>{questionnaire.name}</h3>
      <p className="text-sm text-muted-foreground">{questionnaire.description}</p>

      {questionnaire.fields.map((field) => (
        <FormField
          key={field.fieldName}
          control={control}
          name={`extensibleFields.${field.fieldName}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>{field.label}</FormLabel>
              {field.fieldType === 'SELECT' && field.options ? (
                <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder ?? 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.fieldType === 'NUMBER' ? (
                <Input type="number" {...formField} />
              ) : (
                <Input {...formField} />
              )}
              {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
```

---

### 4.3 AI Adaptation to New Fields

The AI pipeline is designed to dynamically incorporate extensible fields without prompt template changes.

#### Dynamic Prompt Construction

When the AI service receives a medical history payload, it dynamically constructs the prompt by scanning for extensible fields and including them in the appropriate section:

```python
def build_ai_prompt(medical_history: dict, prompt_type: str) -> str:
    """Dynamically construct AI prompt including extensible fields."""

    # Standard sections (always included)
    standard_sections = [
        'chief_complaint', 'symptoms', 'medications', 'wound_injury',
        'chronic_condition', 'family_history', 'past_history', 'allergies',
        'lifestyle', 'reproductive_history', 'mental_health', 'immunizations'
    ]

    # Build standard context
    context = {key: medical_history.get(key) for key in standard_sections}

    # Dynamically include extensible fields
    extensible = medical_history.get('extensible_fields', [])
    ext_by_category: dict[str, list] = {}
    for field in extensible:
        category = field.get('category', 'other')
        ext_by_category.setdefault(category, []).append({
            'name': field['field_name'],
            'value': field['field_value'],
            'type': field['field_type'],
        })

    # Merge extensible fields into context
    for category, fields in ext_by_category.items():
        context[f'extensible_{category}'] = fields

    # Render prompt with Jinja2 — template references extensible_* keys
    template = get_prompt_template(prompt_type)
    return template.render(**context, extensible_categories=list(ext_by_category.keys()))
```

#### Symptom Clustering Adaptation

New symptom-like fields added via `extensible_fields` (e.g., a custom "secondary symptoms" questionnaire) are automatically included in the symptom clustering step. The clustering algorithm scans the `extensible_fields` table for any field with `category = 'symptom_detail'` and includes those values alongside the standard `symptoms` array.

#### Risk Factor Extraction Adaptation

When new lifestyle or exposure fields are added via `extensible_fields`, the risk factor extraction step automatically picks them up:

```python
def extract_risk_factors(medical_history: dict) -> list[dict]:
    """Extract risk factors from standard and extensible fields."""
    risk_factors = []

    # Standard risk factors
    chronic = medical_history.get('chronic_condition', {})
    if chronic.get('has_diabetes'):
        risk_factors.append({'factor': 'Diabetes', 'severity': 'high', 'source': 'chronic_condition'})
    if chronic.get('has_heart_attack'):
        risk_factors.append({'factor': 'History of MI', 'severity': 'high', 'source': 'chronic_condition'})

    lifestyle = medical_history.get('lifestyle', {})
    if lifestyle.get('smoking_status') == 'current':
        risk_factors.append({'factor': 'Current smoker', 'severity': 'high', 'source': 'lifestyle'})

    # Dynamic risk factors from extensible fields
    for field in medical_history.get('extensible_fields', []):
        if field.get('category') in ('occupational', 'social_determinants'):
            value = str(field['field_value']).lower()
            if any(keyword in value for keyword in ['exposure', 'chemical', 'radiation', 'noise']):
                risk_factors.append({
                    'factor': field['field_name'],
                    'severity': 'moderate',
                    'source': f'extensible:{field["category"]}',
                })

    return risk_factors
```

#### Summary Template Dynamic Sections

The clinician summary prompt template includes a dynamic section that renders extensible fields as additional HPI sections:

```
{% if extensible_categories %}
ADDITIONAL SECTIONS FROM CUSTOM FIELDS:
{% for category in extensible_categories %}
- {{ category | replace('_', ' ') | title }}:
{% for field in context['extensible_' + category] %}
  - {{ field.name }}: {{ field.value }}
{% endfor %}
{% endfor %}
{% endif %}
```

---

## 5. Implementation Notes

### 5.1 Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | Next.js 14 (App Router) | 14.x | TypeScript, Tailwind CSS, shadcn/ui |
| Frontend State | React Hook Form + Zod | — | Form management and validation |
| Backend | NestJS | 10.x | REST API, modular architecture |
| ORM | Prisma | 5.x | Schema-first, type-safe queries |
| Database | Neon Postgres | — | Serverless Postgres with connection pooling |
| AI Service | Python FastAPI | — | Existing service, extended with new endpoints |
| LLM | Kimi K3 | — | Via existing AI service integration |
| Deployment (Frontend) | Vercel | — | Next.js optimized hosting |
| Deployment (Database) | Neon | — | Serverless Postgres |
| Deployment (AI Service) | Existing infrastructure | — | Python FastAPI on existing servers |

### 5.2 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                       │
│                                                               │
│  Next.js 14 App (Vercel)                                      │
│  ├── Patient History Form (React Hook Form + Zod)            │
│  ├── AI Suggestions Panel (shadcn/ui)                        │
│  └── Patient Recap Modal                                     │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               │ REST API (HTTPS)             │ AI Service API (HTTPS)
               ▼                               ▼
┌──────────────────────────┐     ┌─────────────────────────────┐
│    NestJS Backend        │     │    Python FastAPI Service   │
│                          │     │                             │
│  ├── Patient Profile     │     │  ├── Summary Generation     │
│  │   Controller          │     │  ├── Patient Recap          │
│  ├── Medical History     │     │  ├── Question Generation    │
│  │   Controller          │     │  ├── Symptom Clustering     │
│  ├── AI Endpoint         │     │  ├── Risk Extraction        │
│  │   (proxy to AI svc)   │     │  ├── Safety Filtering       │
│  └── Audit Controller    │     │  └── Audit Logging          │
│                          │     │                             │
│  Prisma ORM              │     │  Kimi K3 LLM                │
└──────────┬───────────────┘     └──────────┬──────────────────┘
           │                                │
           │                                │ Audit Log (via NestJS)
           ▼                                ▼
┌──────────────────────────┐     ┌─────────────────────────────┐
│   Neon Postgres          │     │   Neon Postgres (shared)    │
│                          │     │                             │
│  patient_profiles        │     │  ai_audit_trail             │
│  emergency_contacts      │     │                             │
│  medical_histories       │     │                             │
│  symptoms                │     │                             │
│  medication_records      │     │                             │
│  wound_injuries          │     │                             │
│  chronic_conditions      │     │                             │
│  family_history_entries  │     │                             │
│  past_history_entries    │     │                             │
│  allergies               │     │                             │
│  lifestyle_factors       │     │                             │
│  reproductive_histories  │     │                             │
│  mental_health_records   │     │                             │
│  immunization_records    │     │                             │
│  extensible_fields       │     │                             │
└──────────────────────────┘     └─────────────────────────────┘
```

### 5.3 API Endpoints

All endpoints are prefixed with `/api/v1`. Authentication is via JWT Bearer token (handled by existing auth middleware).

#### Patient Profile Endpoints

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/patients` | Create a new patient profile | `CreatePatientProfileDto` | `PatientProfileResponse` (201) |
| `GET` | `/patients` | List patients (paginated, searchable) | Query: `?page=1&limit=20&search=...` | `PaginatedResponse<PatientProfileResponse>` |
| `GET` | `/patients/:id` | Get patient profile by ID | — | `PatientProfileResponse` |
| `GET` | `/patients/by-case/:caseNumber` | Get patient by case number | — | `PatientProfileResponse` |
| `PUT` | `/patients/:id` | Update patient profile | `UpdatePatientProfileDto` | `PatientProfileResponse` |
| `DELETE` | `/patients/:id` | Soft-delete patient profile | — | `204 No Content` |
| `GET` | `/patients/:id/emergency-contacts` | List emergency contacts for patient | — | `EmergencyContactResponse[]` |
| `POST` | `/patients/:id/emergency-contacts` | Add emergency contact | `CreateEmergencyContactDto` | `EmergencyContactResponse` (201) |
| `PUT` | `/patients/:id/emergency-contacts/:contactId` | Update emergency contact | `UpdateEmergencyContactDto` | `EmergencyContactResponse` |
| `DELETE` | `/patients/:id/emergency-contacts/:contactId` | Delete emergency contact | — | `204 No Content` |

#### Medical History Endpoints

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/patients/:patientId/histories` | Create a new medical history episode | `CreateMedicalHistoryDto` | `MedicalHistoryResponse` (201) |
| `GET` | `/patients/:patientId/histories` | List all history episodes for a patient | Query: `?page=1&limit=10&status=...` | `PaginatedResponse<MedicalHistorySummary>` |
| `GET` | `/histories/:historyId` | Get full medical history by ID (includes all sub-records) | — | `FullMedicalHistoryResponse` |
| `PUT` | `/histories/:historyId` | Update medical history (chief complaint, status, clinician review) | `UpdateMedicalHistoryDto` | `MedicalHistoryResponse` |
| `DELETE` | `/histories/:historyId` | Delete a medical history episode (cascade) | — | `204 No Content` |
| `PATCH` | `/histories/:historyId/status` | Update episode status (e.g., sign off) | `{ status: 'signed_off' }` | `MedicalHistoryResponse` |

#### Symptom Endpoints

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/histories/:historyId/symptoms` | Add a symptom | `CreateSymptomDto` | `SymptomResponse` (201) |
| `GET` | `/histories/:historyId/symptoms` | List symptoms for a history episode | — | `SymptomResponse[]` |
| `PUT` | `/histories/:historyId/symptoms/:symptomId` | Update a symptom | `UpdateSymptomDto` | `SymptomResponse` |
| `DELETE` | `/histories/:historyId/symptoms/:symptomId` | Delete a symptom | — | `204 No Content` |

#### Medication Endpoints

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/histories/:historyId/medications` | Add a medication record | `CreateMedicationDto` | `MedicationResponse` (201) |
| `GET` | `/histories/:historyId/medications` | List medications | — | `MedicationResponse[]` |
| `PUT` | `/histories/:historyId/medications/:medId` | Update a medication | `UpdateMedicationDto` | `MedicationResponse` |
| `DELETE` | `/histories/:historyId/medications/:medId` | Delete a medication | — | `204 No Content` |

#### Other Sub-Record Endpoints

The same CRUD pattern applies to all remaining sub-record tables. For brevity, the pattern is shown once — all tables follow identical endpoint structure:

| Resource | Base Path | Methods |
|---|---|---|
| Wound Injuries | `/histories/:historyId/wound-injury` | `GET`, `POST`, `PUT`, `DELETE` |
| Chronic Conditions | `/histories/:historyId/chronic-condition` | `GET`, `POST`, `PUT`, `DELETE` |
| Family History | `/histories/:historyId/family-history` | `GET`, `POST`, `PUT`, `DELETE` |
| Past History | `/histories/:historyId/past-history` | `GET`, `POST`, `PUT`, `DELETE` |
| Allergies | `/histories/:historyId/allergies` | `GET`, `POST`, `PUT`, `DELETE` |
| Lifestyle Factors | `/histories/:historyId/lifestyle` | `GET`, `POST`, `PUT`, `DELETE` |
| Reproductive History | `/histories/:historyId/reproductive-history` | `GET`, `POST`, `PUT`, `DELETE` |
| Mental Health | `/histories/:historyId/mental-health` | `GET`, `POST`, `PUT`, `DELETE` |
| Immunizations | `/histories/:historyId/immunizations` | `GET`, `POST`, `PUT`, `DELETE` |
| Extensible Fields | `/histories/:historyId/extensible-fields` | `GET`, `POST`, `PUT`, `DELETE` |

#### AI Endpoints

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/histories/:historyId/ai/generate-summary` | Generate clinician summary + patient recap | — | `{ summary, patientRecap }` (202 Accepted) |
| `POST` | `/histories/:historyId/ai/generate-questions` | Generate follow-up questions | — | `{ questions: string[] }` (200) |
| `POST` | `/histories/:historyId/ai/cluster-symptoms` | Cluster symptoms by body system | — | `{ clusters: SymptomCluster[] }` (200) |
| `POST` | `/histories/:historyId/ai/extract-risk-factors` | Extract risk factors | — | `{ riskFactors: RiskFactor[] }` (200) |
| `POST` | `/histories/:historyId/ai/generate-timeline` | Construct chronological timeline | — | `{ timeline: TimelineEvent[] }` (200) |
| `GET` | `/histories/:historyId/ai/status` | Get AI processing status | — | `{ status, progress, completedSteps }` (200) |
| `GET` | `/histories/:historyId/ai/audit-trail` | Get AI audit log for the episode | — | `AiAuditEntry[]` (200) |
| `PUT` | `/histories/:historyId/ai/summary` | Update AI-generated summary (clinician edit) | `UpdateAiSummaryDto` | `MedicalHistoryResponse` (200) |

#### Bulk Operations

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `PUT` | `/histories/:historyId/bulk` | Update multiple sub-records in one transaction | `BulkUpdateDto` | `FullMedicalHistoryResponse` (200) |

#### Example: Create Patient Profile

```http
POST /api/v1/patients
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "firstName": "Ivan",
  "lastName": "Petrov",
  "middleName": "Sergeevich",
  "gender": "male",
  "dateOfBirth": "1985-03-15",
  "heightCm": 178,
  "weightKg": 82.5,
  "occupation": "Software Engineer",
  "phone": "+79991234567",
  "addressLine1": "ul. Tverskaya 10",
  "city": "Moscow",
  "country": "RU"
}
```

Response (201 Created):

```json
{
  "id": "f0e1d2c3-b4a5-6789-0abc-def123456789",
  "userId": "user-uuid-here",
  "caseNumber": "MED-2026-000001",
  "firstName": "Ivan",
  "lastName": "Petrov",
  "middleName": "Sergeevich",
  "gender": "male",
  "dateOfBirth": "1985-03-15",
  "heightCm": 178,
  "weightKg": 82.5,
  "bmi": 26.0,
  "bmiCategory": "overweight",
  "occupation": "Software Engineer",
  "phone": "+79991234567",
  "createdAt": "2026-09-18T14:30:00.000Z",
  "updatedAt": "2026-09-18T14:30:00.000Z"
}
```

#### Example: Create Medical History Episode

```http
POST /api/v1/patients/f0e1d2c3-b4a5-6789-0abc-def123456789/histories
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "chiefComplaint": "Chest pain and shortness of breath for the past 3 days",
  "episodeDate": "2026-09-18T14:30:00.000Z"
}
```

Response (201 Created):

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "patientId": "f0e1d2c3-b4a5-6789-0abc-def123456789",
  "episodeDate": "2026-09-18T14:30:00.000Z",
  "chiefComplaint": "Chest pain and shortness of breath for the past 3 days",
  "status": "draft",
  "createdAt": "2026-09-18T14:30:00.000Z",
  "updatedAt": "2026-09-18T14:30:00.000Z"
}
```

### 5.4 Environment Variables

#### Frontend (Next.js — Vercel)

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | NestJS backend API base URL | `https://api.medic1905.com` |
| `NEXT_PUBLIC_AI_SERVICE_URL` | Yes | Python FastAPI AI service base URL | `https://ai.medic1905.com` |
| `NEXTAUTH_URL` | Yes | NextAuth.js canonical URL | `https://app.medic1905.com` |
| `NEXTAUTH_SECRET` | Yes | NextAuth.js secret key | `<random-32-char-string>` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret | `<secret>` |

#### Backend (NestJS)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DATABASE_URL_POOLING` | No | Neon pooled connection string (for connection pooling) | `postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require` |
| `JWT_SECRET` | Yes | JWT signing secret | `<random-64-char-string>` |
| `JWT_EXPIRES_IN` | No | JWT token expiration | `7d` |
| `PORT` | No | Backend port (defaults to 3001) | `3001` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins | `https://app.medic1905.com,https://medic1905.vercel.app` |
| `AI_SERVICE_URL` | Yes | Python FastAPI AI service URL | `http://ai-service:8000` |
| `AI_SERVICE_API_KEY` | Yes | API key for authenticating with AI service | `<service-api-key>` |
| `CASE_NUMBER_PREFIX` | No | Prefix for case numbers (default: `MED`) | `MED` |

#### AI Service (Python FastAPI)

| Variable | Required | Description | Example |
|---|---|---|---|
| `KIMI_API_KEY` | Yes | Kimi K3 LLM API key | `<kimi-api-key>` |
| `KIMI_API_BASE_URL` | Yes | Kimi API base URL | `https://api.moonshot.cn/v1` |
| `KIMI_MODEL` | No | Model identifier (default: `kimi-k3`) | `kimi-k3` |
| `DATABASE_URL` | Yes | Neon Postgres connection string (for audit trail) | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `NESTJS_API_URL` | Yes | NestJS backend URL (for callback / audit) | `http://nestjs:3001` |
| `NESTJS_API_KEY` | Yes | API key for NestJS authentication | `<nestjs-api-key>` |
| `PROMPT_TEMPLATE_DIR` | No | Directory for prompt templates | `./prompts` |
| `MAX_INPUT_TOKENS` | No | Max input tokens per request (default: 32000) | `32000` |
| `MAX_OUTPUT_TOKENS` | No | Max output tokens per request (default: 4096) | `4096` |
| `SAFETY_FILTER_ENABLED` | No | Enable post-LLM safety filter (default: `true`) | `true` |
| `LOG_LEVEL` | No | Logging level (default: `INFO`) | `INFO` |

#### Database (Neon Postgres)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Primary connection string (NestJS Prisma) | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DIRECT_URL` | No | Direct connection for migrations | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DATABASE_URL_POOLING` | No | Pooled connection (PgBouncer mode) | `postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require` |

### 5.5 Prisma Schema (Reference)

Below is the complete Prisma schema for all patient history tables:

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Gender {
  male
  female
  other
}

enum BmiCategory {
  underweight
  normal
  overweight
  obese
}

enum MedicalHistoryStatus {
  draft
  ai_processed
  clinician_reviewed
  signed_off
}

enum MedicationType {
  CURRENT
  RECENT
}

enum ChronicConditionType {
  type1
  type2
  gestational
}

enum PastHistoryType {
  diagnosis
  surgery
  hospitalization
}

enum AllergyType {
  drug
  food
  environmental
  other
}

enum AllergySeverity {
  mild
  moderate
  severe
}

enum SmokingStatus {
  never
  former
  current
}

enum AlcoholStatus {
  none
  occasional
  moderate
  heavy
}

enum MentalHealthTreatmentStatus {
  untreated
  in_treatment
  resolved
}

enum ImmunizationStatus {
  completed
  scheduled
  declined
}

enum ExtensibleFieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  JSON
}

model PatientProfile {
  id            String       @id @default(uuid())
  userId        String       @unique
  caseNumber    String       @unique
  firstName     String
  lastName      String
  middleName    String?
  gender        Gender
  dateOfBirth   DateTime
  heightCm      Int?
  weightKg      Decimal?
  bmi           Decimal?
  bmiCategory   BmiCategory?
  occupation    String?
  addressLine1  String?
  addressLine2  String?
  city          String?
  region        String?
  postalCode    String?
  country       String?
  phone         String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  emergencyContacts EmergencyContact[]
  medicalHistories  MedicalHistory[]

  @@index([lastName, firstName])
  @@map("patient_profiles")
}

model EmergencyContact {
  id           String   @id @default(uuid())
  patientId    String
  name         String
  relationship String
  phone        String?
  addressLine1 String?
  addressLine2 String?
  city         String?
  region       String?
  postalCode   String?
  country      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  patient PatientProfile @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("emergency_contacts")
}

model MedicalHistory {
  id                 String                @id @default(uuid())
  patientId          String
  episodeDate        DateTime
  chiefComplaint     String
  aiSummary          Json?
  aiPatientRecap     String?
  aiFollowupQuestions Json?
  aiRiskFactors      Json?
  aiSymptomClusters  Json?
  aiTimeline         Json?
  clinicianReview    String?
  clinicianId        String?
  reviewedAt         DateTime?
  status             MedicalHistoryStatus  @default(draft)
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt

  patient             PatientProfile        @relation(fields: [patientId], references: [id], onDelete: Cascade)
  symptoms            Symptom[]
  medications         MedicationRecord[]
  woundInjury         WoundInjury?
  chronicCondition    ChronicCondition?
  familyHistory       FamilyHistoryEntry[]
  pastHistory         PastHistoryEntry[]
  allergies           Allergy[]
  lifestyle           LifestyleFactor?
  reproductiveHistory ReproductiveHistory?
  mentalHealth        MentalHealthRecord[]
  immunizations       ImmunizationRecord[]
  extensibleFields    ExtensibleField[]
  auditTrail          AiAuditTrail[]

  @@index([patientId])
  @@index([status])
  @@map("medical_histories")
}

model Symptom {
  id               String   @id @default(uuid())
  medicalHistoryId String
  description      String
  onset            DateTime?
  worseningTime    DateTime?
  reliefTime       DateTime?
  character        String?
  severity         Int?
  duration         String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("symptoms")
}

model MedicationRecord {
  id               String         @id @default(uuid())
  medicalHistoryId String
  name             String
  dose             String?
  frequency        String?
  duration         String?
  type             MedicationType
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("medication_records")
}

model WoundInjury {
  id               String   @id @default(uuid())
  medicalHistoryId String
  hasInjury        Boolean
  location         String?
  type             String?
  timeSinceInjury  String?
  cause            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("wound_injuries")
}

model ChronicCondition {
  id                   String                 @id @default(uuid())
  medicalHistoryId     String
  hasDiabetes          Boolean
  diabetesType         ChronicConditionType?
  diabetesDiagnosedYear Int?
  hasStroke            Boolean
  strokeYear           Int?
  strokeOutcome        String?
  hasHeartAttack       Boolean
  heartAttackYear      Int?
  heartAttackOutcome   String?
  otherConditions      Json?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("chronic_conditions")
}

model FamilyHistoryEntry {
  id               String   @id @default(uuid())
  medicalHistoryId String
  condition        String
  relationship     String
  ageAtOnset       Int?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("family_history_entries")
}

model PastHistoryEntry {
  id               String           @id @default(uuid())
  medicalHistoryId String
  entryType        PastHistoryType
  description      String
  date             DateTime?
  outcome          String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("past_history_entries")
}

model Allergy {
  id               String          @id @default(uuid())
  medicalHistoryId String
  type             AllergyType
  allergen         String
  reaction         String?
  severity         AllergySeverity?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("allergies")
}

model LifestyleFactor {
  id                    String         @id @default(uuid())
  medicalHistoryId      String
  smokingStatus         SmokingStatus?
  smokingDetails        String?
  alcoholStatus         AlcoholStatus?
  alcoholDetails        String?
  physicalActivity      String?
  sleepPatterns         String?
  travelHistory         String?
  occupationalExposure  String?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("lifestyle_factors")
}

model ReproductiveHistory {
  id                 String   @id @default(uuid())
  medicalHistoryId   String
  pregnanciesCount   Int?
  deliveriesCount    Int?
  complications      String?
  lastMenstrualPeriod DateTime?
  contraceptiveUse   String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("reproductive_histories")
}

model MentalHealthRecord {
  id               String                    @id @default(uuid())
  medicalHistoryId String
  condition        String
  duration         String?
  treatmentStatus  MentalHealthTreatmentStatus?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("mental_health_records")
}

model ImmunizationRecord {
  id               String             @id @default(uuid())
  medicalHistoryId String
  vaccine          String
  date             DateTime?
  status           ImmunizationStatus?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@map("immunization_records")
}

model ExtensibleField {
  id               String              @id @default(uuid())
  medicalHistoryId String
  fieldName        String
  fieldValue       Json
  fieldType        ExtensibleFieldType
  category         String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@index([medicalHistoryId])
  @@index([category])
  @@map("extensible_fields")
}

model AiAuditTrail {
  id                    String   @id @default(uuid())
  medicalHistoryId      String
  operationType         String
  inputHash             String
  modelVersion          String
  promptTemplateVersion String
  output                Json
  filtered              Boolean  @default(false)
  filterReason          String?
  clinicianEdited       Boolean  @default(false)
  createdAt             DateTime @default(now())

  medicalHistory MedicalHistory @relation(fields: [medicalHistoryId], references: [id], onDelete: Cascade)

  @@index([medicalHistoryId])
  @@index([operationType])
  @@map("ai_audit_trail")
}
```

### 5.6 Folder Structure

```
imedics/
├── docs/
│   └── PATIENT_HISTORY_MODULE.md        ← this document
├── frontend/                            ← Next.js 14 app
│   ├── app/
│   │   ├── patients/
│   │   │   ├── [patientId]/
│   │   │   │   ├── histories/
│   │   │   │   │   ├── [historyId]/
│   │   │   │   │   │   └── page.tsx     ← Medical history form page
│   │   │   │   │   └── new/
│   │   │   │   │       └── page.tsx     ← New history episode
│   │   │   │   └── page.tsx            ← Patient dashboard
│   │   │   └── new/
│   │   │       └── page.tsx            ← New patient form
│   │   └── layout.tsx
│   ├── components/
│   │   ├── patient-history/
│   │   │   ├── MedicalHistoryForm.tsx
│   │   │   ├── ChiefComplaintStep.tsx
│   │   │   ├── SymptomsStep.tsx
│   │   │   ├── MedicationsStep.tsx
│   │   │   ├── ChronicConditionsStep.tsx
│   │   │   ├── FamilyHistoryStep.tsx
│   │   │   ├── AllergiesStep.tsx
│   │   │   ├── LifestyleStep.tsx
│   │   │   ├── ExtensibleFieldsSection.tsx
│   │   │   ├── AISuggestionsPanel.tsx
│   │   │   ├── PatientRecapModal.tsx
│   │   │   └── ClinicianSummaryView.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── schemas/
│   │   │   ├── patient-profile.schema.ts
│   │   │   └── medical-history.schema.ts
│   │   ├── api/
│   │   │   ├── patient-profiles.api.ts
│   │   │   ├── medical-histories.api.ts
│   │   │   └── ai.api.ts
│   │   └── utils/
│   │       └── bmi.ts                   ← BMI calculation
│   └── package.json
├── backend/                              ← NestJS app
│   ├── src/
│   │   ├── modules/
│   │   │   ├── patient-profile/
│   │   │   │   ├── patient-profile.module.ts
│   │   │   │   ├── patient-profile.controller.ts
│   │   │   │   ├── patient-profile.service.ts
│   │   │   │   └── dto/
│   │   │   ├── medical-history/
│   │   │   │   ├── medical-history.module.ts
│   │   │   │   ├── medical-history.controller.ts
│   │   │   │   ├── medical-history.service.ts
│   │   │   │   └── dto/
│   │   │   ├── symptoms/
│   │   │   ├── medications/
│   │   │   ├── wound-injuries/
│   │   │   ├── chronic-conditions/
│   │   │   ├── family-history/
│   │   │   ├── past-history/
│   │   │   ├── allergies/
│   │   │   ├── lifestyle-factors/
│   │   │   ├── reproductive-history/
│   │   │   ├── mental-health/
│   │   │   ├── immunizations/
│   │   │   ├── extensible-fields/
│   │   │   ├── ai/
│   │   │   │   ├── ai.module.ts
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── ai.service.ts
│   │   │   │   └── audit/
│   │   │   └── case-number/
│   │   │       └── case-number.service.ts
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── ai-service/                           ← Python FastAPI
    ├── app/
    │   ├── main.py
    │   ├── routers/
    │   │   ├── summary.py
    │   │   ├── questions.py
    │   │   ├── clustering.py
    │   │   ├── risk_factors.py
    │   │   └── timeline.py
    │   ├── services/
    │   │   ├── llm_service.py
    │   │   ├── safety_filter.py
    │   │   └── prompt_renderer.py
    │   ├── prompts/
    │   │   ├── clinician_summary.j2
    │   │   ├── patient_recap.j2
    │   │   └── question_generation.j2
    │   └── models/
    └── requirements.txt
```

---

## Appendix A: Status Workflow

```
┌────────┐     save     ┌──────────────┐     AI call    ┌──────────────┐
│ draft  │ ────────────▶ │ draft (saved)│ ─────────────▶ │ ai_processed │
└────────┘              └──────────────┘                └──────┬───────┘
                                                              │
                                                     clinician review
                                                              │
                                                              ▼
                                              ┌───────────────────────┐
                                              │ clinician_reviewed    │
                                              └───────────┬───────────┘
                                                          │
                                                  sign off
                                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │ signed_off (locked)   │
                                              └───────────────────────┘
```

Once an episode reaches `signed_off` status, all fields become read-only. Any corrections require a new episode with a reference to the original.

---

## Appendix B: Error Response Format

All API errors follow a consistent format:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "heightCm",
      "message": "Height must be between 30 and 300 cm"
    },
    {
      "field": "phone",
      "message": "Phone must be in E.164 format (e.g., +79991234567)"
    }
  ],
  "timestamp": "2026-09-18T14:30:00.000Z",
  "path": "/api/v1/patients"
}
```

---

*End of Document*
