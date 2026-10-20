import {
  TriageRule,
  SafetyResult,
  PatientSafetyInput,
  UrgencyFloor,
  UrgencyLevel,
} from "./types";
import {
  REVIEWED_TRIAGE_RULES,
  PATIENT_MESSAGES,
  NEXT_STEPS_CATALOG,
  DEFAULT_RULESET_VERSION,
} from "./rules-data";

const TYPO_MAP: Record<string, string> = {
  "shrot": "short",
  "breth": "breath",
  "breatheing": "breathing",
  "hart": "heart",
  "unconcious": "unconscious",
  "unresponsive": "unresponsive",
  "bleedng": "bleeding",
  "seisure": "seizure",
  "asfixia": "asphyxia",
  "cyanosis": "cyanosis",
  "diffcult": "difficult",
  "cpr": "cpr",
  "infarction": "infarction",
};

export function normalizeClinicalText(rawText: string): string {
  if (!rawText) return "";

  // 1. Lowercase and normalize whitespace
  let text = rawText.toLowerCase().trim();

  // 2. Replace punctuation with spaces
  text = text.replace(/[^a-z0-9\s]/g, " ");

  // 3. Fix common typos
  const words = text.split(/\s+/).filter(Boolean);
  const normalizedWords = words.map((w) => TYPO_MAP[w] || w);

  return normalizedWords.join(" ");
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let curr: unknown = obj;

  for (const part of parts) {
    if (curr && typeof curr === "object" && part in curr) {
      curr = (curr as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return curr;
}

function evaluateStructuredRule(
  rule: TriageRule,
  input: PatientSafetyInput
): boolean {
  if (!rule.patterns.structured || rule.patterns.structured.length === 0) {
    return false;
  }

  for (const cond of rule.patterns.structured) {
    const value = getNestedValue(input, cond.field);
    if (value === undefined || value === null) {
      return false; // Condition cannot be satisfied if field is missing
    }

    if (cond.op === "eq" && value !== cond.value) return false;
    if (cond.op === "gte" && Number(value) < Number(cond.value)) return false;
    if (cond.op === "lte" && Number(value) > Number(cond.value)) return false;
  }

  return true;
}

export function evaluateRule(
  rule: TriageRule,
  normalizedText: string,
  input: PatientSafetyInput
): boolean {
  // Check age constraints
  if (rule.appliesTo?.minAge !== undefined) {
    if (input.age === undefined || input.age < rule.appliesTo.minAge) {
      return false;
    }
  }
  if (rule.appliesTo?.maxAge !== undefined) {
    if (input.age === undefined || input.age > rule.appliesTo.maxAge) {
      return false;
    }
  }

  // Check structured vitals / fields
  if (evaluateStructuredRule(rule, input)) {
    return true;
  }

  if (!normalizedText) {
    return false;
  }

  // Check keywords (word boundary matching)
  for (const kw of rule.patterns.keywords) {
    const cleanKw = kw.toLowerCase().trim();
    const regex = new RegExp(`\\b${cleanKw}\\b`, "i");
    if (regex.test(normalizedText)) {
      return true;
    }
  }

  // Check phrases
  for (const phrase of rule.patterns.phrases) {
    const cleanPhrase = normalizeClinicalText(phrase);
    if (cleanPhrase && normalizedText.includes(cleanPhrase)) {
      return true;
    }
  }

  return false;
}

export function checkEmergencyRules(
  input: PatientSafetyInput,
  rules: TriageRule[] = REVIEWED_TRIAGE_RULES,
  ruleSetVersion: string = DEFAULT_RULESET_VERSION
): SafetyResult {
  const combinedText = [input.text, input.symptoms].filter(Boolean).join(" ");
  const normalizedText = normalizeClinicalText(combinedText);

  const matchedRules: TriageRule[] = [];

  for (const rule of rules) {
    if (evaluateRule(rule, normalizedText, input)) {
      matchedRules.push(rule);
    }
  }

  if (matchedRules.length === 0) {
    return {
      emergencyDetected: false,
      floor: null,
      matchedRuleIds: [],
      patientMessage: "",
      nextSteps: [],
      ruleSetVersion,
    };
  }

  // Urgency floor = minimum level among matches (1 is most severe)
  const minLevel = Math.min(...matchedRules.map((r) => r.level)) as UrgencyLevel;

  // Highest severity rule determines primary message
  const priorityRule = matchedRules.find((r) => r.level === minLevel) || matchedRules[0];

  const floor: UrgencyFloor =
    minLevel === 1 ? "emergency" : minLevel === 2 ? "urgent" : "routine";

  const emergencyDetected = minLevel === 1;

  const patientMessage =
    PATIENT_MESSAGES[priorityRule.patientMessageKey] ||
    PATIENT_MESSAGES.default_emergency;

  const nextSteps =
    NEXT_STEPS_CATALOG[priorityRule.nextStepsKey] ||
    NEXT_STEPS_CATALOG.emergency_steps;

  return {
    emergencyDetected,
    floor,
    matchedRuleIds: matchedRules.map((r) => r.id),
    patientMessage,
    nextSteps,
    ruleSetVersion,
  };
}
