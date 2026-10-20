# 10 — Patient Dashboard

Lets patients manage their health information without becoming an unreviewed electronic medical record system.

## Pages

| Page | Features |
|---|---|
| Overview | Recent assessments, outstanding follow-up reminders, quick actions |
| My assessments | Past assessment summaries, dates, urgency |
| Assessment details | Symptoms reported, AI output, limitations, recommendations |
| Medication information | Saved educational references, if enabled |
| Find care | Nearby clinics and previously viewed facilities |
| Health profile | Optional information, allergies, current medicines |
| Reminders | User-configured follow-up or appointment reminders |
| Privacy and security | Consent, data export, deletion, active sessions |
| Account settings | Contact details, password, language, preferences |

**Never** label an AI assessment as a verified medical diagnosis in the patient's history.

## Additional patient features

- Downloadable assessment summary
- Shareable summary for a clinician, with patient-controlled sharing
- Follow-up symptom check-ins
- Appointment reminders
- Accessible layouts for mobile users and people with disabilities
- A clear distinction between **patient-reported** and **clinician-confirmed** information

## Rules (new)

- Every query is scoped by the authenticated `patientId`; ObjectIds are never an authorization mechanism.
- Health profile fields use the tri-state model (`yes/no/unknown`).
- Deletion of an assessment removes message content and the structured record; an audit event keeps only the resource ID and timestamp.
- Exported summaries include a header stating it is an AI-generated, unverified assessment.
