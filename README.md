# Medic1905 — Telemedicine Platform

A modern telemedicine and medical records platform built with Next.js, featuring a Beeline-inspired design system with neon accents and rounded cards.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui components
- **Database**: Neon (PostgreSQL) with Prisma ORM
- **AI**: Kimi K3 for medical history analysis and diagnostics assistance
- **Hosting**: Vercel

## Design System — Beeline-Inspired

Beeline-inspired design language from the RuStore Beeline app:
- Primary: Neon Yellow (#FFD400)
- Secondary: Teal (#22D3EE)
- Background: Dark Navy (#0A0F1C)
- Rounded cards (20-28px radius)
- Soft shadows and neon glow effects
- Mobile-first layout with bottom navigation

### Responsive Breakpoints
- **Mobile**: Single-column layout, stacked neon cards, bottom navigation
- **Tablet**: Two-column layout, collapsible sidebar
- **Desktop**: Multi-column dashboard, persistent sidebar, wide cards

## Role-Based Access Control (RBAC)

### Patient (No AI Features)
- View own analysis results (lab values, imaging reports)
- View own diagnostic results (doctor-written only)
- Book appointments with doctors
- Consult with doctors (video or chat)
- View own case file and case history
- View own prescriptions
- Book follow-up consultations
- Rate, comment, and like doctors
- **Cannot**: See other patients, see lab staff, use AI features

### Doctor (With AI Features)
- View booking requests and assigned patients only
- Write structured consultations
- Chat with patients
- Request lab analysis and diagnostics
- Publish consultation schedule
- AI-assisted consultation drafting, risk factor highlighting, follow-up question suggestions
- Add/admit and discharge patients
- Verification badge (medical crest symbol)
- **Cannot**: See other doctors' patients or private data

### Laboratory Staff
- View all registered users (doctors + patients)
- View all lab test requests
- Update and upload patient results (PDF, images, numeric values)
- Upload: X-ray, CT scan, ultrasound, blood analysis, stool analysis, swab tests
- **Cannot**: Modify doctor consultation notes or access non-lab patient history

## Data Models

### Core Tables
| Table | Description |
|------|-------------|
| `users` | Authentication, roles (PATIENT, DOCTOR, LAB_STAFF, ADMIN) |
| `doctors` | Doctor profiles with specialty, schedule, verification |
| `patients` | Patient records with case numbers, BMI, emergency contacts |
| `patient_appointments` | Appointment booking with video/chat support |
| `patient_history` | Timeline of visits, tests, prescriptions |
| `prescriptions` | Medication prescriptions with dose, frequency |
| `consultations` | Structured consultation notes with AI-assisted fields |
| `chat_messages` | Doctor-patient messaging |
| `case_files` | Case file management with linked records |
| `audit_logs` | Compliance audit trail |

### Lab Tables
| Table | Description |
|------|-------------|
| `lab_tests` | Lab test catalog (blood, urine, stool, swab, imaging) |
| `lab_orders` | Lab test order management |
| `lab_results` | Lab results with AI interpretation |
| `lab_result_values` | Individual test values with reference ranges |
| `lab_result_files` | Uploaded result files (PDF, images) |

### Diagnostics Tables
| Table | Description |
|------|-------------|
| `diagnostics_cases` | Diagnostic case management |
| `clinical_notes` | Clinical notes (progress, assessment, plan) |
| `imaging_results` | Imaging results (X-ray, CT, MRI, ultrasound) |
| `medical_history_forms` | Structured medical history with AI analysis |

## Modules

### Patient Module (No AI)
- Patient Dashboard (neon tiles)
- Analysis Results page
- Diagnostics page
- Case File page
- Case History Timeline
- Prescriptions page
- Doctor Directory
- Doctor Rating/Comment modal
- Appointment Booking form
- Follow-up Booking modal
- Consultation Chat/Video screen

### Doctor Module (With AI)
- Doctor Dashboard (neon tiles)
- Booking Requests list
- Patient List (assigned only)
- Consultation Editor (with AI-assisted drafting)
- Chat Interface
- Lab Request form
- Diagnostics Request form
- Schedule Management calendar
- Admit/Discharge workflow
- Verification Badge display

### Lab Module
- Lab Dashboard
- User Directory (doctors/patients)
- Lab Orders list
- Lab Result Entry form
- Lab Result Upload page

## AI Pipeline (Kimi K3) — Doctor Only

The AI pipeline provides:
1. AI-assisted consultation drafting
2. AI-assisted risk factor highlighting
3. AI-assisted follow-up question suggestions
4. Lab result analysis with dual views (doctor + patient)
5. Medical history analysis

### Safety Constraints
- No diagnosis
- No prescriptions
- No emergency instructions
- All outputs clearly labeled as assistive only
- AI never writes to the medical record — all outputs require doctor approval

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and KIMI_API_KEY

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run development server
npm run dev
```

## Database Schema

The complete Prisma schema is in `prisma/schema.prisma`. The database is hosted on Neon (PostgreSQL).

### Neon Project
- Project: Medic1905 (nameless-cloud-06240692)
- Region: AWS ap-southeast-1
- PostgreSQL 18

## License

MIT
