# 19 — Recommended Development Roadmap

Build in phases. Do not implement every feature at once.

| Phase | Name | Scope |
|---|---|---|
| 1 | Foundation | Next.js setup, design system, MongoDB connection, authentication, privacy notices, environment config, app structure |
| 2 | Emergency and safety foundation | Country-aware emergency numbers, clinician-reviewed triage rules, emergency interface, input validation, safe failure behavior |
| 3 | NVIDIA AI integration | Assessment service, conversational follow-up, structured output, validation, model versioning, evaluation tests |
| 4 | Care navigation | Maps integration, clinic discovery, verified facility details, directions, call actions |
| 5 | Medication information | Approved reference sources, medication search, contraindication checks, pharmacist/clinician referral |
| 6 | Patient dashboard | Assessment history, optional profile, reminders, export, privacy controls |
| 7 | Administration and monitoring | Clinical reference management, model evaluation, access auditing, incident workflows, metrics |
| 8 | Validation and controlled launch | Security testing, clinical review, privacy and legal review, pilot, monitoring, documented launch approval |

## Phase exit criteria (new)

- **Phase 1:** a user can register, verify, log in, and see a protected page; secrets are server-only.
- **Phase 2:** emergency page works offline of DB/AI; rule-engine suite passes 100%.
- **Phase 3:** malformed or unsafe model output is rejected; post-generation gate proven by tests.
- **Phase 4:** location-denied path fully usable; facilities show source and verification state.
- **Phase 5:** no medicine output without an approved source; unknown fields force referral.
- **Phase 6:** export and deletion verified end to end; cross-user access tests pass.
- **Phase 7:** kill switches tested; every privileged action audited.
- **Phase 8:** documented sign-off from clinical, legal, security and privacy reviewers.

## Dependencies on non-engineering work

Clinical reviewer engaged before Phase 2 rules are finalized; legal/privacy review before Phase 6; provider contracts before real patient data reaches Phase 3 or 4 integrations.
