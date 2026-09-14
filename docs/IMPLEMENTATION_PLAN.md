# Implementation Plan

## Milestones

### MVP (Weeks 1–6)

| Week | Focus | Deliverables |
|---|---|---|
| 1–2 | Project setup & auth | Monorepo scaffold (app, backend, ai_service). NestJS auth module with JWT + refresh tokens. RBAC guard. React Native + Web bootstrap with role-based navigation. Beeline-style theme system. |
| 2–3 | User management | Patient onboarding (KYC, medical history, insurance). Doctor profiles (specialty, schedule, fees). Lab scientist accounts. PostgreSQL schema + migrations. S3 file storage integration. |
| 3–4 | Teleconsult workflow | Appointment booking, scheduling, status management. LiveKit video integration. In-call WebSocket chat. Push notifications (FCM/APNs). |
| 4–5 | Lab workflow | Lab order creation (doctor/scientist). Result upload (structured JSON + file). Result verification (lab scientist double-check). Lab results list + detail screens. |
| 5–6 | AI service (MVP) | FastAPI scaffold. Lab result normalization (LOINC mapping, unit conversion). Rule-based flagging engine (ranges, critical thresholds, trends). Pre-LLM safety filters. Basic LLM integration with doctor + patient prompt templates. Post-LLM safety filters. Backend AI gateway integration. |

**MVP Definition of Done:**
- Patients can book video consults with doctors.
- Patients/Doctors can upload lab results.
- AI service produces doctor + patient views with safety filtering.
- All roles can log in and navigate their role-specific screens.
- Audit logs record all PHI access.

---

### Phase 2 — Advanced AI & Polish (Weeks 7–12)

| Week | Focus | Deliverables |
|---|---|---|
| 7–8 | RAG implementation | Curated medical knowledge base (guidelines, textbook excerpts). Embedding pipeline (text → vectors). pgvector or Qdrant integration. Top-k retrieval by panel type and flags. Retrieved evidence injected into LLM prompts. |
| 8–9 | Trend analysis & uncertainty | Historical result comparison (improving/worsening/stable). Confidence scoring (rule-LLM consistency, ensemble agreement). Auto-escalation for critical flags or low confidence. Doctor notification system for urgent results. |
| 9–10 | Multilingual support | Language detection from app locale. Multilingual LLM generation with explicit LANGUAGE parameter. Localized UI copy, safety disclaimers, and "talk to your doctor" messages. Reference ranges stored language-agnostic, labels rendered per locale. |
| 10–11 | Doctor AI assistant | AI-drafted clinical notes (editable, doctor-approved). Abnormal value highlighting in consult room. Follow-up suggestion panel. AI QC overview for lab scientists (outlier detection, panel consistency, missing test checks). |
| 11–12 | Production hardening | Docker Compose for local dev. CI/CD pipelines (GitHub Actions). Prometheus metrics + Grafana dashboards. Sentry error tracking. Audit log ELK stack. Load testing. Security audit (OWASP Top 10). |

---

### Phase 3 — Scale & Compliance (Weeks 13–18)

| Week | Focus | Deliverables |
|---|---|---|
| 13–14 | Compliance & security | GDPR/HIPAA compliance review. Data encryption at rest (PostgreSQL TDE, S3 SSE-KMS). BAA with subprocessors. Privacy policy + consent flows. Data retention policies. Right to erasure implementation. |
| 14–15 | Scalability | Horizontal scaling (NestJS + FastAPI behind ALB). Read replicas for PostgreSQL. Redis cluster. S3 lifecycle policies. CDN for static assets. Database query optimization. |
| 15–16 | Advanced features | Care timeline (visits, prescriptions, tests in one view). E-prescriptions (where legally permitted). Insurance integration. Live vitals integration (wearable APIs). AI chat assistant for patient questions about results. |
| 16–18 | Beta & launch | Closed beta with 50+ patients and 10+ doctors. Feedback collection and iteration. App store / Play Store submission. RuStore submission (primary market). Production deployment. Monitoring runbook. Incident response procedures. |

---

## Technology Choices

### Frontend (React Native + Web)

| Concern | Library | Rationale |
|---|---|---|
| Framework | React Native 0.74+ + React Native Web | Unified mobile + web codebase |
| Navigation | React Navigation 6 (Native Stack + Bottom Tabs) | Role-based root navigator, mature ecosystem |
| State management | Zustand | Lightweight, no boilerplate, works on web |
| Data fetching | TanStack Query (React Query) | Caching, background refetch, optimistic updates |
| Forms | react-hook-form + Zod | Type-safe validation, works on web |
| Secure storage | react-native-keychain (mobile) / HttpOnly cookies (web) | Platform-appropriate token storage |
| WebRTC | LiveKit React SDK | Video consults, screen share, built-in fallback |
| Styling | StyleSheet + custom theme tokens | Beeline-style design system, no heavy CSS-in-JS overhead |
| Icons | react-native-vector-icons | Consistent icon set across platforms |
| PDF viewer | react-native-pdf | View original lab reports |
| i18n | react-i18next | Multilingual support (en, fr, ru, es) |

### Backend (NestJS)

| Concern | Library | Rationale |
|---|---|---|
| Framework | NestJS 10 | Modular architecture, decorators, guards, interceptors |
| ORM | Prisma | Type-safe queries, migrations, excellent DX |
| Auth | @nestjs/jwt + passport-jwt | JWT access + refresh tokens |
| Validation | class-validator + class-transformer | DTO validation, whitelist, transform |
| Queue | BullMQ (Redis-backed) | Async AI processing, retries, scheduling |
| WebSocket | @nestjs/websockets + socket.io | In-call chat, presence, real-time notifications |
| File upload | Multer + S3 SDK | Multipart handling, direct S3 upload |
| Rate limiting | @nestjs/throttler | Per-IP and per-user rate limiting |
| Testing | Jest + supertest | Unit + integration tests |

### AI Microservice (Python FastAPI)

| Concern | Library | Rationale |
|---|---|---|
| Framework | FastAPI | Async, OpenAPI docs, Pydantic validation |
| LLM SDK | OpenAI Python SDK (or LangChain for RAG) | Pluggable provider, streaming support |
| Embeddings | sentence-transformers or OpenAI embeddings | Medical knowledge base indexing |
| Vector DB | pgvector (PostgreSQL extension) | Reuse existing PostgreSQL, no separate infra |
| OCR | Tesseract (via pytesseract) or AWS Textract | Lab PDF/image parsing |
| Medical codes | python-loinc mapping | LOINC standardization |
| Safety | Custom rule engine + regex patterns + lightweight classifier | Pre/post LLM filtering |
| Testing | pytest + httpx | Async API testing |

### Infrastructure

| Concern | Service | Rationale |
|---|---|---|
| Container runtime | Docker + Docker Compose | Local dev + CI consistency |
| CI/CD | GitHub Actions | Automated test, build, deploy |
| Hosting | AWS (ECS Fargate) or Hetzner Cloud | EU data residency (GDPR) |
| Database | PostgreSQL 16 (RDS or managed) | Structured data + pgvector |
| Cache/Queue | Redis 7 (ElastiCache or managed) | Token blacklist, rate limiting, BullMQ |
| File storage | S3 or MinIO | Lab PDFs, images, medical documents |
| Monitoring | Prometheus + Grafana | Metrics dashboards |
| Error tracking | Sentry | Frontend + backend error tracking |
| Logging | ELK Stack (Elasticsearch, Logstash, Kibana) | Audit log analysis |
| CDN | CloudFront or Cloudflare | Static assets, web app delivery |
| Push notifications | FCM (Android) + APNs (iOS) | Appointment reminders, critical alerts |

---

## Risk Areas & Mitigations

### 1. AI Safety — Incorrect or Dangerous Output

**Risk:** LLM generates a definitive diagnosis, prescribes medication, or gives emergency advice that could harm a patient.

**Mitigations:**
- **Pre-LLM input validation**: Reject impossible values (negative counts, absurd ranges). Mark unknown units as "uninterpretable". Skip LLM for unsupported panel types.
- **Post-LLM safety classifier**: Tag generated text as `DIAGNOSIS`, `TREATMENT`, `EMERGENCY_ADVICE`, or `SAFE_EXPLANATION`. Block or rewrite unsafe content using regex patterns + lightweight classifier.
- **Blocked phrase patterns**: "You have [disease]", "Start taking [drug]", "Take [dose] mg", "Do not go to the hospital" — auto-replaced with safe fallback message.
- **Audit logging**: Every safety filter trigger is logged with original text, action taken, and reason.
- **Human-in-the-loop**: Critical flags auto-route to doctor. Low confidence reduces patient explanation length and emphasizes limitations.
- **Prompt design**: System prompt explicitly prohibits diagnosis, prescribing, and treatment plans. Doctor and patient prompts are role-specific with strict constraints.
- **No autonomous action**: AI never writes to the medical record. All AI outputs are advisory and require doctor approval before becoming part of the patient's record.

### 2. Data Privacy & Compliance (GDPR/HIPAA)

**Risk:** PHI exposure through insecure storage, unauthorized access, or data breaches.

**Mitigations:**
- **Encryption at rest**: PostgreSQL with TDE, S3 with SSE-KMS.
- **Encryption in transit**: HTTPS everywhere, mTLS between backend and AI service.
- **Audit logs**: Every access to medical data is logged (who, what, when, why).
- **RBAC enforcement**: Role-based access on every API endpoint. Patients can only access their own data.
- **Token security**: Short-lived access tokens (15 min), refresh token rotation, Redis blacklist for logout.
- **Data retention policies**: Configurable retention periods, right to erasure implementation.
- **EU data residency**: All data stored in EU regions (Frankfurt) for GDPR compliance.
- **BAAs**: Business Associate Agreements with all subprocessors handling PHI.

### 3. LLM Reliability & Hallucination

**Risk:** LLM fabricates medical information or generates inconsistent explanations.

**Mitigations:**
- **RAG grounding**: All LLM outputs are grounded in retrieved medical knowledge base snippets. Prompts include "use only the provided evidence" instructions.
- **Rule-LLM consistency check**: Compare rule engine output with LLM output. If they disagree, flag as low confidence and escalate to doctor.
- **Confidence scoring**: Combine rule severity, model confidence proxies (log-prob, ensemble agreement), and rule-LLM consistency into a confidence score.
- **Structured output**: LLM outputs JSON with defined fields (summary, suggested_followup, urgency_level, limitations) — not free text.
- **Fallback**: If LLM fails or times out, return rule engine output only with "AI explanation unavailable" message.

### 4. Realtime Video Quality

**Risk:** Poor video quality during teleconsults leads to bad patient experience.

**Mitigations:**
- **LiveKit**: Built-in adaptive bitrate, simulcast, and TURN/STUN servers.
- **Fallback**: If video fails, automatic fallback to audio-only call.
- **Pre-call check**: Network quality test before joining consult room.
- **Reconnection**: Auto-reconnect on network drop with 3-second timeout.

### 5. Scalability Under Load

**Risk:** System buckles under concurrent video consults + AI processing.

**Mitigations:**
- **Async AI processing**: Lab result analysis runs via BullMQ queue, not blocking the API response.
- **Horizontal scaling**: NestJS and FastAPI are stateless and scale horizontally behind ALB.
- **Read replicas**: PostgreSQL read replicas for lab results list queries.
- **Rate limiting**: Per-user and per-IP rate limiting, especially on AI endpoints.
- **Caching**: Redis cache for frequently accessed data (doctor schedules, reference ranges).

### 6. OCR Accuracy for Lab PDFs

**Risk:** OCR misreads values from scanned lab reports, leading to incorrect AI analysis.

**Mitigations:**
- **Structured input preferred**: Encourage direct structured JSON entry by lab scientists when possible.
- **OCR confidence scoring**: Flag low-confidence OCR results for manual verification.
- **Validation layer**: Pre-LLM filter catches impossible values (negative counts, absurd ranges) that indicate OCR errors.
- **Multi-engine OCR**: Option to use AWS Textract for complex layouts, Tesseract for simple ones.
- **Human verification**: Lab scientist can review and correct OCR-extracted values before AI analysis runs.

### 7. Multilingual Quality

**Risk:** AI explanations in non-English languages may be lower quality or contain translation errors.

**Mitigations:**
- **Native LLM generation**: Generate directly in the target language using a multilingual LLM with explicit LANGUAGE parameter, rather than translating English output.
- **Localized safety patterns**: Safety filter regex patterns for all supported languages (diagnosis/treatment detection in en, fr, ru, es).
- **Reference range labels**: Stored language-agnostic, rendered per locale in the UI.
- **Fallback to English**: If generation in target language fails, fall back to English with a "translation in progress" notice.

---

## Team Structure (Suggested)

| Role | Count | Responsibilities |
|---|---|---|
| Tech Lead / Architect | 1 | Architecture decisions, code review, AI safety oversight |
| React Native Engineer | 2 | Client app, screens, navigation, WebRTC |
| Backend Engineer | 1 | NestJS API, auth, RBAC, workflows, queues |
| AI/ML Engineer | 1 | FastAPI pipeline, RAG, LLM prompts, safety filters |
| DevOps Engineer | 0.5 | Docker, CI/CD, monitoring, deployment |
| UI/UX Designer | 0.5 | Beeline-style design system, screen mockups |
| Medical Advisor | 0.25 | Clinical accuracy review, knowledge base curation, safety validation |
| QA Engineer | 0.5 | Test plans, automated testing, compliance testing |

**Total: ~6.25 FTE**
