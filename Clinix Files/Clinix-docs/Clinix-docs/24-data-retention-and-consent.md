# 24 — Data Retention and Consent (new)

Retention periods below are **proposals** to be confirmed by legal and privacy review against Act 843 and clinical governance.

## Retention table

| Data | Guest | Registered | Proposed handling |
|---|---|---|---|
| Assessment messages | Short TTL (e.g. 24 hours) | Until user deletes, or approved maximum | TTL index for guests |
| Structured assessments | Not stored unless guest opts in | Kept while account active | User-deletable |
| Patient profile | N/A | Kept while account active | Deleted with account |
| Consent records | N/A | Retained for legal proof | Kept after deletion as minimal record, if legally required |
| Audit events | Retained per security policy | Retained per security policy | No transcript content |
| Facility search location | Not stored | Not stored by default | Used transiently |
| Backups | n/a | Rolling window | Deleted data expires from backups on schedule |

## Consent types

`privacy`, `ai_processing`, `data_retention`, `location`, `trusted_contact`. Each is separate, versioned, timestamped and withdrawable. Withdrawal takes effect immediately for future processing.

## Consent screen must state

- What is collected and why
- That symptom text is processed by an external AI service (NVIDIA) and what is sent
- What is stored, for how long, and how to delete it
- That the output is information, not a diagnosis
- How to reach emergency services right now

## Deletion workflow

1. Patient requests deletion → status `pending_deletion`, sessions revoked.
2. Grace period (optional, e.g. 7 days) with cancel option.
3. Delete profile, sessions, messages, assessments, reminders.
4. Retain only legally required minimal records.
5. Write audit event and email confirmation (no health content).

## Export

JSON and PDF export of profile, assessments and consents, generated on request and delivered via an authenticated download link that expires.
