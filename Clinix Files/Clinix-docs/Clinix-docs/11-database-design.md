# 11 — MongoDB Database Design

Use MongoDB collections with explicit validation, access controls and appropriate indexes (Mongoose models in `src/models/`).

## Core collections

| Collection | Purpose |
|---|---|
| `users` | Identity, auth provider IDs, verified contact details, role, account status. Avoid storing unnecessary medical data here. |
| `consents` | User ID, consent type, policy version, timestamp, status, scope, withdrawal info |
| `patientProfiles` | Optional demographics, relevant history, allergy records, current medicines; strict access restrictions |
| `assessmentSessions` | Owner, lifecycle status, consent reference, timestamps, language, triage state |
| `assessmentMessages` | Individual patient and assistant messages, type, timestamps, session reference |
| `assessments` | Structured symptoms, urgency, possible causes, actions, limitations, model and prompt version |
| `medicalReferences` | Approved reference content, source URL, jurisdiction, version, review status, last-reviewed timestamp |
| `facilitiesCache` | Provider ID, name, coordinates, address, phone, type, source, verification metadata |
| `emergencyConfigurations` | Country/region, emergency number, source, verification date, enabled flag |
| `auditEvents` | Security-sensitive actions: actor, action, timestamp, outcome, resource ID; sensitive values excluded |
| `triageRuleSets` (new) | Versioned reviewed rule sets, approval metadata, active flag (see [22](22-triage-rule-engine.md)) |
| `featureFlags` (new) | Kill switches for models, rule sets and modules |

## Example assessment document

```js
{
  _id: ObjectId,
  patientId: ObjectId,
  sessionId: ObjectId,

  symptoms: [
    { description: "Headache", onset: "Yesterday", severity: "moderate" }
  ],

  triage: {
    level: "urgent",
    ruleSetVersion: "reviewed-rules-v1",
    checkedAt: ISODate()
  },

  possibleConditions: [
    {
      name: "Illustrative possibility",
      explanation: "Not a confirmed diagnosis",
      supportingSymptoms: []
    }
  ],

  recommendations: [],
  limitations: [],

  aiMetadata: {
    provider: "NVIDIA",
    model: "configured-model-id",
    promptVersion: "assessment-v1"
  },

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

The values are illustrative, not a real patient's diagnosis.

## Additional field shapes (new)

```ts
// users
{ email: string (unique), emailVerified: Date | null,
  role: "patient"|"support_admin"|"clinical_reviewer"|"system_admin"|"auditor",
  status: "active"|"suspended"|"pending_deletion",
  createdAt, updatedAt }

// consents
{ userId, type: "privacy"|"ai_processing"|"data_retention"|"location"|"trusted_contact",
  policyVersion: string, status: "granted"|"withdrawn",
  grantedAt: Date, withdrawnAt?: Date, scope?: string }

// assessmentSessions
{ ownerType: "user"|"guest", userId?, guestTokenHash?,
  status: "active"|"completed"|"abandoned"|"emergency",
  consentId?, language: string, triageState: string,
  expiresAt?: Date, // TTL for guests only
  createdAt, updatedAt }

// patientProfiles (tri-state for clinical fields)
{ userId (unique), ageYears?: number,
  allergies: { status: "yes"|"no"|"unknown", items: string[] },
  currentMedicines: { status: "yes"|"no"|"unknown", items: string[] },
  pregnancy: "yes"|"no"|"unknown"|"not_applicable" }

// auditEvents
{ actorId?, actorRole?, action: string, resourceType?, resourceId?,
  outcome: "success"|"denied"|"error", ip?: string (hashed), at: Date }
```

## Database rules

- Check every patient-owned record against the authenticated user. **An ObjectId is not an authorization mechanism.**
- Indexes on `patientId`, `sessionId` and timestamps; unique indexes on account identifiers.
- TTL indexes only for records with an explicitly approved retention period.
- Keep long-term medical records separate from temporary guest sessions.
- Never log passwords, API keys, complete transcripts or unnecessary personal details.
- Backups, encryption, tested restores and documented deletion workflows.
- Establish retention and consent requirements before deciding what to store indefinitely (see [24](24-data-retention-and-consent.md)).

## Suggested indexes (new)

| Collection | Index |
|---|---|
| `users` | `{ email: 1 }` unique |
| `assessments` | `{ patientId: 1, createdAt: -1 }` |
| `assessmentMessages` | `{ sessionId: 1, createdAt: 1 }` |
| `assessmentSessions` | `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (guests only) |
| `consents` | `{ userId: 1, type: 1, policyVersion: 1 }` |
| `facilitiesCache` | `2dsphere` on location; `{ providerId: 1 }` unique |
| `emergencyConfigurations` | `{ countryCode: 1 }` unique |
| `auditEvents` | `{ at: -1 }`, `{ actorId: 1, at: -1 }` |
