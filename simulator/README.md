# Medic1905 — Virtual Teaching Hospital & Medical Simulation Platform

An advanced, AI-powered virtual hospital, clinical training and medical simulation ecosystem. Medic1905 simulates the operational and clinical environment of a real healthcare establishment — the **Medic1905 Republic**, a virtual nation of **36 regions and 72 cities** with 136 hospitals ranging from frontier rural clinics to flagship teaching hospitals.

> **SIMULATED ENVIRONMENT — ALL PATIENTS ARE SYNTHETIC. FOR MEDICAL EDUCATION ONLY. NOT CLINICAL DECISION SUPPORT.**
> Scores are learning feedback, not qualifications, licences or certifications.

## What's inside

- **Virtual hospital network** — 39 departments across 136 hospitals in 36 regions; every hospital has its own departments, tier and capabilities.
- **AI patient engine (hybrid architecture)** — a deterministic, clinically validated engine controls physiology, progression and outcomes; a natural-language layer shapes conversations. Patients reveal symptoms according to your questions, never expose their hidden diagnosis, and display pain, anxiety and confusion. Generative AI never invents vital signs, lab values, diagnoses or outcomes.
- **Clinical case library** — 8 fully authored cases across undergraduate → specialist levels: STEMI, appendicitis, acute severe asthma, DKA, paediatric meningitis, severe pre-eclampsia/HELLP, CAP with sepsis, upper GI bleed. Each case has a hidden diagnosis, phase-linked vitals/labs/imaging, progression rules, complications and a full debrief.
- **Laboratory & diagnostic simulation** — 51 lab tests and 20 imaging modalities with turnaround times, critical-value alerts and phase-linked results.
- **Pharmacy safety engine** — 59-drug formulary with allergy cross-reactivity, drug–drug interactions, contraindications, renal dosing notes and high-alert flags. Blocked prescriptions are never administered.
- **Live patient monitor** — NEWS2 scoring, phase progression, complications (including shockable VF arrest requiring defibrillation) and time-based deterioration.
- **Equipment simulators** — animated ECG rhythm trainer, defibrillator decision trainer, infusion pump calculator, patient monitor reference.
- **Interactive anatomy explorer** — 11 body systems with clinical correlations, prepared for future WebGL/WebXR 3D integration.
- **Assessment engine** — nine scored dimensions (history, examination, investigations, diagnosis, management, safety, communication, documentation, timeliness) with a structured debrief, missed-management analysis and learning points.
- **Instructor console** — live monitoring of learner encounters, pause/resume, complication injection, case authoring/duplication/publishing.
- **Master administration** — users and roles, platform statistics, full audit log.
- **Role-based dashboards** — 12 roles from medical student to platform administrator.

## Quick start

```bash
npm install
npm run seed     # builds the Republic: 36 regions, hospitals, formulary, cases, demo users
npm start        # http://localhost:3000
```

### Demo accounts (password: `medic1905`)

| Role | Email |
|---|---|
| Medical Student | student@medic1905.sim |
| Intern | intern@medic1905.sim |
| Resident | resident@medic1905.sim |
| Nurse | nurse@medic1905.sim |
| Pharmacist | pharmacist@medic1905.sim |
| Surgeon | surgeon@medic1905.sim |
| Radiologist | radiologist@medic1905.sim |
| Lab Scientist | lab@medic1905.sim |
| Clinical Instructor | instructor@medic1905.sim |
| Administrator | admin@medic1905.sim |

## Architecture

```
server/
├── index.js               # Express app — API + static client
├── db/                    # SQLite schema + seeder (no external DB required)
├── engines/
│   ├── physiology.js      # deterministic vitals, phases, complications, NEWS2
│   ├── conversation.js    # hybrid AI patient interview layer
│   ├── safety.js          # pharmacy checks (allergy/interaction/renal)
│   └── scoring.js         # rubric scoring + debrief generation
├── data/
│   ├── country.js         # the Medic1905 Republic — 36 regions, 72 cities
│   ├── departments.js     # 39 departments + hospital tier mapping
│   ├── drugs.js           # 59-drug formulary with safety data
│   ├── catalog.js         # 51 lab tests + 20 imaging modalities
│   └── cases1/2.js        # the clinical case library
└── routes/                # auth, country/cases, runs, admin

client/                    # zero-build SPA (vanilla JS, hash routing)
├── index.html
└── assets/{css,js}        # design system + pages
```

See `docs/ARCHITECTURE.md` for the full technical design, `docs/IMPLEMENTATION_PLAN.md` for the phased roadmap, and `docs/CLINICAL_SAFETY.md` for the simulation safety framework.

## Case scenario schema (instructor authoring)

Cases are JSON documents: interview script with intent matching, examination findings per system, baseline vitals + phase-linked labs/imaging, hidden diagnosis with aliases and expected differentials, management targets with time windows, phase machine with stabilization/timeout transitions, complications with triggers, nine-dimension rubric, and a debrief with learning points and references. Duplicate any existing case via the Instructor Console and edit the JSON — see `docs/ARCHITECTURE.md`.

## Safety principles

1. Permanent simulation labelling on every screen; synthetic patients only.
2. Deterministic engine — never generative AI — controls all clinical state.
3. No connection to real prescribing, dispensing, surgical devices or clinical systems.
4. Full audit logging of every sensitive action.
5. Instructor overrides and reproducible scenarios.
6. Educational AI is explicitly separated from clinical decision support.

## License

MIT — see LICENSE.
