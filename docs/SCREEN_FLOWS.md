# React Native Screen Flow Descriptions

## 1. Patient Journey: Home → Lab Results → AI Explanation

### Screen 1: Patient Home

```
┌─────────────────────────────────────────┐
│  Hi Sarah,                              │
│  manage your care, labs and            │
│  consultations in one place.            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🩺  Book a doctor              │   │
│  │  Choose a specialist and        │   │
│  │  schedule a video visit.         │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📋  Upload lab results          │   │
│  │  Let AI highlight what's         │   │
│  │  important before your doctor    │   │
│  │  reviews.               [→]      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🤖  AI health assistant         │   │
│  │  Ask questions about your        │   │
│  │  results and care plan.  [→]     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Recent Activity                        │
│  ┌─────────────────────────────────┐   │
│  │  📄 CBC Results — Sep 14        │   │
│  │  AI analysis ready              │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │  Home   │ Labs    │ Profile │       │
│  └─────────┴─────────┴─────────┘       │
└─────────────────────────────────────────┘
```

**Design specs:**
- Background: `#F5F6FA` (soft neutral)
- Cards: white, `borderRadius: 20`, `elevation: 3` (soft shadow)
- Accent color: `#6C5CE7` (purple — primary), with tile-specific accent colors:
  - Book doctor: `#0984E3` (blue)
  - Upload labs: `#00B894` (teal)
  - AI assistant: `#6C5CE7` (purple)
- Header text: `fontSize: 24`, `fontWeight: 700`, `color: #2D3436`
- Card titles: `fontSize: 18`, `fontWeight: 700`
- Card subtitles: `fontSize: 14`, `color: #636E72`, `lineHeight: 20`
- Card padding: 20px all sides
- Card spacing: 12px vertical gap
- Bottom tab bar: fixed, white background, active tab in accent color

**Navigation actions:**
- Tap "Book a doctor" → navigates to `DoctorList` screen
- Tap "Upload lab results" → navigates to `LabUpload` screen
- Tap "AI health assistant" → navigates to `AIAssistant` chat screen
- Tap "Recent Activity" item → navigates to `LabResultDetail` screen
- Bottom tab "Labs" → navigates to `LabResultsList` screen

---

### Screen 2: Lab Results List

```
┌─────────────────────────────────────────┐
│  ←  Your Lab Results                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📄 Complete Blood Count (CBC)  │   │
│  │  Sep 14, 2026 · CityLab         │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ 🤖 AI analysis ready     │   │   │
│  │  │ 2 values need attention  │   │   │
│  │  └──────────────────────────┘   │   │
│  │  Status: Reviewed by Dr. Klein  │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📄 Comprehensive Metabolic     │   │
│  │  Panel (CMP)                    │   │
│  │  Aug 28, 2026 · CityLab         │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ 🤖 AI analysis ready     │   │   │
│  │  │ All values in range      │   │   │
│  │  └──────────────────────────┘   │   │
│  │  Status: Reviewed by Dr. Klein  │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📄 Lipid Panel                 │   │
│  │  Aug 01, 2026 · CityLab         │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ ⚠️ 1 value needs attention│   │   │
│  │  └──────────────────────────┘   │   │
│  │  Status: Reviewed by Dr. Klein  │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  + Upload new lab results       │   │
│  │  Take a photo or select a file  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │  Home   │ Labs    │ Profile │       │
│  └─────────┴─────────┴─────────┘       │
└─────────────────────────────────────────┘
```

**Design specs:**
- Each result card shows: test name, date, lab name, AI status badge, doctor review status
- AI status badge colors:
  - "AI analysis ready" → green tinted background (`#E8F8F0`), green text (`#00B894`)
  - "X values need attention" → amber tinted background (`#FFF5E6`), amber text (`#FDCB6E`)
  - "Critical — contact doctor" → red tinted background (`#FFEAEA`), red text (`#E74C3C`)
- Upload card: dashed border, accent color, centered icon + text
- Pull-to-refresh reloads list from API

**Navigation actions:**
- Tap any result card → navigates to `LabResultDetail` with `resultId` param
- Tap upload card → navigates to `LabUpload` screen
- Pull to refresh → refetch `/labs/:patientId/results`

---

### Screen 3: Lab Result Detail with AI Explanation

```
┌─────────────────────────────────────────┐
│  ←  CBC Results — Sep 14                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🤖 AI Health Summary            │   │
│  │                                  │   │
│  │  Your Blood Test Results         │   │
│  │  in Brief                        │   │
│  │                                  │   │
│  │  Some of your blood test results │   │
│  │  are outside the usual range.    │   │
│  │  This doesn't automatically mean │   │
│  │  something is wrong, but it's    │   │
│  │  worth discussing with your      │   │
│  │  doctor.                         │   │
│  │                                  │   │
│  │  The good news is that your      │   │
│  │  hemoglobin levels have          │   │
│  │  improved since your last test.  │   │
│  │                                  │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ Questions you can ask    │    │   │
│  │  │ your doctor:             │    │   │
│  │  │ • Which results are most │    │   │
│  │  │   important to monitor?  │    │   │
│  │  │ • Should I repeat these  │    │   │
│  │  │   tests, and when?       │    │   │
│  │  │ • Are there lifestyle    │    │   │
│  │  │   changes to consider?   │    │   │
│  │  └──────────────────────────┘    │   │
│  │                                  │   │
│  │  ⚠️ AI is assistive, not a       │   │
│  │  medical decision-maker.         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Detailed Results                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Hemoglobin          9.8 ↓ LOW   │   │
│  │ Range: 12.0–16.0 g/dL           │   │
│  │ Trend: ↑ Improving (was 8.5)    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ White Blood Cells   11.2 ↑ HIGH │   │
│  │ Range: 4.5–11.0 ×10³/μL         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Platelets           245 ✓ NORMAL│   │
│  │ Range: 150–400 ×10³/μL          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📄 View original report (PDF)   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💬 Ask AI about these results    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │  Home   │ Labs    │ Profile │       │
│  └─────────┴─────────┴─────────┘       │
└─────────────────────────────────────────┘
```

**Design specs:**
- AI summary card: accent purple background tint (`#F3F0FF`), rounded 20px, padding 20px
- AI title: `fontSize: 18`, `fontWeight: 700`, `color: #6C5CE7`
- AI body text: `fontSize: 15`, `lineHeight: 22`, `color: #2D3436`
- Questions box: white background, `borderRadius: 12`, `padding: 16`, `borderWidth: 1`, `borderColor: #DFE4EA`
- Safety disclaimer: `fontSize: 12`, `color: #B2BEC3`, italic
- Result cards: white, per-value flag colors:
  - LOW: `#E74C3C` text + `↓` arrow
  - HIGH: `#E67E22` text + `↑` arrow
  - NORMAL: `#00B894` text + `✓` checkmark
- Trend indicator: green text for improving, red for worsening
- "Ask AI" card: accent color, navigates to AI chat with result context preloaded

**Navigation actions:**
- Back button → returns to `LabResultsList`
- Tap "View original report" → opens PDF viewer (`react-native-pdf`)
- Tap "Ask AI about these results" → navigates to `AIAssistantChat` with `resultId` as context

---

## 2. Doctor Journey: Home → Today's Consult → Lab Panel + AI Summary

### Screen 1: Doctor Home

```
┌─────────────────────────────────────────┐
│  Dr. Michael Klein                      │
│  Today's schedule at a glance.          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📅 Today's Schedule             │   │
│  │  3 upcoming · 1 in progress      │   │
│  │                                  │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ 09:30 — Sarah Johnson     │    │   │
│  │  │ Follow-up · CBC review   │    │   │
│  │  │ ● In progress        [→]  │    │   │
│  │  └──────────────────────────┘    │   │
│  │                                  │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ 10:30 — James Wilson      │    │   │
│  │  │ New patient · General     │    │   │
│  │  │ ○ Upcoming           [→]  │    │   │
│  │  └──────────────────────────┘    │   │
│  │                                  │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ 11:15 — Maria Garcia     │    │   │
│  │  │ Lab results review       │    │   │
│  │  │ ○ Upcoming           [→]  │    │   │
│  │  └──────────────────────────┘    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🤖 AI Summary of Recent Labs    │   │
│  │  5 patients have new results    │   │
│  │  2 flagged for urgent review     │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📋 Pending Lab Orders          │   │
│  │  3 orders awaiting results      │   │
│  │                          [→]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │  Home   │ Patients│ Profile │       │
│  └─────────┴─────────┴─────────┘       │
└─────────────────────────────────────────┘
```

**Design specs:**
- Header: doctor name + subtitle
- Schedule card: largest, white background, shows today's appointments
- Appointment items: status indicators (● in progress = green, ○ upcoming = gray)
- AI summary card: purple accent tint, shows count of patients with new results and urgent flags
- Pending orders card: amber accent tint
- Bottom tab bar: Home, Patients, Profile

---

### Screen 2: Consult Room

```
┌─────────────────────────────────────────┐
│  ←  Consult: Sarah Johnson              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │      [Video Feed — Patient]     │   │
│  │                                 │   │
│  │  ┌─────────┐  ┌─────────┐      │   │
│  │  │ Mute 🔇 │  │ Video 📹│      │   │
│  │  └─────────┘  └─────────┘      │   │
│  │  ┌─────────┐  ┌─────────┐      │   │
│  │  │ Share 📺│  │ End  📞 │      │   │
│  │  └─────────┘  └─────────┘      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Tabs: Labs │ Notes │ Chat │ Rx  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📄 CBC — Sep 14, 2026         │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ 🤖 AI Clinical Summary    │   │   │
│  │  │                          │   │   │
│  │  │ • HGB 9.8 (LOW) —         │   │   │
│  │  │   improving from 8.5      │   │   │
│  │  │ • WBC 11.2 (HIGH) — mild  │   │   │
│  │  │ • PLT 245 (NORMAL)        │   │   │
│  │  │                          │   │   │
│  │  │ Suggested follow-up:       │   │   │
│  │  │ • Consider iron studies   │   │   │
│  │  │ • Consider reticulocyte   │   │   │
│  │  │   count                   │   │   │
│  │  │ • Repeat CBC in 4-6 weeks │   │   │
│  │  │                          │   │   │
│  │  │ Urgency: Soon             │   │   │
│  │  │ ⚠️ Decision support only   │   │   │
│  │  └──────────────────────────┘   │   │
│  │                                 │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ Hemoglobin  9.8 ↓ LOW    │   │   │
│  │  │ Range: 12.0–16.0 g/dL    │   │   │
│  │  │ Trend: ↑ Improving       │   │   │
│  │  └──────────────────────────┘   │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │ WBC  11.2 ↑ HIGH         │   │   │
│  │  │ Range: 4.5–11.0 ×10³/μL  │   │   │
│  │  └──────────────────────────┘   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📝 Draft Clinical Note (AI)   │   │
│  │  [Auto-generated from summary] │   │
│  │  [Edit] [Save to record]       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Design specs:**
- Video area: top 40% of screen, black background, rounded bottom corners
- Video controls: floating buttons, semi-transparent background
- Tab bar below video: Labs, Notes, Chat, Rx (prescriptions)
- Labs tab (default shown): AI summary card with doctor-facing technical output
- AI summary: blue accent tint (`#EBF3FE`), monospace-friendly for values
- Urgency badge: color-coded (routine=gray, soon=amber, urgent=red)
- Clinical note draft card: AI pre-fills from summary, doctor can edit and save
- All AI content marked with "Decision support only" disclaimer

**Navigation actions:**
- Back button → returns to `DoctorHome`
- Tap "End call" → confirmation dialog → navigates to consultation summary
- Tab switching: Labs (lab results + AI), Notes (clinical notes), Chat (in-call messaging), Rx (e-prescriptions)
- Tap "Draft Clinical Note" → expands editable text area with AI pre-filled content
- Tap "Save to record" → saves note to patient's medical record via API
