# 07 — Medication Guidance and Safety

This module needs stricter controls than an ordinary AI answer. **Defer it past the MVP** unless approved reference sources and clinical review are in place.

## What the module should provide

1. General information about medicines and their intended uses
2. Common side effects and important warnings from approved references
3. Known interactions, where supported by a reliable, maintained data source
4. Reminders to check active ingredient, strength and formulation
5. Warnings about allergies and relevant conditions
6. Advice to consult a pharmacist or clinician when suitability is uncertain
7. A route to professional care when symptoms need examination or treatment

## What it must not do

- Prescribe a medicine solely from a symptom description
- Invent a dosage or treatment duration
- Recommend antibiotics or other prescription-only medicines without appropriate clinical authorization
- Treat missing age, pregnancy or allergy information as a negative answer
- Recommend stopping prescribed treatment without professional advice
- Suggest a medicine to delay or replace emergency treatment

## Data flow

```
Patient asks about a medicine
  → Identify medicine, strength, formulation
  → Retrieve from an approved, maintained source
  → Check known risks and missing patient information
  → Return bounded information OR refer to pharmacist/clinician
```

## Reference sources

Candidates: official medicine product information, and a licensed drug-interaction or medication knowledge service. Before selecting one, confirm coverage, update frequency, licensing and **Ghanaian relevance** (locally available brands and the Ghana FDA register).

Keep medication reference data **separate from the language model**. The model explains verified information; it does not manufacture the underlying facts.

## Response types allowed (new)

| Type | Allowed? |
|---|---|
| General information about a named medicine from an approved source | Yes |
| Interaction warning from a maintained dataset | Yes |
| "Ask a pharmacist about X" referral | Yes |
| Specific dose for this patient | No (until a clinically approved dosing module exists) |
| Prescription-only medicine recommendation | No |
| Any medicine suggestion when emergency rules fired | No |

## Missing-information handling

If age, pregnancy status, allergies or current medicines are `unknown`, the response must state that suitability cannot be assessed and refer to a pharmacist or clinician.
