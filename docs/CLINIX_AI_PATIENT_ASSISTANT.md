# Clinix AI Patient Assistant — System Architecture & Implementation Guide

## 1. System Architecture

Clinix AI Patient Assistant is a full-stack, clinically gated healthcare navigation and symptom explanation platform built on **Next.js (App Router)**, **TypeScript**, **MongoDB (Mongoose)**, and a server-side **NVIDIA-hosted AI Inference Engine** (via OpenAI-compatible SDK).

### Core Architectural Separation

```
[Patient UI (Client)]
         │
         ▼
[API Boundary: /api/v1/assistant/*] ─── (Rate Limiting, Zod Schema Validation, Auth & Session Scoping)
         │
         ▼
[ClinixAssistantService (Orchestrator)]
         ├── 1. Idempotency Check (clientMessageId tracking)
         ├── 2. Independent Clinical Safety Engine (Pre-AI Gate: checkEmergencyRules)
         │       └── [IF EMERGENCY]: Immediately escalate, trigger verified 112 emergency response, skip AI call
         ├── 3. Intent Classification (Symptom Assessment, Medication, Clinic, Health Info, Clarification)
         ├── 4. Server-Side State Machine (assertValidTransition, deterministic states)
         ├── 5. Subsystem Routing:
         │       ├── Medication Service (Ghana National Formulary, Contraindication Check, Dosage Refusal)
         │       ├── Facility Service (Verified Healthcare Directory, Reverse Geo, Directions)
         │       └── Symptom Assessment Engine (Structured Symptom Tracking, Standard Follow-up Questions)
         ├── 6. NVIDIA AI Inference (meta/llama-3.1-70b-instruct with bounded retries, temperature=0)
         ├── 7. Post-Generation Safety Gate (enforceSafetyGate: Stricter urgency floor always wins)
         └── 8. MongoDB Persistence & Audit Logging (Sanitized, Privacy-Preserving Audit Trail)
```

---

## 2. Conversation Lifecycle & State Machine

The assistant conversation lifecycle follows a formal, server-validated state machine defined in `src/lib/assistant/state-machine.ts`.

### Allowed Conversation States

| State | Purpose |
|---|---|
| `idle` | Initialized consultation session, awaiting patient concern |
| `collecting_symptoms` | Ingesting initial natural-language symptom description |
| `screening` | Evaluating warning signs and clinical safety rules |
| `asking_questions` | Prompting structured follow-up questions to reduce uncertainty |
| `evaluating` | Synthesizing clinical rules, symptoms, and constrained AI analysis |
| `presenting_result` | Presenting verified explanation, guidance, and care options |
| `completed` | Finished consultation session |
| `escalated` | Emergency warning signs triggered; active emergency guidance |
| `failed` | Handled error state with safe fallback action |

### Centralized State Transition Rules

```
idle ───────────────► collecting_symptoms ────────► screening
  │                         │                           │
  │                         ▼                           ├────────► asking_questions
  │                     escalated                       │                 │
  ▼                         ▲                           │                 ▼
completed                   │                           ├────────► evaluating
                            │                           │                 │
                            └───────────────────────────┴────────► presenting_result
                                                                          │
                                                                          ▼
                                                                      completed
```

**Critical Invariant — Emergency Preservation:**
Once a conversation reaches the `escalated` state, it can never be downgraded or demoted to an ordinary state by an AI inference failure, database error, or patient reply. Only explicit completion or starting a new consultation with a new identifier resets the state.

---

## 3. Intent Classification

Every incoming patient message is classified in `src/lib/assistant/intent-classifier.ts`:

1. `emergency_assistance`: Red flag keywords (chest pain, breathing distress, stroke signs, severe hemorrhage, anaphylaxis) or matched triage rules. Bypasses ordinary AI inference.
2. `symptom_assessment`: Personal health concerns, symptoms, or physical discomfort descriptions.
3. `assessment_follow_up`: Answers to structured follow-up questions within an active assessment.
4. `medication_information`: Drug queries, interactions, side effects, and therapeutic indications.
5. `clinic_search`: Finding hospitals, clinics, emergency rooms, pharmacies, or medical centers.
6. `general_health_information`: Educational medical questions without reported personal symptoms.
7. `unsupported_request`: Non-health topics (e.g. coding, finance, legal advice) or prescription creation requests.
8. `clarification_required`: Ambiguous, one-word, or greeting inputs.

---

## 4. Independent Clinical Safety Engine

The safety engine (`src/lib/safety/triage-engine.ts`) runs completely independently of NVIDIA or any external LLM provider.

- Evaluates reviewed clinical rules (`REVIEWED_TRIAGE_RULES`) in `src/lib/safety/rules-data.ts`.
- Evaluates vitals (systolic BP, heart rate, temperature, O2 saturation) and clinical red-flag patterns.
- Normalizes colloquial language, local phrasing, and common medical typos.
- When an emergency rule activates:
  1. Halts ordinary assessment intake immediately.
  2. Surfaces approved emergency response text and verified emergency contacts (e.g. Ghana National Ambulance Service 112).
  3. Displays tap-to-call action and link to nearest emergency department.
  4. Never claims an ambulance was dispatched unless confirmed by a real external integration.

---

## 5. Structured Output & AI System Instructions

### Versioned System Prompt
- Prompt Version: `assistant-v2.0` (`src/lib/ai/prompts/assistant-v2.ts`)
- Explicitly forbids definitive diagnosis, ruled-out conditions, or individualized dosage calculation.
- Emphasizes diagnostic uncertainty and transparent limitations.
- Enforces JSON output adhering to `structuredAssistantResponseSchema`.

### Runtime Schema (`src/lib/assistant/schemas.ts`)

```json
{
  "intent": "symptom_assessment",
  "state": "asking_questions",
  "message": "Patient-facing explanation text...",
  "followUpQuestion": {
    "id": "symptom_duration",
    "text": "How long have you experienced these symptoms?",
    "type": "single_choice",
    "options": ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "Not sure"]
  },
  "safety": {
    "urgentPathwayTriggered": false,
    "ruleIds": []
  },
  "actions": [
    {
      "id": "find_clinic",
      "label": "Find Nearby Clinic",
      "type": "link",
      "target": "/clinics"
    }
  ],
  "sources": [
    {
      "id": "who_guidelines",
      "title": "World Health Organization Clinical Guidelines"
    }
  ]
}
```

---

## 6. MongoDB Data Models & Indexes

### Collections

1. **`assistantConversations`** (`src/models/AssistantConversation.ts`):
   - `userId`: ObjectId (ref: User, indexed)
   - `guestTokenHash`: String (indexed)
   - `status`: enum ("active", "completed", "archived", "emergency")
   - `currentState`: enum (state machine states)
   - `assessmentId`: ObjectId (ref: Assessment, indexed)
   - `expiresAt`: Date with TTL index (`{ expires: 0 }`) for automatic guest session cleanup
   - Indexes: `{ userId: 1, updatedAt: -1 }`, `{ guestTokenHash: 1, updatedAt: -1 }`

2. **`assistantMessages`** (`src/models/AssistantMessage.ts`):
   - `conversationId`: ObjectId (ref: AssistantConversation, indexed)
   - `role`: enum ("patient", "assistant", "system")
   - `content`: String (validated, max 5000 chars)
   - `responseType`: enum ("message", "follow_up_question", "emergency_alert", etc.)
   - `clientMessageId`: String (indexed, sparse, for idempotency deduplication)
   - `structuredPayload`: Mixed
   - Index: `{ conversationId: 1, createdAt: 1 }`

3. **`assessments`** (`src/models/Assessment.ts`):
   - `patientId`: ObjectId (ref: User, indexed)
   - `conversationId`: ObjectId (ref: AssistantConversation, indexed)
   - `symptoms`: Array of structured symptom objects
   - `urgency`: enum ("emergency", "urgent", "routine", "self_care_eligible", "insufficient_information")
   - `possibleConditions`, `recommendations`, `limitations`, `triage`, `aiMetadata`

4. **`assistantFeedback`** (`src/models/AssistantFeedback.ts`):
   - `conversationId`: ObjectId (indexed)
   - `rating`: enum ("positive", "negative", "helpful", "not_helpful", "concerning")
   - `feedbackText`: String

---

## 7. Backend API Endpoints

All endpoints are rooted under `/api/v1/assistant/`:

- `POST /api/v1/assistant/conversations`: Initializes consultation session (auto-provisions guest session if unauthenticated).
- `GET /api/v1/assistant/conversations`: Lists authorized conversations for the user/guest.
- `GET /api/v1/assistant/conversations/:id`: Retrieves an authorized conversation and its chronological message stream.
- `POST /api/v1/assistant/conversations/:id/messages`: Submits patient message, executes safety engine, orchestrates intent routing/AI inference, returns structured response.
- `POST /api/v1/assistant/conversations/:id/finish`: Finalizes a consultation session.
- `POST /api/v1/assistant/assessments/:id/save`: Securely links an assessment to the authenticated user's permanent record.
- `GET /api/v1/assistant/assessments/:id`: Retrieves structured assessment record (enforcing object-level patient authorization).
- `POST /api/v1/assistant/feedback`: Records patient feedback regarding assistant answers.

---

## 8. Error Handling, Rate Limiting & Safe Degradation

- **Rate Limiting**: Configured per client IP (25-30 requests/minute) with `X-RateLimit-*` headers.
- **Idempotency**: Patient message submissions support `clientMessageId`. Repeated requests return the prior result without creating duplicate records.
- **AI Degradation Invariant**: If NVIDIA inference fails, times out, or returns invalid JSON:
  - If safety screening found an urgent floor, return an urgent clinical referral immediately.
  - Never fabricate an AI answer as fallback.
  - Never reassure the user that "everything is fine" as an error fallback.
  - Return safe action advice: *"If you have severe, acute, or worsening symptoms, call 112 immediately."*

---

## 9. Testing & Verification

Run the comprehensive automated test suite:

```bash
# Run complete test suite (142 tests across 19 test files)
npm test

# Run safety regression and triage rule tests
npm run test:safety

# Run AI evaluation tests
npm run test:eval

# Run TypeScript type check
npm run typecheck
```

### Test Coverage Highlights
- `src/tests/assistant/state-machine.test.ts`: Validates all allowed transitions and verifies emergency non-downgrade invariants.
- `src/tests/assistant/intent-classifier.test.ts`: Verifies classification boundaries across emergency, symptoms, medications, clinics, and greetings.
- `src/tests/assistant/structured-schema.test.ts`: Enforces strict Zod validation on model output.
- `src/tests/assistant/symptom-tracker.test.ts`: Tests structured symptom extraction, correction handling, and safety re-evaluation.
- `src/tests/assistant/assistant-service.test.ts`: Tests two-user authorization isolation, idempotency, emergency bypass, clinic lookup, and medication boundary enforcement.
- `src/tests/assistant/api-endpoints.test.ts`: Validates HTTP route handlers, 401/403/404 handling, and feedback logging.
- `src/tests/assistant/safety-regression.test.ts`: Verifies prompt injection resistance, life-threatening red flag detection, dosage calculation refusal, and non-diagnostic boundaries.

---

## 10. Deployment Prerequisites & Operational Blockers

### Environment Configuration
The following variables are configured in `.env.local`:
- `MONGODB_URI`: Connection string to MongoDB instance with replica set (for transactions)
- `AUTH_SECRET`: Random 32+ character string for NextAuth session encryption
- `NVIDIA_API_KEY`: Server-side API key for NVIDIA NIM API endpoint
- `NVIDIA_MODEL`: Primary instruction model (default: `meta/llama-3.1-70b-instruct`)
- `DEFAULT_COUNTRY`: ISO 3166-1 alpha-2 code (default: `GH`)
- `DEFAULT_EMERGENCY_NUMBER`: Emergency dispatch number (default: `112`)

### Controlled Release Prerequisites & Remaining Blockers
1. **Clinical Validation Board Approval**: The current triage rules and warning sign catalogs are versioned (`rules-data.ts` v1.0.0), but require sign-off by a certified clinical advisory panel before full clinical deployment.
2. **Medication Formulary Synchronization**: The bundled medications in `ghana-medications.json` must be kept updated with the national food & drugs authority registered product list.
3. **Emergency Dispatch Integration**: The application surfaces verified 112 tap-to-call numbers. Direct computer-aided dispatch (CAD) integration is not implemented and must not be claimed.
