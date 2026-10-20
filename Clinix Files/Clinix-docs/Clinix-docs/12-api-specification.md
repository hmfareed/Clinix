# 12 — Backend API Specification

All sensitive endpoints authenticate where required, validate input (Zod), enforce access permissions and return safe error messages.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ai/assess` | Start or request a symptom assessment |
| POST | `/api/ai/chat` | Continue a current assessment conversation |
| POST | `/api/triage` | Run reviewed triage rules |
| GET | `/api/assessments` | List current user's assessments |
| GET | `/api/assessments/:id` | Retrieve an authorized assessment |
| DELETE | `/api/assessments/:id` | Delete an eligible assessment |
| GET | `/api/facilities` | Search facilities by location and type |
| GET | `/api/facilities/:id` | Facility details |
| GET | `/api/emergency/config` | Emergency number for a selected country |
| GET | `/api/patients/me` | Current patient's profile |
| PATCH | `/api/patients/me` | Update permitted profile fields |
| GET | `/api/consents` | Review consent records |
| POST | `/api/consents` | Record or update consent |
| POST | `/api/privacy/export` | Request personal data export |
| POST | `/api/privacy/delete-account` | Initiate account and data deletion |
| GET | `/api/health` | Basic health status, no sensitive data |

## Example assessment request

```json
{
  "sessionId": "existing-session-id",
  "symptoms": "I have had a headache since yesterday",
  "age": 28,
  "relevantHistory": [],
  "language": "en"
}
```

The server validates and normalizes the payload. Age and history are optional and collected only when needed.

## Example response

```json
{
  "assessmentId": "assessment-id",
  "urgency": "insufficient_information",
  "summary": "More information is needed to assess your symptoms.",
  "possibleConditions": [],
  "followUpQuestions": [
    "Did the headache start suddenly?",
    "Are you experiencing any other symptoms?"
  ],
  "recommendedNextSteps": [
    "Answer the follow-up questions if it is safe to continue."
  ],
  "limitations": ["This assessment is not a confirmed diagnosis."]
}
```

Never hardcode this response. Real responses come from the validated assessment workflow.

## Error handling

| Status | Meaning |
|---|---|
| 400 | Invalid request data |
| 401 | Unauthenticated |
| 403 | Unauthorized access |
| 404 | Missing or inaccessible resource |
| 429 | Rate limited |
| 503 | External service unavailable |

If AI inference fails, return a controlled error or safe alternative that does not falsely reassure. The emergency call feature stays accessible when AI is down.

## Standard error envelope (new)

```json
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "We couldn't complete the assessment right now.",
    "safeAction": "If you feel this is an emergency, call 112 now.",
    "requestId": "req_abc123"
  }
}
```

Error codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `AI_UNAVAILABLE`, `AI_INVALID_OUTPUT`, `MAPS_UNAVAILABLE`, `CONSENT_REQUIRED`, `FEATURE_DISABLED`.

## Query parameters (new)

`GET /api/facilities`: `lat`, `lng` (optional, only with permission), `q` (manual place), `type` (`hospital|clinic|pharmacy|emergency_department`), `radiusKm`, `limit`.
`GET /api/emergency/config`: `country` (ISO 3166-1 alpha-2, default `GH`).

## Cross-cutting requirements (new)

- Every response carries `requestId`; logs reference it, never transcript content.
- Rate limits: stricter for `/api/ai/*` and auth endpoints; never rate-limit `/api/emergency/config` to the point it can fail for a legitimate user.
- Endpoints return `FEATURE_DISABLED` (503) when a kill switch is active.
