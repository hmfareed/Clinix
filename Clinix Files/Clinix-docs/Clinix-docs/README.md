# AI Healthcare Assistant — Documentation Index

A healthcare assistance and patient triage platform built with **Next.js**, **MongoDB** and **NVIDIA-hosted AI models**. Patients describe symptoms in natural language, receive a structured and safety-checked assessment, find nearby care, and reach emergency services when needed.

> **Core principle:** the AI model generates helpful explanations. It is never the sole authority for emergency triage, diagnosis or medication decisions. Those are controlled by an independent safety engine, clinician-reviewed rules and approved reference data.

## How to read these docs

Files are numbered in the order a team would normally need them. Files marked **(new)** were added beyond the original specification to fill gaps a coding agent would otherwise have to guess at.

| # | File | Contents |
|---|------|----------|
| 01 | [Product overview](01-product-overview.md) | Vision, objective, core modules, MVP scope |
| 02 | [Medical safety principles](02-medical-safety-principles.md) | Non-negotiable safety rules and regulatory stance |
| 03 | [System architecture](03-system-architecture.md) | Layers, tech stack, project structure |
| 04 | [Onboarding and authentication](04-onboarding-and-auth.md) | Guest vs registered flows, consent, account features |
| 05 | [Symptom assessment engine](05-symptom-assessment-engine.md) | Conversation flow, data collected, triage levels, result UI |
| 06 | [NVIDIA AI integration](06-nvidia-ai-integration.md) | Client, schemas, assessment service, hardening |
| 07 | [Medication safety](07-medication-safety.md) | What the medication module may and may not do |
| 08 | [Care navigation](08-care-navigation.md) | Nearby clinics, hospitals, pharmacies |
| 09 | [Emergency and ambulance](09-emergency-and-ambulance.md) | Emergency screen, calling, dispatch boundaries |
| 10 | [Patient dashboard](10-patient-dashboard.md) | Pages and patient features |
| 11 | [Database design](11-database-design.md) | MongoDB collections, schemas, indexes |
| 12 | [API specification](12-api-specification.md) | Endpoints, payloads, error handling |
| 13 | [Admin and clinical governance](13-admin-and-clinical-governance.md) | Admin modules, RBAC |
| 14 | [External integrations](14-external-integrations.md) | Providers and required safeguards |
| 15 | [Security, privacy and compliance](15-security-privacy-compliance.md) | Security baseline, Ghana Act 843 |
| 16 | [UX and accessibility](16-ux-and-accessibility.md) | Pages, design principles, accessibility |
| 17 | [Testing and validation](17-testing-and-validation.md) | Functional and safety tests, acceptance criteria |
| 18 | [Deployment](18-deployment.md) | Environments and production checklist |
| 19 | [Development roadmap](19-roadmap.md) | Eight build phases |
| 20 | [Advanced features](20-advanced-features.md) | Post-validation additions |
| 21 | [Environment and setup](21-environment-and-setup.md) **(new)** | Env vars, local setup, scripts |
| 22 | [Triage rule engine](22-triage-rule-engine.md) **(new)** | Rule format, evaluation order, versioning |
| 23 | [AI prompts and evaluation](23-ai-prompts-and-evaluation.md) **(new)** | Prompt versioning, eval suite, model rollout |
| 24 | [Data retention and consent](24-data-retention-and-consent.md) **(new)** | Retention table, guest data, deletion workflow |
| 25 | [Error states and fallbacks](25-error-states-and-fallbacks.md) **(new)** | Degraded-mode behavior |
| 26 | [Risk register](26-risk-register.md) **(new)** | Risks, severity, mitigations |
| 27 | [Agent kickoff prompts](27-agent-kickoff-prompts.md) **(new)** | Phase-by-phase prompts for a coding agent |
| 28 | [Glossary](28-glossary.md) **(new)** | Terms used across the docs |
| 29 | [References](29-references.md) | Official technical and governance sources |

## Recommended MVP

Start with the patient interface, symptom conversation, emergency safety checks, structured assessment results and nearby clinic search. Add medication guidance and persistent patient health records only after their clinical and privacy requirements are defined. Do not attempt to build an unvalidated autonomous diagnostic system in one pass.

## Important disclaimer

These documents describe a software product. Nothing here is a validated clinical protocol. Triage rules, timeframes, symptom criteria and medication guidance must be reviewed and approved by qualified clinicians, and the product needs legal and regulatory review before any real-world launch.
