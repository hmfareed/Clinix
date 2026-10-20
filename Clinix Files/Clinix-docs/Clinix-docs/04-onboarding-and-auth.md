# 04 — Patient Registration, Onboarding and Authentication

The platform supports **guests** who need fast initial triage and **registered patients** who want to retain history.

## Flow

```
Landing page
  → Choose guest assessment or create account
  → Privacy notice and consent
     ├─ Guest: temporary assessment, minimal retention
     └─ Registered: verify account, set preferences, manage records
```

## Registration features

- Email and password registration
- Email verification
- Secure login and logout
- Forgot-password and reset-password flows
- Optional supported social login
- Session expiration and revocation
- Account deletion and data export requests
- Consent records with version and timestamp
- Optional patient profile and emergency contact
- Accessible language and text-size settings
- Clear explanation of how patient data is processed by external AI services

## Data minimization

Do not require full identity, phone number or exact location merely to read general health information. Request only what the selected feature needs.

## Guest rules

- Guest sessions use a random, unguessable session token in an httpOnly cookie.
- Guest transcripts have a short, explicitly defined retention window (see [24](24-data-retention-and-consent.md)).
- Guests can always reach emergency instructions and facility search.
- Offer account creation after a result, never before an emergency screen.

## Children and dependents

Implement a separately reviewed guardian-consent and access model **before** enabling persistent records for children or dependents. Until then, the product should state that it is intended for adult users and show conservative guidance for child-related symptoms.

## Roles

`patient`, `support_admin`, `clinical_reviewer`, `system_admin`, `auditor`. See [13](13-admin-and-clinical-governance.md).

## Auth requirements checklist

- [ ] Passwords hashed by the auth library (never custom)
- [ ] Email verification required before persistent history is enabled
- [ ] Rate limits on login, registration, reset and verification endpoints
- [ ] CSRF protection where applicable
- [ ] Session revocation list or database-backed sessions
- [ ] Generic error messages that do not reveal whether an email exists
