# API Contracts

## 1. `POST /labs/:patientId/results`

Upload lab results for a patient. Triggers AI analysis asynchronously.

### Authorization
- Roles: `PATIENT` (own results only), `DOCTOR`, `LAB_SCIENTIST`, `ADMIN`
- Header: `Authorization: Bearer <access_token>`

### Request

#### Headers
```
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

#### Path Parameters
| Parameter | Type | Description |
|---|---|---|
| `patientId` | UUID | Patient's unique identifier |

#### Body Parameters (multipart/form-data)

**Structured values (JSON field):**
```json
{
  "panel_type": "CBC",
  "test_date": "2026-09-14",
  "lab_name": "CityLab Frankfurt",
  "values": [
    {
      "code": "HGB",
      "loinc": "718-7",
      "name": "Hemoglobin",
      "value": 9.8,
      "unit": "g/dL",
      "ref_low": 12.0,
      "ref_high": 16.0
    },
    {
      "code": "WBC",
      "loinc": "6690-2",
      "name": "White Blood Cell Count",
      "value": 11.2,
      "unit": "10^3/μL",
      "ref_low": 4.5,
      "ref_high": 11.0
    },
    {
      "code": "PLT",
      "loinc": "777-3",
      "name": "Platelet Count",
      "value": 245,
      "unit": "10^3/μL",
      "ref_low": 150,
      "ref_high": 400
    }
  ]
}
```

**File upload (optional):**
| Field | Type | Description |
|---|---|---|
| `file` | Binary | Lab result PDF or image (max 10MB) |

### Response — `201 Created`

```json
{
  "status": "success",
  "data": {
    "result_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "patient_id": "patient-uuid-here",
    "panel_type": "CBC",
    "test_date": "2026-09-14",
    "lab_name": "CityLab Frankfurt",
    "status": "pending_ai_analysis",
    "uploaded_by": {
      "id": "user-uuid",
      "role": "PATIENT"
    },
    "values": [
      {
        "code": "HGB",
        "loinc": "718-7",
        "name": "Hemoglobin",
        "value": 9.8,
        "unit": "g/dL",
        "ref_low": 12.0,
        "ref_high": 16.0,
        "flag": "LOW",
        "is_critical": false
      },
      {
        "code": "WBC",
        "loinc": "6690-2",
        "name": "White Blood Cell Count",
        "value": 11.2,
        "unit": "10^3/μL",
        "ref_low": 4.5,
        "ref_high": 11.0,
        "flag": "HIGH",
        "is_critical": false
      },
      {
        "code": "PLT",
        "loinc": "777-3",
        "name": "Platelet Count",
        "value": 245,
        "unit": "10^3/μL",
        "ref_low": 150,
        "ref_high": 400,
        "flag": "NORMAL",
        "is_critical": false
      }
    ],
    "file_url": "s3://imedics-lab-results/patient-uuid/a1b2c3d4.pdf",
    "ai_analysis_id": "ai-uuid-here",
    "ai_status": "processing",
    "created_at": "2026-09-14T09:30:00Z",
    "updated_at": "2026-09-14T09:30:00Z"
  }
}
```

### Response — `202 Accepted` (AI analysis queued)

If AI analysis is processed asynchronously:
```json
{
  "status": "accepted",
  "data": {
    "result_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ai_status": "processing",
    "estimated_completion": "2026-09-14T09:31:30Z"
  }
}
```

The client receives a WebSocket event when AI analysis completes:
```json
{
  "event": "ai_analysis_complete",
  "data": {
    "result_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ai_analysis_id": "ai-uuid-here"
  }
}
```

### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `INVALID_VALUES` | Malformed JSON or impossible values (e.g., negative HGB) |
| `400` | `UNSUPPORTED_PANEL` | Panel type not in supported set |
| `401` | `UNAUTHORIZED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Role not permitted or patient accessing other patient's data |
| `404` | `PATIENT_NOT_FOUND` | Patient ID does not exist |
| `413` | `FILE_TOO_LARGE` | File exceeds 10MB limit |
| `422` | `VALIDATION_ERROR` | Missing required fields |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Server-side failure |

### Example cURL
```bash
curl -X POST https://api.imedics.app/labs/patient-uuid/results \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: multipart/form-data" \
  -F 'structured_data={"panel_type":"CBC","test_date":"2026-09-14","values":[{"code":"HGB","loinc":"718-7","name":"Hemoglobin","value":9.8,"unit":"g/dL","ref_low":12.0,"ref_high":16.0}]};type=application/json' \
  -F 'file=@lab_report.pdf'
```

---

## 2. `POST /ai/lab/analyse`

Internal endpoint called by the NestJS backend to trigger AI analysis. Not publicly accessible.

### Authorization
- Internal only (mTLS or VPC-private network)
- Service-to-service token: `X-Service-Token: <internal_service_token>`

### Request

#### Headers
```
Content-Type: application/json
X-Service-Token: <internal_service_token>
```

#### Request Body

```json
{
  "analysis_id": "ai-uuid-here",
  "patient": {
    "age": 35,
    "sex": "female",
    "language": "en",
    "conditions": ["iron_deficiency_anemia"],
    "medications": ["ferrous_sulfate_325mg"],
    "previous_results": [
      {
        "test_date": "2026-08-01",
        "panel_type": "CBC",
        "values": [
          {
            "code": "HGB",
            "value": 8.5,
            "unit": "g/dL"
          }
        ]
      }
    ]
  },
  "panel": [
    {
      "code": "HGB",
      "loinc": "718-7",
      "name": "Hemoglobin",
      "value": 9.8,
      "unit": "g/dL",
      "ref_low": 12.0,
      "ref_high": 16.0,
      "flag": "LOW"
    },
    {
      "code": "WBC",
      "loinc": "6690-2",
      "name": "White Blood Cell Count",
      "value": 11.2,
      "unit": "10^3/μL",
      "ref_low": 4.5,
      "ref_high": 11.0,
      "flag": "HIGH"
    },
    {
      "code": "PLT",
      "loinc": "777-3",
      "name": "Platelet Count",
      "value": 245,
      "unit": "10^3/μL",
      "ref_low": 150,
      "ref_high": 400,
      "flag": "NORMAL"
    }
  ],
  "rule_flags": {
    "critical": [],
    "non_critical": [
      {
        "code": "HGB",
        "flag": "LOW",
        "message": "Hemoglobin below reference range"
      },
      {
        "code": "WBC",
        "flag": "HIGH",
        "message": "WBC above reference range"
      }
    ],
    "trend_summary": {
      "HGB": {
        "previous": 8.5,
        "current": 9.8,
        "direction": "improving"
      }
    }
  },
  "options": {
    "generate_doctor_view": true,
    "generate_patient_view": true,
    "patient_language": "en",
    "doctor_language": "en"
  }
}
```

### Response — `200 OK`

```json
{
  "analysis_id": "ai-uuid-here",
  "status": "completed",
  "doctor_view": {
    "summary": [
      "Hemoglobin (9.8 g/dL) remains below the reference range (12.0–16.0) but shows improvement from 8.5 g/dL on 2026-08-01.",
      "WBC count (11.2 ×10³/μL) is mildly elevated above the reference range (4.5–11.0).",
      "Platelet count is within normal limits.",
      "The upward trend in hemoglobin suggests the current iron supplementation regimen may be having an effect."
    ],
    "suggested_followup": [
      "Consider iron studies (ferritin, transferrin saturation) to assess iron status",
      "Consider reticulocyte count to evaluate marrow response",
      "Repeat CBC in 4–6 weeks to monitor trend"
    ],
    "urgency_level": "soon",
    "limitations": "AI-generated summary for clinical decision support only. Does not constitute a diagnosis. Correlate with clinical presentation."
  },
  "patient_view": {
    "language": "en",
    "title": "Your Blood Test Results in Brief",
    "body": [
      "Some of your blood test results are outside the usual range. This doesn't automatically mean something is wrong, but it's worth discussing with your doctor.",
      "The good news is that your hemoglobin levels have improved since your last test in August, which may be a positive sign.",
      "Your platelet count is within the normal range."
    ],
    "questions_for_doctor": [
      "Which results are most important to monitor?",
      "Should I repeat these tests, and when?",
      "Are there any lifestyle changes I should consider?"
    ]
  },
  "flags": {
    "critical": [],
    "non_critical": [
      {
        "code": "HGB",
        "flag": "LOW",
        "severity": "moderate"
      },
      {
        "code": "WBC",
        "flag": "HIGH",
        "severity": "mild"
      }
    ]
  },
  "urgency_level": "soon",
  "confidence": {
    "level": "medium",
    "reasons": [
      "Rule engine and LLM agree on key findings",
      "Trend data available for HGB comparison",
      "Limited history (only 1 previous result)"
    ]
  },
  "safety": {
    "passed": true,
    "filtered_count": 0,
    "notes": "No safety violations detected in generated content."
  },
  "metadata": {
    "model": "gpt-4-turbo",
    "rag_documents_retrieved": 3,
    "processing_time_ms": 4200,
    "timestamp": "2026-09-14T09:31:24Z"
  }
}
```

### Response — `200 OK` (Safety Filter Triggered)

When the LLM output fails safety checks and is rewritten:
```json
{
  "analysis_id": "ai-uuid-here",
  "status": "completed_with_safety_override",
  "doctor_view": { "summary": [...], "suggested_followup": [...], "urgency_level": "urgent", "limitations": "..." },
  "patient_view": {
    "language": "en",
    "title": "Your Results Need Review",
    "body": [
      "Some of your results need attention from your doctor.",
      "Please contact your doctor promptly to discuss these results."
    ],
    "questions_for_doctor": [
      "What do these results mean for me?",
      "What should I do next?",
      "Do I need additional tests?"
    ]
  },
  "safety": {
    "passed": false,
    "filtered_count": 2,
    "actions_taken": [
      {
        "view": "patient",
        "original_snippet": "...",
        "action": "replaced",
        "reason": "DIAGNOSIS_PATTERN_DETECTED"
      },
      {
        "view": "patient",
        "original_snippet": "...",
        "action": "replaced",
        "reason": "TREATMENT_RECOMMENDATION_DETECTED"
      }
    ]
  }
}
```

### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `INVALID_PAYLOAD` | Missing required fields or malformed JSON |
| `400` | `UNSUPPORTED_PANEL` | Panel type outside supported set (e.g., complex oncology markers) |
| `422` | `IMPOSSIBLE_VALUES` | Negative counts, absurd ranges detected by pre-LLM filter |
| `429` | `RATE_LIMITED` | AI service throttled |
| `500` | `LLM_ERROR` | LLM provider failure or timeout |
| `500` | `RAG_ERROR` | Vector DB retrieval failure |
| `503` | `SERVICE_UNAVAILABLE` | AI service overloaded |

---

## 3. Supporting Endpoints

### `GET /labs/:patientId/results`
List all lab results for a patient with AI analysis status.

### `GET /labs/:patientId/results/:resultId`
Get a single lab result with full AI analysis (doctor_view or patient_view based on role).

### `GET /appointments`
List appointments (filtered by role: patients see their own, doctors see their schedule).

### `POST /appointments`
Book a new appointment (patient only).

### `PATCH /appointments/:id`
Update appointment status (doctor updates: confirmed, in_progress, completed, cancelled).

### `POST /auth/signup`
Register a new user with role selection.

### `POST /auth/signin`
Authenticate and receive access + refresh tokens.

### `POST /auth/refresh`
Exchange refresh token for new access token.

### `POST /auth/logout`
Blacklist refresh token in Redis.

### `GET /users/me`
Get current user profile.

### `PATCH /users/me`
Update user profile (KYC, medical history, insurance).

### `GET /doctors`
List available doctors with specialty, availability, fees.

### `POST /labs/:patientId/orders`
Create a lab test order (doctor or lab scientist).

### `PATCH /labs/:patientId/results/:resultId/verify`
Lab scientist verifies a result (double-check critical values).
