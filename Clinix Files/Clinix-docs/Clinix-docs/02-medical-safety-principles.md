# 02 — Medical Safety Principles

Safety is part of the architecture, not an instruction appended to a chatbot prompt. The WHO guidance on AI for health emphasizes human rights, accountability, safety and appropriate oversight.

## Rules the system must follow

1. **Possible conditions, not definitive diagnoses.** The AI may explain plausible causes but must never claim to confirm a disease from a conversation alone.
2. **Emergency detection takes priority.** Serious warning signs trigger an emergency response without waiting for a lengthy interview.
3. **No automatic prescriptions.** Medication information is limited to validated, locally appropriate guidance and must account for age, allergies, pregnancy, existing medicines and other relevant risks.
4. **No fabricated certainty.** The system must be allowed to say it cannot safely assess a case.
5. **Human professionals remain essential.** Decisions requiring clinical expertise are referred to qualified professionals.
6. **Privacy by design.** Health information is sensitive data, protected through collection, storage, processing and deletion.

## Engineering consequences

| Principle | What it forces in the codebase |
|---|---|
| Emergency priority | Rule engine runs before the LLM call **and** after it; the stricter result wins |
| No fabricated certainty | `insufficient_information` is a valid urgency value; AI failure never becomes a reassuring result |
| Unknown is not "no" | Every clinical field is tri-state: `yes`, `no`, `unknown` |
| No false probabilities | Never show a percentage such as "92% chance of malaria" unless it comes from a clinically validated, calibrated model |
| Narrow AI permissions | The model gets no direct database, internet or tool access; only narrow, permission-checked functions |
| Reference data separate from the model | The model explains verified information; it does not manufacture the facts |
| Quick disable | Feature flags can turn off a model, rule set or module immediately |

## Limits of the NVIDIA-hosted model

A general-purpose hosted language model alone is not sufficient to validate a clinical decision system. A real-world launch needs:

- Clinical review of rules and content
- Testing against representative cases
- A defined intended use
- Assessment of applicable healthcare and medical-device regulations

## Safety invariants (must hold in every release)

- An AI output can never downgrade a rule-engine emergency.
- A failed, malformed or timed-out AI call never produces a "you're fine" message.
- The emergency call action is reachable even if the AI, database or maps provider is down.
- The app never states that an ambulance was dispatched unless a verified dispatch integration exists.
- Assessments are never labeled as verified diagnoses anywhere in the UI or stored history.
