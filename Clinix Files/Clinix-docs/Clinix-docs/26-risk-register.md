# 26 — Risk Register (new)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Missed emergency (false negative) | Critical | Rule engine pre- and post-AI, reviewed suite, over-triage bias, incident review |
| R2 | AI hallucinates conditions, drugs or doses | High | Schema validation, no dosing, approved reference data, eval suite |
| R3 | False reassurance after an AI failure | Critical | Safe-failure messages, no fallback to "self-care" |
| R4 | Patient treats output as diagnosis | High | Wording standards, disclaimers, no probabilities, history labels |
| R5 | Sensitive data exposed to AI/maps providers | High | Data minimization, provider review, consent disclosure |
| R6 | Cross-user record access | Critical | Object-level authorization tests, no ID-only checks |
| R7 | Prompt injection | Medium | Untrusted-input handling, narrow tools, post-gate |
| R8 | Inaccurate facility data | Medium | Source and last-verified display, report-error flow |
| R9 | Misrepresenting ambulance dispatch | Critical | Wording rules, audit semantics, no dispatch claims |
| R10 | Regulatory classification (e.g. medical device) | High | Intended-use statement, legal review before launch |
| R11 | Model drift or provider change | Medium | Pinned model ID, evaluation on change, rollbacks |
| R12 | Poor connectivity limits access | Medium | Lightweight UI, offline emergency page |
| R13 | Language misunderstanding | High | Support only reviewed languages; clear fallback |
| R14 | Insider access to patient data | High | RBAC, MFA, break-glass, audit review |
| R15 | Provider outage during emergency | High | Emergency path independent of AI, DB and maps |

Review the register at each phase gate and after every incident.
