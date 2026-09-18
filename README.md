# iMedics — AI-Powered Telemedicine Platform

A production-ready telemedicine platform for **Patients**, **Doctors**, and **Lab Scientists**, built with React Native (mobile + web), NestJS backend, and a Python FastAPI AI microservice.

## Quick Links

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System architecture diagram, layers, data flow |
| [API Contracts](docs/API_CONTRACTS.md) | Detailed API specs for `/labs/:patientId/results` and `/ai/lab/analyse` |
| [Screen Flows](docs/SCREEN_FLOWS.md) | React Native screen flow descriptions for patient and doctor journeys |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Milestones, tech choices, risk areas, and AI safety mitigations |
| [Patient History Module](docs/PATIENT_HISTORY_MODULE.md) | Patient ID, medical history data model, AI-driven history analysis |

## Project Structure

```
iMedics/
├── app/                    # React Native + React Native Web client
│   ├── src/
│   │   ├── navigation/     # Root, auth, role-based navigators
│   │   ├── screens/        # Role-specific screens
│   │   ├── components/      # Shared UI components (Beeline-style)
│   │   ├── theme/           # Design tokens, colors, typography
│   │   ├── hooks/           # Custom hooks (auth, api, telemed)
│   │   └── services/        # API client, WebSocket, WebRTC
│   ├── index.web.tsx
│   └── index.native.tsx
├── web/                    # Next.js web app (Patient History Module)
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components (forms, AI panel)
│   └── lib/                # Prisma client, validations, utils
├── backend/                # NestJS API server
│   ├── src/
│   │   ├── auth/           # JWT auth, RBAC, refresh tokens
│   │   ├── appointments/    # Teleconsult workflows
│   │   ├── labs/            # Lab orders, results, file uploads
│   │   ├── ai/             # AI gateway to Python service
│   │   ├── patient-history/ # Patient ID + medical history module
│   │   ├── users/           # User management, KYC
│   │   └── common/          # Guards, interceptors, filters
│   └── test/
├── ai_service/             # Python FastAPI AI microservice
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── routers/         # Lab analysis, health check, history analysis
│   │   ├── pipeline/        # Normalization, rule engine, RAG, LLM, safety
│   │   ├── prompts/         # Doctor, patient & history prompt templates
│   │   ├── models/          # Pydantic schemas (lab + history)
│   │   └── config.py        # Configuration, env vars
│   ├── knowledge_base/      # Curated medical documents for RAG
│   └── tests/
├── infra/                   # Docker, docker-compose, CI/CD
├── docs/                    # Design documents
├── vercel.json              # Vercel deployment config
└── README.md
```

## Key Design Principles

1. **AI Safety First** — No autonomous diagnosis or prescribing. Every AI output passes through pre-LLM and post-LLM safety filters. Critical flags auto-escalate to doctors.
2. **Role-Based Access** — Strict RBAC across client navigation, API endpoints, and AI service calls.
3. **Beeline-Inspired UX** — Bold, card-based home screens with large rounded tiles, strong accent colors, soft shadows, and clear microcopy.
4. **Multilingual** — English, French, Russian, Spanish with locale-aware AI explanations.
5. **Unified Codebase** — React Native + React Native Web for a single codebase across mobile and web.
6. **Patient History Module** — Structured patient identification with auto-BMI calculation, comprehensive medical history capture with multi-symptom support, and AI-driven history analysis with clinician summary, patient recap, guided questions, symptom clustering, risk factor highlighting, and timeline generation.

## Patient History Module

The Patient History Module provides AI-driven medical history taking and structuring:

- **Patient Identification**: Normalized schema with BMI auto-calculation, emergency contacts, and validation
- **Medical History**: Chief complaint, symptoms (with onset/worsening/relief/character), medications, wound/injury, chronic conditions (diabetes/stroke/heart attack), family history, past history, allergies, lifestyle, reproductive, mental health, immunizations
- **AI Pipeline**: Guided questioning, symptom clustering, timeline, risk factor highlighting, clinician summary (HPI format), patient-friendly recap
- **Safety**: All AI outputs are non-diagnostic, non-prescriptive, and require clinician review
- **Extensible**: Custom fields via `extensible_fields` table with JSONB values

See [docs/PATIENT_HISTORY_MODULE.md](docs/PATIENT_HISTORY_MODULE.md) for the full design documentation.

## Deployment

- **Database**: Neon Postgres (Prisma migrations)
- **Backend**: NestJS (Docker / Fly.io)
- **AI Service**: Python FastAPI (Docker)
- **Web Frontend**: Next.js on Vercel
- **Mobile**: React Native (Expo) on EAS
