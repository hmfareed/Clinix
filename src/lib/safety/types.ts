export type UrgencyLevel = 1 | 2 | 3;

export type UrgencyTier =
  | "emergency"
  | "urgent"
  | "routine"
  | "self_care_eligible"
  | "insufficient_information";

export type UrgencyFloor = "emergency" | "urgent" | "routine" | null;

export type TriState = "yes" | "no" | "unknown";

export interface StructuredCondition {
  field: string;
  op: "eq" | "gte" | "lte";
  value: unknown;
}

export interface TriageRule {
  id: string; // e.g. "EM-RESP-001"
  version: string;
  level: UrgencyLevel; // 1 = emergency, 2 = urgent, 3 = routine
  category:
    | "respiratory"
    | "cardiovascular"
    | "neurological"
    | "trauma_hemorrhage"
    | "anaphylaxis"
    | "pediatric"
    | "toxicology"
    | "general";
  patterns: {
    keywords: string[]; // normalized, lowercase
    phrases: string[]; // local phrasing, misspellings, colloquialisms
    structured?: StructuredCondition[];
  };
  appliesTo?: {
    minAge?: number;
    maxAge?: number;
  };
  patientMessageKey: string;
  nextStepsKey: string;
  reviewedBy: string;
  reviewedAt: string; // ISO date
}

export interface SafetyResult {
  emergencyDetected: boolean;
  floor: UrgencyFloor;
  matchedRuleIds: string[];
  patientMessage: string;
  nextSteps: string[];
  ruleSetVersion: string;
}

export interface PatientSafetyInput {
  text?: string;
  symptoms?: string;
  age?: number;
  allergies?: { status: TriState; items?: string[] };
  currentMedicines?: { status: TriState; items?: string[] };
  pregnancy?: TriState | "not_applicable";
  vitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    temperatureC?: number;
    oxygenSaturation?: number;
  };
}

export interface GeneratedAssessmentOutput {
  summary: string;
  urgency: UrgencyTier;
  possibleConditions: Array<{
    name: string;
    explanation: string;
    supportingSymptoms: string[];
    missingInformation: string[];
  }>;
  followUpQuestions: string[];
  recommendedNextSteps: string[];
  medicationGuidance: {
    available: boolean;
    explanation: string;
    requiresProfessionalReview: boolean;
  };
  limitations: string[];
  triage?: {
    level: UrgencyTier;
    ruleSetVersion: string;
    checkedAt: string;
  };
}
