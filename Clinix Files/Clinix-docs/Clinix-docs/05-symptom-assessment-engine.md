# 05 — AI Symptom Assessment Engine

The central feature. Example input:

> "I've had a headache since yesterday, and I feel dizzy whenever I stand up."

The AI must not jump to one disease. It first checks for emergency symptoms, gathers relevant information, then presents possible explanations and appropriate next steps.

## 5.1 Conversation flow

1. **Capture the initial complaint.** Save the original statement, session ID and timestamp.
2. **Run an emergency safety check.** Apply a reviewed set of emergency warning-sign rules before generating ordinary advice.
3. **Ask follow-up questions.** Onset, duration, severity, progression, associated symptoms, relevant medical context.
4. **Check sufficiency.** If critical information is missing, ask targeted questions. Never invent missing facts.
5. **Generate a differential assessment.** Plausible explanations, important alternatives, uncertainty, supporting information.
6. **Apply clinical and medication safeguards.** Validate urgency, contraindications and allowed response types independently of the generated prose.
7. **Present the result.** Urgency, next action, possible causes, limitations, relevant facilities.
8. **Save if permitted.** Structured record, reviewable later if signed in and consented.

## 5.2 Information to collect

| Category | Information |
|---|---|
| Primary symptoms | What the patient is experiencing |
| Onset | When it started and whether it was sudden |
| Duration | How long each symptom lasts |
| Severity | Patient-reported severity and effect on daily activities |
| Progression | Improving, stable or worsening |
| Associated symptoms | Other symptoms relevant to the complaint |
| Age | Important for children, older adults and medicine safety |
| Medical history | Relevant diagnosed conditions, if voluntarily provided |
| Allergies | Known allergies and previous reactions |
| Current medicines | Prescriptions, OTC medicines, supplements |
| Pregnancy status | Only where clinically relevant, with appropriate privacy |
| Measurements | Temperature, pulse, blood pressure or other readings |
| Location | Country or region for localized care and guidance |

**Tri-state rule:** every clinical field is `yes | no | unknown`. An unanswered allergy question must never be treated as "no allergies".

```ts
type TriState = "yes" | "no" | "unknown";
```

## 5.3 Triage categories

Categories are defined by clinician-reviewed rules, not invented by the language model.

| Level | Name | Behavior |
|---|---|---|
| 1 | Emergency now | Stop the interview. Show emergency instructions and a prominent call action. Examples: severe breathing difficulty, suspected stroke, loss of consciousness, severe chest pain (not exhaustive). |
| 2 | Urgent assessment | Prompt professional evaluation. Direct to an appropriate urgent service per a validated protocol. |
| 3 | Routine medical review | Recommend a reasonable timeframe based on reviewed guidance. |
| 4 | General self-care information may be appropriate | Conservative educational info plus clear instructions on when to seek care. **Never** used when warning signs or material uncertainty remain. |

These are product-level categories, not a validated clinical protocol. A qualified clinician must approve the actual rules, timeframes and criteria. See [22](22-triage-rule-engine.md).

### Mapping to the schema enum

| Level | `urgency` value |
|---|---|
| 1 | `emergency` |
| 2 | `urgent` |
| 3 | `routine` |
| 4 | `self_care_eligible` |
| none yet | `insufficient_information` |

## 5.4 Result interface

- **Urgency** — the care category, shown first
- **What you reported** — short, editable summary
- **Possible explanations** — plausible conditions with reasons and important alternatives
- **What remains uncertain** — missing information and limitations
- **Recommended next step** — emergency assistance, professional assessment, or bounded self-care
- **Medication information** — only when it can be provided safely
- **Nearby care** — relevant facilities and verified contacts
- **Actions** — save, print or export a summary, find a clinic, contact emergency services

Never present a percentage probability unless it comes from a clinically validated, calibrated model for the exact intended use. LLM confidence is not medical probability.

## 5.5 Conversation limits (new)

- Maximum follow-up rounds per session (suggested: 6) before the system concludes with the best available guidance or `insufficient_information` plus a referral.
- Every turn re-runs the emergency rules on the **entire** conversation, not just the latest message.
- The patient can stop at any time; stopping shows the current safest recommendation.
- Out-of-scope requests (e.g. "write me a prescription") get a fixed refusal template, not a model improvisation.
