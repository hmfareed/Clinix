# 01 — Product Overview

**Working name:** AI Healthcare Assistant (a permanent brand name can be chosen later).

## Primary objective

Help patients understand their symptoms, assess the urgency of their situation, and reach appropriate healthcare services, **without presenting an AI-generated answer as a confirmed medical diagnosis**.

## Target users

- Patients seeking help understanding symptoms and deciding where to go.
- Guests who need fast triage without creating an account.
- Registered patients who want to keep an assessment history.
- Internal staff: support administrators, clinical reviewers, system administrators, auditors (see [13](13-admin-and-clinical-governance.md)).

Initial deployment target: **Ghana**. Country-specific values (emergency numbers, facility sources, legal rules) must be configuration, not hardcoded.

## Core modules

1. **AI symptom assessment.** Conversational interface that asks relevant follow-up questions, identifies possible explanations, and explains uncertainty and next steps. See [05](05-symptom-assessment-engine.md).
2. **Emergency detection and triage.** A dedicated safety layer that detects potentially life-threatening symptoms *before* normal AI conversation continues. See [22](22-triage-rule-engine.md).
3. **Medication information.** General information about medicines, precautions and contraindications, with professional referral instead of automatic prescribing. See [07](07-medication-safety.md).
4. **Nearby clinics and hospitals.** Uses chosen or permitted location to find facilities, contact details and directions. See [08](08-care-navigation.md).
5. **Patient health dashboard.** Registered users review past assessments, manage health information and consent, and see follow-up recommendations. See [10](10-patient-dashboard.md).

## Five cooperating systems

| System | Responsibility |
|---|---|
| AI conversation engine | Understands the patient's statement, asks questions, produces structured assessment content |
| Independent safety engine | Decides whether an emergency workflow or other mandatory safety action takes priority |
| Medical knowledge service | Retrieves approved information and applies medication-safety constraints |
| Healthcare navigation service | Finds facilities and provides verified contact and directions information |
| Patient data and governance service | Controls consent, records, privacy, authorization and auditability |

## MVP scope

**In scope**
- Landing page, guest and registered flows
- Symptom conversation with structured follow-up
- Rule-based emergency check before and after AI generation
- Structured assessment results with urgency, uncertainty and next steps
- Emergency screen with country-aware number and call action
- Nearby clinic search with manual location fallback

**Deferred until requirements are defined**
- Medication guidance beyond generic referral
- Persistent health records (profile, allergies, current medicines)
- Reminders, clinician portal, voice input, local-language support
- Any ambulance dispatch integration

## Out of scope (always, unless separately engineered)

- Confirmed diagnosis
- Automatic prescriptions
- Claiming an ambulance was dispatched when only a phone call was opened
- Treating the product as an electronic medical record system without review
