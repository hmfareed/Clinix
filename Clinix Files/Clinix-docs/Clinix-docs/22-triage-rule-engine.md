# 22 — Triage Rule Engine Specification (new)

The rule engine is the **independent safety engine**. It must run without the LLM and contain only clinician-reviewed content. The contents below define the *mechanism*; the actual rules, wording and timeframes come from a qualified clinician.

## Responsibilities

1. Detect emergency warning signs in patient text and structured answers.
2. Assign a minimum urgency floor.
3. Produce approved patient-facing emergency messages and steps.
4. Re-check after AI generation so the model can never lower urgency.

## Rule format

```ts
type TriageRule = {
  id: string;                 // e.g. "EM-RESP-001"
  version: string;
  level: 1 | 2 | 3;           // urgency floor this rule enforces
  category: string;           // "respiratory" | "neurological" | ...
  patterns: {
    keywords: string[];       // normalized, lowercase
    phrases: string[];        // local phrasing, misspellings
    structured?: Array<{ field: string; op: "eq"|"gte"|"lte"; value: unknown }>;
  };
  appliesTo?: { minAge?: number; maxAge?: number };
  patientMessageKey: string;  // reviewed content key
  nextStepsKey: string;
  reviewedBy: string;
  reviewedAt: string;         // ISO date
};
```

## Evaluation order

1. Normalize input (lowercase, trim, strip punctuation, basic spelling variants).
2. Evaluate all rules; collect matches.
3. `urgency floor` = minimum level among matches (level 1 is most severe).
4. If any level 1 → `emergencyDetected = true`; stop normal interview.
5. Return matches, floor, and approved messages.

```ts
type SafetyResult = {
  emergencyDetected: boolean;
  floor: "emergency" | "urgent" | "routine" | null;
  matchedRuleIds: string[];
  patientMessage: string;
  nextSteps: string[];
  ruleSetVersion: string;
};
```

## Post-generation gate

```ts
enforceSafetyGate(input, aiAssessment):
  1. safety = checkEmergencyRules(entireConversation + aiAssessment text)
  2. if safety.emergencyDetected -> return emergency assessment
  3. urgency = stricter(aiAssessment.urgency, safety.floor)
  4. if aiAssessment.urgency == "self_care_eligible" and any unknown critical field
        -> downgrade to "insufficient_information" or "routine"
  5. if medicationGuidance.available and critical patient fields unknown
        -> available = false, requiresProfessionalReview = true
  6. return validated assessment
```

## Governance

- Rule sets are stored in `triageRuleSets`, versioned, with reviewer and approval date.
- Only an approved, active version loads; if loading fails, a bundled last-known-good set is used and an alert fires.
- Every assessment stores `ruleSetVersion`.
- Limitations: keyword rules miss novel phrasing. The suite in [17](17-testing-and-validation.md) must include paraphrases, and false negatives are treated as critical incidents.
