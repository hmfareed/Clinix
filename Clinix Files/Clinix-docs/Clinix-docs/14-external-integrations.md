# 14 — External Integrations

| Integration | Purpose | Required safeguard |
|---|---|---|
| NVIDIA inference | Generate conversational assessment content | Server-only key, model validation, safety gates |
| MongoDB Atlas | Persist patient and application data | Least privilege, backups, access controls |
| Maps and places API | Find nearby facilities | Never send medical transcripts |
| Emergency-number registry | Display correct local emergency contacts | Verified source and review date |
| Medical knowledge provider | Approved health and medicine information | Licensing, provenance, update checks |
| Authentication provider | Registration and sessions | Secure sessions, recovery, revocation |
| Email provider | Verification and notifications | Never expose health information in email |
| Error monitoring | Detect failures | Redact sensitive data |
| Optional messaging provider | Consent-based reminders | Explicit opt-in, secure content |

A real ambulance dispatch integration is a **separate operational project**, not a normal API feature to simulate.

## Integration design rules (new)

- Wrap each provider behind an interface in `lib/` so it can be replaced or mocked.
- Set explicit timeouts and circuit breakers; degrade per [25](25-error-states-and-fallbacks.md).
- Store provider credentials only in server-side secrets, scoped per environment.
- Record provider name and version in `aiMetadata` / `facilitiesCache` for traceability.
- Review each provider's data-processing terms before any patient-related data flows to it.
