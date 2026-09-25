# Medic1905 — Full Platform Specification

> **Version**: 2.0 | **Last Updated**: 2026-09-25 | **Status**: Active Development

A comprehensive specification for the Medic1905 telemedicine platform — a Beeline-inspired, mobile-first telemedicine and medical records system built with Next.js, Neon PostgreSQL, and Prisma ORM.

---

## Table of Contents

1. [Role-Based Visibility Rules](#1-role-based-visibility-rules)
2. [Responsive Design Requirements](#2-responsive-design-requirements)
3. [Patient Module (No AI)](#3-patient-module-no-ai)
4. [Doctor Module (With AI)](#4-doctor-module-with-ai)
5. [Laboratory Module](#5-laboratory-module)
6. [Data Model Requirements](#6-data-model-requirements)
7. [Workflows](#7-workflows)
8. [API Endpoints](#8-api-endpoints)
9. [Design System](#9-design-system)

---

## 1. Role-Based Visibility Rules (Strict)

The platform enforces strict role-based access control (RBAC) across three primary roles: **Patient**, **Doctor**, and **Laboratory Staff**. An **Admin** role exists for system management.

### 1.1 Patients

#### Patients CAN:
| # | Capability | Description |
|---|-----------|-------------|
| 1 | View own analysis results | Lab values, imaging reports belonging to the patient |
| 2 | View own diagnostic results | Doctor-written diagnostic notes only |
| 3 | View own case file | Case number, basic info, status |
| 4 | View own case history | Timeline of visits, tests, prescriptions |
| 5 | View own prescriptions | Medication name, dose, frequency |
| 6 | Browse doctors directory | Search and view doctor profiles only |
| 7 | Book an appointment | Schedule a consultation with a doctor |
| 8 | Consult with a doctor | Video or chat consultation |
| 9 | Book a follow-up consultation | Schedule a follow-up to a previous appointment |
| 10 | Rate doctors | 1–5 star rating system |
| 11 | Comment on doctors | Leave text reviews |
| 12 | Like a doctor | Express approval with a like |

#### Patients CANNOT:
- See any other patient's data
- See any lab staff information
- Use any AI features (AI is doctor-only)
- Access lab order management
- Write consultation notes
- Request lab tests directly

### 1.2 Doctors

#### Doctors CAN:
| # | Capability | Description |
|---|-----------|-------------|
| 1 | View booking requests | Appointments requested with them |
| 2 | View their patients | Only patients assigned to them |
| 3 | Write consultations | Structured clinical notes |
| 4 | Chat with patients | In-app messaging |
| 5 | Request lab analysis | Order lab tests for their patients |
| 6 | Request diagnostics | Order imaging/diagnostic procedures |
| 7 | Publish consultation schedule | Manage availability calendar |
| 8 | Use AI-driven capabilities | AI consultation drafting, risk highlighting, follow-up suggestions |
| 9 | Add/admit a patient | Register and admit patients under their care |
| 10 | Discharge a patient | Release patients from active care |
| 11 | Access doctor dashboard | Role-specific dashboard with neon tiles |
| 12 | Display verification badge | Medical crest symbol on profile |

#### Doctors CANNOT:
- See other doctors' patients
- See other doctors' private data or schedules
- Access lab result entry/upload functions
- Modify lab orders they didn't create

### 1.3 Laboratory Staff

#### Lab Staff CAN:
| # | Capability | Description |
|---|-----------|-------------|
| 1 | View all registered users | Doctors and patients |
| 2 | View all lab test requests | All lab orders across the system |
| 3 | Update patient results | Edit existing lab result values |
| 4 | Upload patient results | PDF, images, and numeric value entry |

#### Lab Staff CANNOT:
- Modify doctor consultation notes
- Access non-lab parts of patient history beyond what is required for lab processing
- Prescribe medications
- Book or manage appointments
- Use AI features

---

## 2. Responsive Design Requirements

### 2.1 Breakpoint Strategy

| Device | Width | Layout | Navigation |
|--------|-------|--------|------------|
| Mobile | < 768px | Single-column, stacked cards | Bottom navigation bar |
| Tablet | 768px–1024px | Two-column, collapsible sidebar | Slide-out sidebar |
| Desktop | > 1024px | Multi-column dashboard | Persistent left sidebar |

### 2.2 Mobile Layout (Primary)
```
┌─────────────────────────────────┐
│  [☰]  Medic1905          [🔔]  │  ← Top bar
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │  Neon Tile Card 1       │   │  ← Stacked neon cards
│  │  20-28px radius         │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Neon Tile Card 2       │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  [🏠] [📋] [💬] [👤]           │  ← Bottom navigation
└─────────────────────────────────┘
```

### 2.3 Tablet Layout
```
┌────────┬────────────────────────┐
│        │                        │
│ [☰]   │  ┌─────────┬─────────┐ │  ← Two-column grid
│        │  │ Card 1  │ Card 2  │ │
│ Home   │  └─────────┴─────────┘ │
│ Labs   │                        │
│ Doctors│  ┌─────────┬─────────┐ │
│ Profile│  │ Card 3  │ Card 4  │ │
│        │  └─────────┴─────────┘ │
│        │                        │
└────────┴────────────────────────┘
     ↑ Collapsible sidebar
```

### 2.4 Desktop Layout
```
┌──────────┬───────────────────────────────────┐
│          │  Dashboard Title          [🔔] [👤]│
│ Medic1905├───────────────────────────────────┤
│          │                                   │
│ ▸ Home   │  ┌──────┐ ┌──────┐ ┌──────┐     │
│ ▸ Doctors│  │ Tile │ │ Tile │ │ Tile │     │  ← Multi-column
│ ▸ Patients│  └──────┘ └──────┘ └──────┘     │
│ ▸ Lab    │                                   │
│ ▸ Diag.  │  ┌────────────┐ ┌────────────┐  │
│ ▸ Chat   │  │ Wide Card  │ │ Wide Card  │  │
│ ▸ Sett.  │  └────────────┘ └────────────┘  │
│          │                                   │
└──────────┴───────────────────────────────────┘
     ↑ Persistent sidebar
```

### 2.5 Beeline-Style UI Principles

| Principle | Specification |
|-----------|--------------|
| Card radius | 20–28px (`rounded-3xl`) |
| Primary accent | Neon Yellow `#FFD400` |
| Secondary accent | Neon Teal `#22D3EE` |
| Background | Dark Navy `#0A0F1C` |
| Card background | Navy Light `#131A2E` |
| Shadows | Soft, with neon glow on hover |
| Action tiles | Large, icon-led, full-width on mobile |
| Typography | Clean sans-serif, bold headings |
| Spacing | Mobile-first, generous padding (20–24px) |
| Animations | Fade-in, glow-pulse, smooth transitions |

---

## 3. Patient Module (No AI)

### 3.1 Patient Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | View analysis results | Lab values with reference ranges, imaging reports |
| 2 | View diagnostic results | Doctor-written diagnostic notes only (no AI) |
| 3 | Book appointment with doctor | Search directory, select time slot, confirm booking |
| 4 | Consult with doctor | Video call or text chat within the platform |
| 5 | View case file | Case number, basic info, status, assigned doctor |
| 6 | View case history | Chronological timeline of visits, tests, prescriptions |
| 7 | View prescriptions | Medication name, dose, frequency, duration, instructions |
| 8 | Book follow-up consultation | Schedule a follow-up to a previous appointment |
| 9 | Rate doctors | 1–5 star rating with optional review text |
| 10 | Comment on doctors | Leave detailed text reviews |
| 11 | Like a doctor | One-tap like action on doctor profile |

### 3.2 Patient UI Screens

#### 3.2.1 Patient Dashboard (Neon Tiles)
```
┌─────────────────────────────────┐
│  Hi [Patient Name],             │
│  manage your care in one place.  │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📋  Analysis Results    │   │
│  │  View your lab results  │   │  ← Neon yellow tile
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🔬  Diagnostics         │   │
│  │  Doctor's diagnostic    │   │  ← Neon teal tile
│  │  notes for you          │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📅  Book Appointment    │   │
│  │  Schedule with a doctor │   │  ← Neon yellow tile
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  💊  Prescriptions       │   │
│  │  Your active meds       │   │  ← Neon teal tile
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────┬─────────┬─────────┐│
│  │  Home   │ Doctors │ Profile ││  ← Bottom nav
│  └─────────┴─────────┴─────────┘│
└─────────────────────────────────┘
```

#### 3.2.2 Analysis Results Page
- List of lab results with test name, date, lab name
- Status badges (pending, reviewed, critical)
- Tap to expand: individual values with reference ranges
- Color-coded values (normal=green, high=red, low=amber)
- PDF/image attachment viewer

#### 3.2.3 Diagnostics Page
- List of diagnostic results written by doctors
- Each entry: title, date, doctor name, summary
- Expandable details section
- No AI interpretations visible to patient

#### 3.2.4 Case File Page
- Case number display (prominent, neon-accented)
- Patient basic info (name, DOB, gender)
- Assigned doctor name with verification badge
- Case status (open/closed)
- Linked records summary

#### 3.2.5 Case History Timeline
- Vertical timeline with neon dots
- Chronological entries: visits, tests, prescriptions, procedures
- Each entry: date, type icon, title, summary
- Color-coded by entry type
- Tap to expand details

#### 3.2.6 Prescriptions Page
- Active prescriptions (prominent cards)
- Medication name, dose, frequency, duration
- Prescribing doctor name and date
- Status badge (active, discontinued, expired)
- Historical prescriptions below

#### 3.2.7 Doctor Directory
- Grid of doctor cards (neon-accented)
- Search bar with specialty filter
- Each card: photo, name, specialty, rating stars, verified badge
- "Book Appointment" button on each card
- "Like" heart icon

#### 3.2.8 Doctor Rating/Comment Modal
- Star rating selector (1–5)
- Comment text area
- Like toggle
- Submit button (neon-styled)

#### 3.2.9 Appointment Booking Form
- Doctor selection (pre-filled from directory)
- Date picker
- Time slot selector (from doctor's schedule)
- Reason for visit (text area)
- Consultation type (in-person, telemedicine)
- Confirm button

#### 3.2.10 Follow-Up Booking Modal
- Previous appointment reference
- Doctor selection (same doctor pre-selected)
- Date/time picker
- Notes field
- Confirm button

#### 3.2.11 Consultation Chat/Video Screen
- Video feed area (telemedicine mode)
- Chat message area (text mode)
- Switch between video and chat
- Attachment sharing
- Call controls (mute, camera, end call)
- Message read receipts

---

## 4. Doctor Module (With AI)

### 4.1 Doctor Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | View booking requests | List of appointment requests for the doctor |
| 2 | View their patients | Only patients assigned to this doctor |
| 3 | Write consultations | Structured notes: chief complaint, HPI, exam, diagnosis, plan |
| 4 | Chat with patients | In-app messaging with assigned patients |
| 5 | Request lab analysis | Order lab tests for patients |
| 6 | Request diagnostics | Order imaging and diagnostic procedures |
| 7 | Publish consultation schedule | Manage availability calendar |
| 8 | AI-assisted consultation drafting | AI generates draft consultation notes |
| 9 | AI-assisted risk factor highlighting | AI flags potential risk factors in patient data |
| 10 | AI-assisted follow-up questions | AI suggests questions for the patient |
| 11 | Add/admit a patient | Register new patient and assign to self |
| 12 | Discharge a patient | Release patient from active care |

### 4.2 Doctor UI Screens

#### 4.2.1 Doctor Dashboard (Neon Tiles)
```
┌─────────────────────────────────┐
│  Dr. [Doctor Name] [✓ verified] │
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 📅   │ │ 👤   │ │ 📋   │   │  ← Quick stats
│  │ 12   │ │ 24   │ │ 8    │   │
│  │ Books│ │ Pats  │ │ Labs  │   │
│  └──────┘ └──────┘ └──────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📝  New Consultation    │   │  ← Neon yellow tile
│  │  Write structured notes │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🤖  AI Assistant        │   │  ← Neon teal tile
│  │  Draft, risk, follow-up │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📅  Schedule            │   │  ← Neon yellow tile
│  │  Manage availability    │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────┬─────────┬─────────┐│
│  │ Home   │ Patients│ Schedule ││  ← Bottom nav
│  └─────────┴─────────┴─────────┘│
└─────────────────────────────────┘
```

#### 4.2.2 Booking Requests List
- List of pending appointment requests
- Each item: patient name, requested time, reason
- Accept/Decline buttons
- Status badges (pending, confirmed, declined)

#### 4.2.3 Patient List
- Only patients assigned to this doctor
- Search and filter
- Each card: name, case number, status badge, last visit date
- Tap to view patient detail
- "Admit Patient" button at top

#### 4.2.4 Consultation Editor
- Structured form with sections:
  - Chief Complaint
  - History of Present Illness
  - Examination Findings
  - Diagnosis
  - Differential Diagnosis
  - Treatment Plan
  - Follow-up Plan
  - Free Notes
- AI Assist panel (sidebar on desktop, modal on mobile):
  - "Generate Draft" button → AI drafts consultation text
  - "Highlight Risk Factors" → AI flags risks in patient data
  - "Suggest Follow-up Questions" → AI generates question list
- All AI output is editable and requires doctor approval
- Status: Draft → Finalized

#### 4.2.5 Chat Interface
- Conversation list (assigned patients only)
- Message thread with timestamps
- Read receipts
- Attachment support
- Quick reply suggestions

#### 4.2.6 Lab Request Form
- Patient selection (assigned patients)
- Test selection from catalog
- Multiple tests per order
- Notes field
- Priority selector (routine, urgent)
- Submit button

#### 4.2.7 Diagnostics Request Form
- Patient selection
- Modality selection (X-ray, CT, MRI, ultrasound)
- Body part specification
- Clinical indication
- Priority selector
- Submit button

#### 4.2.8 Schedule Management Calendar
- Weekly calendar view
- Time slot management (add/remove availability)
- Day-of-week recurring schedule
- Special availability (vacation, holidays)
- Save and publish

#### 4.2.9 Admit/Discharge Workflow
**Admit:**
- Patient search or new patient form
- Case number assignment (auto-generated)
- Assign to self
- Set admission date
- Confirm

**Discharge:**
- Select patient from active list
- Discharge summary field
- Set discharge date
- Confirm

#### 4.2.10 Verification Badge Display
- Medical crest SVG icon
- Displayed next to doctor name on all screens
- Tooltip: "Verified Medical Professional"
- Only shown for doctors with `verified = true`

---

## 5. Laboratory Module

### 5.1 Lab Staff Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | View all registered users | Doctors and patients directory |
| 2 | View all lab test requests | All lab orders across the system |
| 3 | Update patient results | Edit existing result values and status |
| 4 | Upload patient results | PDF, images, and manual numeric entry |

### 5.2 Lab UI Screens

#### 5.2.1 Lab Dashboard
```
┌─────────────────────────────────┐
│  Lab Dashboard                  │
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 📋   │ │ ⏳   │ │ ✅   │   │  ← Stats tiles
│  │ 45   │ │ 12   │ │ 33   │   │
│  │Orders│ │Pend. │ │Done  │   │
│  └──────┘ └──────┘ └──────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📋  Lab Orders           │   │  ← Neon yellow tile
│  │  View all requests       │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  👥  User Directory      │   │  ← Neon teal tile
│  │  Doctors & patients     │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────┬─────────┬─────────┐│
│  │ Home   │ Orders  │ Users   ││  ← Bottom nav
│  └─────────┴─────────┴─────────┘│
└─────────────────────────────────┘
```

#### 5.2.2 User Directory (Doctors/Patients)
- Tabbed view: Doctors | Patients
- Searchable list with filters
- Doctor cards: name, specialty, verified badge
- Patient cards: name, case number, status

#### 5.2.3 Lab Orders List
- All lab orders across the system
- Filterable by status (pending, in-progress, completed)
- Each item: patient name, test name, doctor, order date, status
- Tap to open result entry

#### 5.2.4 Lab Result Entry Form
- Patient and test info (pre-filled from order)
- Manual numeric value entry fields
- Reference range display with normal/high/low indicators
- Status selector per value (normal, high, low, critical)
- Notes field
- Save as draft or submit

#### 5.2.5 Lab Result Upload Page
- File upload area (PDF, images: X-ray, CT, ultrasound)
- Drag-and-drop support
- File preview
- Result type selector:
  - X-ray
  - CT scan
  - Ultrasound
  - Blood analysis (hematology, microbiology, chemical pathology, histopathology)
  - Stool analysis/culture
  - Swab test results
- Manual numeric value entry (optional alongside files)
- Submit button

---

## 6. Data Model Requirements

### 6.1 User Table (Authentication & Roles)

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier (cuid) |
| email | TEXT (UNIQUE) | Login email |
| password | TEXT | Hashed password |
| role | ENUM | PATIENT, DOCTOR, LAB_STAFF, ADMIN |
| name | TEXT | Full name |
| phone | TEXT? | Phone number |
| dateOfBirth | DATE? | Date of birth |
| sex | TEXT? | Gender |
| language | TEXT | Preferred language (default: en) |
| avatarUrl | TEXT? | Profile photo URL |
| isActive | BOOLEAN | Account active status |
| lastLoginAt | TIMESTAMP? | Last login timestamp |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

### 6.2 Doctor Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| firstName | TEXT | First name |
| lastName | TEXT | Last name |
| middleName | TEXT? | Middle name |
| photoUrl | TEXT? | Profile photo |
| specialty | TEXT | Primary specialty |
| subSpecialty | TEXT? | Sub-specialty |
| experienceYears | INT | Years of experience |
| rating | FLOAT | Average rating (0.0–5.0) |
| reviewCount | INT | Number of reviews |
| likeCount | INT | Number of likes |
| licenseNumber | TEXT? | Medical license number |
| verified | BOOLEAN | Verification badge status |
| userId | TEXT? (FK) | Linked user account |
| bio | TEXT? | Biography |
| languages | TEXT[] | Spoken languages |
| consultationFee | FLOAT? | Consultation fee |
| location | TEXT? | Practice location |
| available | BOOLEAN | Currently available |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

### 6.3 Patient Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| caseNumber | TEXT (UNIQUE) | Case file number |
| firstName | TEXT | First name |
| lastName | TEXT | Last name |
| middleName | TEXT? | Middle name |
| dateOfBirth | DATE? | Date of birth |
| gender | TEXT? | Gender |
| address | TEXT? | Home address |
| phone | TEXT? | Phone number |
| email | TEXT? | Email address |
| heightCm | FLOAT? | Height in cm |
| weightKg | FLOAT? | Weight in kg |
| bmi | FLOAT? | Auto-calculated BMI |
| occupation | TEXT? | Occupation |
| bloodType | TEXT? | Blood type |
| emergencyContactName | TEXT? | Emergency contact name |
| emergencyContactPhone | TEXT? | Emergency contact phone |
| emergencyContactRelation | TEXT? | Emergency contact relationship |
| insuranceNumber | TEXT? | Insurance number |
| userId | TEXT? (FK) | Linked user account |
| status | TEXT | active, admitted, discharged |
| admittedAt | TIMESTAMP? | Admission timestamp |
| dischargedAt | TIMESTAMP? | Discharge timestamp |
| assignedDoctorId | TEXT? (FK) | Assigned doctor |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

### 6.4 Patient History Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| patientId | TEXT (FK) | Patient reference |
| entryType | TEXT | consultation, lab_test, imaging, prescription, procedure, note |
| date | TIMESTAMP | Entry date |
| doctorId | TEXT? | Attending doctor |
| doctorName | TEXT? | Doctor name |
| title | TEXT | Entry title |
| summary | TEXT? | Brief summary |
| details | JSON? | Structured data |
| attachments | JSON? | File URLs array |
| aiSummary | TEXT? | AI-generated summary |

### 6.5 Medical History Form Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| patientId | TEXT (FK) | Patient reference |
| complaint | TEXT? | Chief complaint |
| symptomOnset | TEXT? | Symptom onset time |
| symptomWorseningTime | TEXT? | Worsening time |
| symptomReliefTime | TEXT? | Relief time |
| symptomCharacter | TEXT? | Symptom character |
| currentMedications | TEXT? | Current medications |
| woundInjury | TEXT? | Wound/injury description |
| historyOfDiabetes | BOOLEAN | Diabetes history |
| historyOfStroke | BOOLEAN | Stroke history |
| historyOfHeartAttack | BOOLEAN | Heart attack history |
| familyHistory | TEXT? | Family history |
| pastHistory | TEXT? | Past medical history |
| allergies | TEXT? | Allergies |
| smokingStatus | TEXT? | Smoking status |
| alcoholUse | TEXT? | Alcohol use |
| activityLevel | TEXT? | Physical activity level |
| mentalHealthNotes | TEXT? | Mental health notes |
| immunizationRecords | TEXT? | Immunization records |
| travelHistory | TEXT? | Travel history |
| occupationalExposure | TEXT? | Occupational exposure |
| painScale | INT? | Pain scale (0–10) |
| sleepPatterns | TEXT? | Sleep patterns |
| aiClinicianSummary | TEXT? | AI clinician summary |
| aiPatientRecap | TEXT? | AI patient recap |
| aiFollowUpQuestions | TEXT? | AI follow-up questions |

### 6.6 Lab Tables

#### Lab Orders
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| testId | TEXT (FK) | Test reference |
| patientId | TEXT (FK) | Patient reference |
| doctorId | TEXT? (FK) | Ordering doctor |
| labName | TEXT? | Lab name |
| preferredDate | TIMESTAMP? | Preferred date |
| status | TEXT | pending, confirmed, in_progress, completed, cancelled |
| notes | TEXT? | Order notes |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

#### Lab Results
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| orderId | TEXT? (FK) | Source order |
| patientId | TEXT (FK) | Patient reference |
| testName | TEXT | Test name |
| labName | TEXT? | Lab name |
| resultDate | TIMESTAMP | Result date |
| status | TEXT | pending, ready, reviewed |
| values | JSON? | Result values array |
| aiInterpretation | TEXT? | AI interpretation |
| notes | TEXT? | Result notes |
| createdAt | TIMESTAMP | Creation timestamp |

#### Lab Result Values
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| resultId | TEXT (FK) | Result reference |
| testName | TEXT | Test name |
| value | FLOAT | Numeric value |
| unit | TEXT | Unit of measurement |
| refRange | TEXT? | Reference range text |
| refMin | FLOAT? | Minimum normal |
| refMax | FLOAT? | Maximum normal |
| status | TEXT | normal, high, low, critical |

#### Lab Result Files
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| resultId | TEXT (FK) | Result reference |
| fileName | TEXT | File name |
| fileUrl | TEXT | File URL |
| fileType | TEXT? | File type (pdf, image, etc.) |
| uploadedAt | TIMESTAMP | Upload timestamp |

### 6.7 Additional Tables

#### Prescriptions
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| patientId | TEXT (FK) | Patient reference |
| doctorId | TEXT (FK) | Prescribing doctor |
| appointmentId | TEXT? (FK) | Related appointment |
| medications | JSON | [{name, dose, frequency, duration, instructions}] |
| status | TEXT | active, discontinued, expired |
| notes | TEXT? | Prescription notes |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

#### Chat Messages
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| appointmentId | TEXT? (FK) | Related appointment |
| senderId | TEXT (FK) | Sender (User) |
| receiverId | TEXT | Receiver ID |
| message | TEXT | Message content |
| messageType | TEXT | TEXT, IMAGE, FILE, SYSTEM |
| attachmentUrl | TEXT? | Attachment URL |
| isRead | BOOLEAN | Read status |
| readAt | TIMESTAMP? | Read timestamp |
| createdAt | TIMESTAMP | Creation timestamp |

#### Consultations
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| patientId | TEXT (FK) | Patient reference |
| doctorId | TEXT (FK) | Doctor reference |
| appointmentId | TEXT? (FK) | Related appointment |
| caseId | TEXT? (FK) | Related diagnostics case |
| chiefComplaint | TEXT? | Chief complaint |
| historyPresentIllness | TEXT? | HPI |
| examination | TEXT? | Examination findings |
| diagnosis | TEXT? | Diagnosis |
| differentialDiagnosis | TEXT? | Differential diagnosis |
| treatmentPlan | TEXT? | Treatment plan |
| followUpPlan | TEXT? | Follow-up plan |
| notes | TEXT? | Free notes |
| aiDraft | TEXT? | AI-generated draft |
| aiRiskFactors | JSON? | AI risk factors |
| aiFollowUpQuestions | JSON? | AI follow-up questions |
| aiUsed | BOOLEAN | Whether AI was used |
| status | TEXT | draft, finalized, amended |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

#### Case Files
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| patientId | TEXT (FK) | Patient reference |
| caseNumber | TEXT (UNIQUE) | Case number |
| status | TEXT | open, closed |
| openedAt | TIMESTAMP | Opening timestamp |
| closedAt | TIMESTAMP? | Closing timestamp |
| summary | TEXT? | Case summary |
| consultationIds | TEXT[] | Linked consultation IDs |
| labResultIds | TEXT[] | Linked lab result IDs |
| imagingIds | TEXT[] | Linked imaging IDs |
| prescriptionIds | TEXT[] | Linked prescription IDs |
| openedById | TEXT? (FK) | User who opened the case |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

#### Audit Logs
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| userId | TEXT? (FK) | Acting user |
| action | TEXT | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT |
| resourceType | TEXT | Resource type |
| resourceId | TEXT? | Resource ID |
| details | JSON | Action details |
| ipAddress | TEXT? | IP address |
| userAgent | TEXT? | User agent |
| createdAt | TIMESTAMP | Creation timestamp |

---

## 7. Workflows

### 7.1 Patient Booking Workflow
```
Patient → Doctor Directory → Select Doctor → View Profile →
  → Check Availability → Select Date/Time → Enter Reason →
  → Confirm Booking → Doctor Notified → Doctor Accepts/Declines →
  → Patient Notified of Status
```

### 7.2 Consultation Workflow
```
Doctor → Patient List → Select Patient → Start Consultation →
  → [Optional: AI Draft] → Write Notes → [Optional: AI Risk Factors] →
  → [Optional: AI Follow-up Questions] → Review → Finalize →
  → Patient Notified → Case History Updated
```

### 7.3 Lab Test Ordering Workflow
```
Doctor → Select Patient → Request Lab Test → Select Tests →
  → Set Priority → Submit → Lab Staff Notified →
  → Lab Staff Processes Sample → Enter Results → Upload Files →
  → Results Saved → Doctor Notified → Doctor Reviews →
  → Patient Can View Results
```

### 7.4 Result Upload Workflow (Lab Staff)
```
Lab Staff → Lab Orders List → Select Order →
  → Upload Files (PDF/Image) → Enter Numeric Values →
  → Set Status per Value → Add Notes → Submit →
  → Results Stored → Doctor Notified → AI Analysis (if applicable) →
  → Doctor Reviews → Patient Notified
```

### 7.5 AI Analysis Workflow (Doctor Only)
```
Doctor → Open Consultation → Click "AI Assist" →
  → AI Processes Patient Data + Lab Results + Medical History →
  → Generates: Draft Notes, Risk Factors, Follow-up Questions →
  → Doctor Reviews → Edits as Needed → Approves →
  → Approved Content Saved to Consultation Record
```

### 7.6 Admit/Discharge Workflow
```
ADMIT:
Doctor → "Admit Patient" → Search/New Patient →
  → Case Number Assigned → Set Admission Date → Confirm →
  → Patient Status: "admitted" → Appears in Doctor's Patient List

DISCHARGE:
Doctor → Select Patient → "Discharge" →
  → Enter Discharge Summary → Set Discharge Date → Confirm →
  → Patient Status: "discharged" → Removed from Active List
```

### 7.7 Follow-Up Booking Workflow
```
Patient → Case History → Select Previous Appointment →
  → "Book Follow-up" → Same Doctor Pre-selected →
  → Select Date/Time → Confirm → Doctor Notified
```

---

## 8. API Endpoints

### 8.1 Authentication
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/api/auth/signup` | Register new user | Public |
| POST | `/api/auth/login` | User login | Public |
| POST | `/api/auth/refresh` | Refresh access token | Authenticated |
| POST | `/api/auth/logout` | User logout | Authenticated |

### 8.2 Patients
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/patients` | List patients (assigned only for doctors) | DOCTOR, LAB_STAFF, ADMIN |
| GET | `/api/patients/:id` | Get patient details | DOCTOR (own patients), PATIENT (self), LAB_STAFF, ADMIN |
| POST | `/api/patients` | Create/admit patient | DOCTOR |
| PATCH | `/api/patients/:id` | Update patient | DOCTOR, ADMIN |
| POST | `/api/patients/:id/discharge` | Discharge patient | DOCTOR |

### 8.3 Doctors
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/doctors` | List doctors (directory) | All roles |
| GET | `/api/doctors/:id` | Get doctor profile | All roles |
| GET | `/api/doctors/:id/schedule` | Get doctor schedule | All roles |
| PATCH | `/api/doctors/:id/schedule` | Update schedule | DOCTOR (self), ADMIN |

### 8.4 Appointments
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/appointments` | List appointments | DOCTOR (own), PATIENT (own), ADMIN |
| POST | `/api/appointments` | Book appointment | PATIENT, DOCTOR |
| PATCH | `/api/appointments/:id` | Update appointment | DOCTOR, PATIENT |
| POST | `/api/appointments/:id/follow-up` | Book follow-up | PATIENT |
| POST | `/api/appointments/:id/accept` | Accept booking request | DOCTOR |
| POST | `/api/appointments/:id/decline` | Decline booking | DOCTOR |

### 8.5 Consultations
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/consultations` | List consultations | DOCTOR (own), PATIENT (own) |
| POST | `/api/consultations` | Create consultation | DOCTOR |
| PATCH | `/api/consultations/:id` | Update consultation | DOCTOR |
| POST | `/api/consultations/:id/ai-draft` | AI-assisted draft | DOCTOR |
| POST | `/api/consultations/:id/ai-risk` | AI risk factors | DOCTOR |
| POST | `/api/consultations/:id/ai-followup` | AI follow-up questions | DOCTOR |

### 8.6 Lab Orders & Results
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/lab-orders` | List lab orders | DOCTOR, LAB_STAFF, ADMIN |
| POST | `/api/lab-orders` | Create lab order | DOCTOR |
| GET | `/api/lab-results` | List lab results | DOCTOR, PATIENT (own), LAB_STAFF, ADMIN |
| POST | `/api/lab-results` | Upload lab result | LAB_STAFF |
| PATCH | `/api/lab-results/:id` | Update lab result | LAB_STAFF |
| POST | `/api/lab-results/:id/values` | Enter numeric values | LAB_STAFF |
| POST | `/api/lab-results/:id/files` | Upload result files | LAB_STAFF |

### 8.7 Prescriptions
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/prescriptions` | List prescriptions | DOCTOR (own), PATIENT (own) |
| POST | `/api/prescriptions` | Create prescription | DOCTOR |

### 8.8 Chat Messages
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/chat/:appointmentId` | Get chat history | DOCTOR, PATIENT |
| POST | `/api/chat/:appointmentId` | Send message | DOCTOR, PATIENT |

### 8.9 Doctor Reviews
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/doctors/:id/reviews` | Get doctor reviews | All roles |
| POST | `/api/doctors/:id/reviews` | Create review | PATIENT |
| POST | `/api/doctors/:id/like` | Like/unlike doctor | PATIENT |

### 8.10 Case Files
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/case-files` | List case files | DOCTOR (own patients), PATIENT (own) |
| GET | `/api/case-files/:id` | Get case file details | DOCTOR, PATIENT |
| POST | `/api/case-files` | Open new case | DOCTOR |

### 8.11 Audit Logs
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/audit-logs` | List audit logs | ADMIN |

---

## 9. Design System

### 9.1 Color Palette (Beeline-Inspired)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-background` | `#F5F6FA` | `#0A0F1C` | App background |
| `--color-foreground` | `#2D3436` | `#F8F9FA` | Primary text |
| `--color-card` | `#FFFFFF` | `#131A2E` | Card background |
| `--color-card-border` | `#E8E9ED` | `#1C2540` | Card borders |
| `--color-primary` | `#FFD400` | `#FFD400` | Neon yellow accent |
| `--color-secondary` | `#22D3EE` | `#22D3EE` | Neon teal accent |
| `--color-muted` | `#F1F2F7` | `#1C2540` | Muted backgrounds |
| `--color-muted-foreground` | `#636E72` | `#9CA3AF` | Secondary text |
| `--color-destructive` | `#E74C3C` | `#FF6B6B` | Error/danger |
| `--color-success` | `#00B894` | `#7DF98C` | Success states |
| `--color-warning` | `#FDCB6E` | `#FB923C` | Warning states |

### 9.2 Neon Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neon-yellow` | `#FFD400` | Primary actions, active states |
| `--color-neon-teal` | `#22D3EE` | Secondary actions, info |
| `--color-neon-green` | `#7DF98C` | Success, positive indicators |
| `--color-neon-purple` | `#A78BFA` | AI features, special elements |
| `--color-neon-pink` | `#F472B6` | Likes, favorites |
| `--color-neon-orange` | `#FB923C` | Warnings, alerts |
| `--color-navy` | `#0A0F1C` | Dark background |
| `--color-navy-light` | `#131A2E` | Dark card background |

### 9.3 Typography

| Element | Size | Weight | Font |
|--------|------|--------|------|
| Page title | 24-36px | 800 | Display (system-ui) |
| Section heading | 18-24px | 700 | Display |
| Body text | 16-18px | 400 | Sans-serif |
| Small text | 14-16px | 400 | Sans-serif |
| Tiny labels | 12-14px | 500 | Sans-serif |
| Button text | 14-16px | 600 | Sans-serif |

### 9.4 Spacing System (4px Base)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon gaps, tight spacing |
| `--space-2` | 8px | Small component gaps |
| `--space-3` | 12px | Card spacing, list gaps |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Card padding (mobile) |
| `--space-6` | 24px | Card padding (desktop) |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Large section gaps |
| `--space-12` | 48px | Page section padding |

### 9.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 8px | Small elements, badges |
| `--radius-md` | 12px | Medium elements |
| `--radius-lg` | 16px | Standard cards |
| `--radius-xl` | 20px | Large cards (mobile) |
| `--radius-2xl` | 24px | Hero cards |
| `--radius-3xl` | 28px | Maximum card radius |
| `--radius-full` | 9999px | Pills, avatars |

### 9.6 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 24px rgba(0,0,0,0.08)` | Standard card shadow |
| `--shadow-neon` | `0 0 20px rgba(255,212,0,0.15)` | Yellow neon glow |
| `--shadow-neon-teal` | `0 0 20px rgba(34,211,238,0.15)` | Teal neon glow |

### 9.7 Component Patterns

#### Neon Tile Card
```css
.neon-tile {
  border-radius: 24px;
  padding: 20px;
  background: var(--color-card);
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;
}
.neon-tile:hover {
  box-shadow: var(--shadow-neon);
  transform: translateY(-2px);
}
```

#### Glass Card (overlay)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

#### Neon Gradient Text
```css
.neon-gradient-text {
  background: linear-gradient(135deg, #FFD400 0%, #22D3EE 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### 9.8 Animations

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `fade-in` | 0.4s | ease-out | Page/element entrance |
| `glow-pulse` | 2s | ease-in-out | Active neon elements |
| `hover-lift` | 0.3s | ease | Card hover effect |

---

## Summary

This specification defines the complete Medic1905 telemedicine platform with:

- **Strict role-based visibility** enforced across Patient, Doctor, and Lab Staff roles
- **Fully responsive design** (mobile, tablet, desktop) using Beeline-style UI with neon accents
- **Patient module** with 11 features and 11 screens (no AI)
- **Doctor module** with 12 features including 3 AI capabilities and 10 screens
- **Lab module** with 4 features and 5 screens for comprehensive lab result management
- **Complete data models** covering users, patients, doctors, lab tests, consultations, prescriptions, chat, case files, and audit logs
- **Defined workflows** for booking, consultation, lab testing, AI analysis, and admit/discharge
- **RESTful API endpoints** covering all modules with role-based access
- **Beeline-inspired design system** with neon colors, rounded cards, and mobile-first spacing
