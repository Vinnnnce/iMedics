# System Architecture

## 1. Text-Based Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐ │
│   │   Patient    │   │   Doctor     │   │    Lab       │   │   Admin    │ │
│   │    App       │   │    App       │   │  Scientist   │   │  Console   │ │
│   │              │   │              │   │    App       │   │            │ │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └─────┬──────┘ │
│          │                  │                  │                 │         │
│   React Native + React Native Web (unified codebase)                   │
│   - React Navigation (role-based root navigator)                       │
│   - EncryptedStorage / Keychain (mobile) / HttpOnly cookies (web)      │
│   - WebRTC SDK for video consults                                      │
└──────────┬──────────────────┬──────────────────┬──────────────────┬────────┘
           │                  │                  │                  │
           │    HTTPS / WSS   │                  │                  │
           ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / LOAD BALANCER                          │
│                     (NGINX or AWS ALB + TLS termination)                     │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Node.js / NestJS)                           │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Auth Module          │  RBAC Guard     │  Rate Limiter              │  │
│   │  - JWT access (15m)   │  - PATIENT       │  - Per-IP + per-user      │  │
│   │  - Refresh (7d)       │  - DOCTOR        │  - AI endpoints throttled │  │
│   │  - Redis blacklist    │  - LAB_SCIENTIST │                            │  │
│   │                       │  - ADMIN         │                            │  │
│   └──────────────────────┴──────────────────┴────────────────────────────┘  │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐ │
│   │  Appointments   │  │  Lab Workflow   │  │      AI Gateway            │ │
│   │  Module         │  │  Module         │  │                            │ │
│   │                 │  │                 │  │  - Validates payload       │ │
│   │  - Book slot    │  │  - Create order │  │  - Calls Python service    │ │
│   │  - Reschedule   │  │  - Upload file  │  │  - Stores AI output        │ │
│   │  - Cancel       │  │  - Enter result │  │  - Returns dual views      │ │
│   │  - Video token  │  │  - Verify       │  │    (doctor + patient)      │ │
│   │  - Chat history │  │  - QC flags     │  │                            │ │
│   └────────┬────────┘  └───────┬─────────┘  └───────────┬────────────────┘ │
│            │                   │                        │                  │
│            │           ┌───────┴────────┐               │                  │
│            │           │  File Storage  │               │                  │
│            │           │  (S3 / MinIO)  │               │                  │
│            │           └────────────────┘               │                  │
│            │                                              │                  │
│            ▼                                              ▼                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    PostgreSQL (Primary DB)                          │   │
│   │  users | roles | appointments | lab_orders | lab_results |          │   │
│   │  ai_analyses | audit_logs | prescriptions | chat_messages         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Redis (Cache + Queue + Blacklist)               │   │
│   │  - Refresh token blacklist | Rate limiting | BullMQ job queues    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               │  Internal HTTP (mTLS / VPC private)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   AI MICROSERVICE (Python / FastAPI)                         │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      ANALYSIS PIPELINE                               │  │
│   │                                                                       │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────┐ │  │
│   │  │ 1. Ingest & │──▶│ 2. Rule     │──▶│ 3. Context   │──▶│ 4. RAG  │ │  │
│   │  │ Normalize   │   │ Engine      │   │ Builder      │   │ Retriev │ │  │
│   │  │             │   │             │   │              │   │         │ │  │
│   │  │ - OCR parse │   │ - Range chk │   │ - Compact    │   │ - Embed │ │  │
│   │  │ - LOINC map │   │ - Critical  │   │   JSON ctx   │   │   query │ │  │
│   │  │ - Unit conv │   │   thresholds│   │ - History    │   │ - Top-k │ │  │
│   │  │ - Validate  │   │ - Trend ana │   │   merge      │   │   docs  │ │  │
│   │  └─────────────┘   └─────────────┘   └──────────────┘   └────┬────┘ │  │
│   │                                                            │       │  │
│   │  ┌─────────────────┐   ┌──────────────────┐   ┌────────────┴────┐  │  │
│   │  │ 6. Safety       │◀──│ 5. LLM Generate  │◀──│ Prompt Templates│  │  │
│   │  │    Filters      │   │   (Doctor +      │   │ (Doctor / Patient│  │  │
│   │  │                 │   │    Patient)      │   │  system prompts) │  │  │
│   │  │ - Pre-LLM chk  │   │                 │   └──────────────────┘  │  │
│   │  │ - Post-LLM cls │   │                 │                         │  │
│   │  │ - Block/rewrite│   │                 │                         │  │
│   │  │ - Audit log    │   │                 │                         │  │
│   │  └───────┬───────┘   └─────────────────┘                         │  │
│   │          │                                                       │  │
│   │  ┌───────▼──────────────────────────────────────────────────────┐│  │
│   │  │  7. Uncertainty & Escalation                                  ││  │
│   │  │  - Confidence proxy (ensemble, rule-LLM consistency)        ││  │
│   │  │  - Critical flag → doctor gets "urgent"                       ││  │
│   │  │  - Low confidence → shorter output, auto-notify doctor       ││  │
│   │  └──────────────────────────────────────────────────────────────┘│  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│   │  Vector DB       │   │  LLM Provider    │   │  Knowledge Base  │   │
│   │  (pgvector /     │   │  (OpenAI /       │   │  (Curated medical│   │
│   │   Qdrant)         │   │   Azure OpenAI / │   │   guidelines,    │   │
│   │                  │   │   self-hosted)   │   │   textbooks)     │   │
│   └──────────────────┘   └──────────────────┘   └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        REALTIME LAYER                                        │
│                                                                              │
│   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│   │  WebRTC Provider │   │  WebSocket Server │   │  Push Notifications   │  │
│   │  (LiveKit /      │   │  (Socket.io /     │   │  (FCM / APNs)         │  │
│   │   Daily / Twilio)│   │   NestJS Gateway) │   │                        │  │
│   │                  │   │                   │   │  - New lab results     │  │
│   │  - Video consult │   │  - In-call chat   │   │  - Appointment remind  │  │
│   │  - Screen share  │   │  - Presence       │   │  - AI analysis ready   │  │
│   │  - Live vitals   │   │  - Typing ind.    │   │  - Critical flag alert │  │
│   └─────────────────┘   └──────────────────┘   └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY & OPS                                   │
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │ Prometheus   │  │   Grafana    │  │    Sentry    │  │  ELK Stack   │  │
│   │  (metrics)   │  │  (dashboards)│  │  (errors)    │  │  (audit logs)│  │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Layer Descriptions

### Client Layer
- **Unified codebase**: React Native + React Native Web share 95% of code.
- **Role-based navigation**: Root navigator checks `user.role` and routes to the appropriate stack.
- **Token storage**: Mobile uses `react-native-keychain` (EncryptedStorage); web uses HttpOnly cookies set by the backend.
- **WebRTC**: LiveKit SDK for video consults with fallback to Daily/Twilio.

### Backend Layer (NestJS)
- **Auth**: JWT access tokens (15 min TTL) + refresh tokens (7 days), with Redis-based token blacklisting for logout.
- **RBAC**: Custom `@Roles()` decorator + `RolesGuard` enforces role-based access on every endpoint.
- **Lab workflow**: Handles order creation, result upload (structured JSON + file), verification by lab scientists, and AI analysis orchestration.
- **AI Gateway**: Validates payloads, calls the Python AI service via internal HTTP, stores results, and returns dual views (doctor + patient).

### AI Microservice (FastAPI)
- **Pipeline**: 7-stage analysis pipeline from ingestion to safety-filtered output.
- **RAG**: pgvector or Qdrant for embedding search over curated medical knowledge base.
- **LLM**: Pluggable provider (OpenAI, Azure OpenAI, or self-hosted via vLLM).
- **Safety**: Pre-LLM input validation + post-LLM content classifier with block/rewrite rules.

### Data Layer
- **PostgreSQL**: Primary database for all structured data. Uses `pgvector` extension for AI embeddings.
- **S3 / MinIO**: File storage for lab result PDFs, images, and medical documents.
- **Redis**: Caching, rate limiting, refresh token blacklist, and BullMQ job queues for async AI processing.

### Realtime Layer
- **WebRTC**: LiveKit for video consults with screen sharing and live vitals integration.
- **WebSocket**: NestJS WebSocket Gateway for in-call chat, presence, and typing indicators.
- **Push Notifications**: FCM (Android) and APNs (iOS) for appointment reminders, lab result notifications, and critical flag alerts.

## 3. Data Flow: Lab Result Upload → AI Analysis

```
Patient/Doctor          Backend (NestJS)         AI Service (FastAPI)
     │                        │                          │
     │  POST /labs/:id/results │                          │
     │ ──────────────────────▶ │                          │
     │                        │                          │
     │                        │  Store raw data in DB    │
     │                        │  Upload file to S3       │
     │                        │                          │
     │                        │  Build AI payload         │
     │                        │  (patient ctx + values)   │
     │                        │                          │
     │                        │  POST /ai/lab/analyse     │
     │                        │ ────────────────────────▶ │
     │                        │                          │
     │                        │              ┌───────────┤
     │                        │              │ Normalize │
     │                        │              │ Rule Eng. │
     │                        │              │ RAG       │
     │                        │              │ LLM       │
     │                        │              │ Safety    │
     │                        │              └───────────┤
     │                        │                          │
     │                        │  200 OK (AI result)      │
     │                        │ ◀──────────────────────── │
     │                        │                          │
     │                        │  Store AI output in DB   │
     │                        │  Emit WebSocket event    │
     │                        │                          │
     │  201 Created            │                          │
     │ ◀────────────────────── │                          │
     │  {result + ai_analysis} │                          │
     │                        │                          │
```

## 4. Security Boundaries

```
┌─────────────────────────────────────────────────────┐
│                  PUBLIC INTERNET                     │
│                    (0.0.0.0/0)                       │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │            API GATEWAY (TLS)                  │  │
│  │         HTTPS only, HSTS enabled              │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │                               │
├─────────────────────┼───────────────────────────────┤
│           PRIVATE VPC (10.0.0.0/16)                  │
│                     │                               │
│  ┌──────────────────▼────────────────────────────┐  │
│  │         Backend (NestJS) :3000                │  │
│  │  - JWT verification on every request          │  │
│  │  - RBAC guard on protected routes             │  │
│  │  - Rate limiting (Redis)                      │  │
│  │  - Audit logging for PHI access               │  │
│  └──────┬───────────────┬────────────────────────┘  │
│         │               │                           │
│  ┌──────▼──────┐  ┌────▼──────────────────────┐     │
│  │ PostgreSQL  │  │    AI Service :8000       │     │
│  │  :5432      │  │  - mTLS to backend        │     │
│  │  + pgvector │  │  - No public access       │     │
│  └─────────────┘  └───────────────────────────┘     │
│         │               │                           │
│  ┌──────▼──────┐  ┌────▼─────┐  ┌──────────────┐   │
│  │   Redis     │  │   S3     │  │  Vector DB   │   │
│  │   :6379     │  │  (MinIO) │  │  (pgvector)  │   │
│  └─────────────┘  └──────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────┤
│              OBSERVABILITY (Internal)                │
│  Prometheus :9090 │ Grafana :3001 │ Sentry (SaaS)   │
└─────────────────────────────────────────────────────┘
```
