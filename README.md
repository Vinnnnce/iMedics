# iMedics — AI-Powered Telemedicine Platform

A production-ready telemedicine platform for **Patients**, **Doctors**, and **Lab Scientists**, built with React Native (mobile + web), NestJS backend, and a Python FastAPI AI microservice.

## Quick Links

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System architecture diagram, layers, data flow |
| [API Contracts](docs/API_CONTRACTS.md) | Detailed API specs for `/labs/:patientId/results` and `/ai/lab/analyse` |
| [Screen Flows](docs/SCREEN_FLOWS.md) | React Native screen flow descriptions for patient and doctor journeys |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Milestones, tech choices, risk areas, and AI safety mitigations |

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
├── backend/                # NestJS API server
│   ├── src/
│   │   ├── auth/           # JWT auth, RBAC, refresh tokens
│   │   ├── appointments/    # Teleconsult workflows
│   │   ├── labs/            # Lab orders, results, file uploads
│   │   ├── ai/             # AI gateway to Python service
│   │   ├── users/           # User management, KYC
│   │   └── common/          # Guards, interceptors, filters
│   └── test/
├── ai_service/             # Python FastAPI AI microservice
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── routers/         # Lab analysis, health check
│   │   ├── pipeline/        # Normalization, rule engine, RAG, LLM, safety
│   │   ├── prompts/         # Doctor & patient prompt templates
│   │   ├── models/          # Pydantic schemas
│   │   └── config.py        # Configuration, env vars
│   ├── knowledge_base/      # Curated medical documents for RAG
│   └── tests/
├── infra/                   # Docker, docker-compose, CI/CD
├── docs/                    # Design documents
└── README.md
```

## Key Design Principles

1. **AI Safety First** — No autonomous diagnosis or prescribing. Every AI output passes through pre-LLM and post-LLM safety filters. Critical flags auto-escalate to doctors.
2. **Role-Based Access** — Strict RBAC across client navigation, API endpoints, and AI service calls.
3. **Beeline-Inspired UX** — Bold, card-based home screens with large rounded tiles, strong accent colors, soft shadows, and clear microcopy.
4. **Multilingual** — English, French, Russian, Spanish with locale-aware AI explanations.
5. **Unified Codebase** — React Native + React Native Web for a single codebase across mobile and web.
