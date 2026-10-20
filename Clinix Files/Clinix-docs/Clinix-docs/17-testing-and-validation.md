# 17 — Testing and Validation

A healthcare application needs more rigor than a typical CRUD app.

## Functional tests

- Registration, verification, login, logout, password recovery
- Guest and registered-patient workflows
- Assessment session persistence and retrieval
- Input validation and malformed AI output
- Facility searches and location-denied scenarios
- Emergency call links and number configuration
- Consent, export, deletion, session revocation
- Admin permission checks

## Safety tests

Maintain a **clinician-reviewed** suite covering:

- Clear emergency presentations
- Ambiguous symptoms
- Missing or contradictory information
- Pediatric and older-adult scenarios
- Allergy and medication-interaction risks
- Pregnancy-related scenarios where relevant
- Requests for prescription medicines or unsafe dosages
- Symptoms plausibly indicating multiple conditions
- Unsupported languages and out-of-scope requests
- Prompt-injection attempts asking the AI to ignore safety instructions
- AI service timeouts and invalid responses

## Acceptance criteria

Before release:

1. Emergency test cases trigger the intended reviewed escalation path.
2. An AI response cannot override a higher-priority emergency rule.
3. Unsupported or malformed model output is rejected safely.
4. Patients cannot retrieve other users' records by changing an ID.
5. API secrets never appear in browser bundles or logs.
6. Location permission is optional, with a manual alternative.
7. Facility details are not represented as verified when they are not.
8. The app never claims to have dispatched an ambulance without a confirmed, authorized integration.
9. Medication advice passes the applicable clinical and safety validation.
10. The team can disable an unsafe model, rule set or feature quickly.

Passing software tests does not prove clinical safety. The assessment system needs clinical evaluation and a documented process for reviewing adverse events, false reassurance and missed emergencies.

## Test tooling (new)

| Layer | Tool suggestion |
|---|---|
| Unit | Vitest or Jest (rule engine, schema, gate) |
| API | Supertest or Playwright API tests |
| E2E | Playwright (guest flow, emergency, location denied) |
| Accessibility | axe-core in CI, manual screen-reader passes |
| Security | Dependency audit, secret scanning, authorization tests with two users |
| AI evaluation | Golden-case runner described in [23](23-ai-prompts-and-evaluation.md) |

## Rule-engine test requirements (new)

- 100% of reviewed emergency cases must pass on every CI run; any failure blocks merge.
- Tests include paraphrases, typos and local phrasing, not only textbook wording.
- Mutation tests: removing any rule must cause at least one test to fail.
