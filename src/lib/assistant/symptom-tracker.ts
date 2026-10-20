import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { DEFAULT_RULESET_VERSION } from "@/lib/safety/rules-data";
import { SafetyResult, UrgencyTier } from "@/lib/safety/types";

export interface StructuredSymptom {
  name: string;
  onset?: string;
  duration?: string;
  severity?: "mild" | "moderate" | "severe" | "unknown";
  location?: string;
  isCorrection?: boolean;
}

export interface StructuredAssessmentData {
  id: string;
  ruleSetVersion: string;
  status: "in_progress" | "completed" | "escalated";
  symptoms: StructuredSymptom[];
  associatedSymptoms: string[];
  answeredQuestions: Record<string, string>;
  unansweredQuestions: string[];
  safetyState: SafetyResult;
  urgency: UrgencyTier;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpQuestionDefinition {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "free_text";
  options?: string[];
  category: "onset" | "duration" | "severity" | "location" | "associated";
}

// Clinician-reviewed general follow-up question definitions (safe & non-diagnostic)
export const STANDARD_FOLLOW_UPS: FollowUpQuestionDefinition[] = [
  {
    id: "symptom_duration",
    text: "How long have you been experiencing these symptoms?",
    type: "single_choice",
    options: ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
    category: "duration",
  },
  {
    id: "symptom_severity",
    text: "How would you describe the severity of your symptoms right now?",
    type: "single_choice",
    options: ["Mild (manageable)", "Moderate (interfering with activities)", "Severe (intense distress)", "Not sure"],
    category: "severity",
  },
  {
    id: "associated_fever_chills",
    text: "Do you also have a fever, chills, or sweating?",
    type: "single_choice",
    options: ["Yes", "No", "Not sure"],
    category: "associated",
  },
  {
    id: "associated_difficulty_breathing",
    text: "Are you having any difficulty breathing, shortness of breath, or chest tightness?",
    type: "single_choice",
    options: ["Yes", "No"],
    category: "associated",
  },
];

/**
 * Parses user text for onset, duration, and severity keywords safely.
 */
export function extractSymptomAttributes(text: string): {
  onset?: string;
  duration?: string;
  severity?: "mild" | "moderate" | "severe" | "unknown";
} {
  const lower = text.toLowerCase();
  let severity: "mild" | "moderate" | "severe" | "unknown" = "unknown";

  if (lower.includes("severe") || lower.includes("unbearable") || lower.includes("intense") || lower.includes("terrible")) {
    severity = "severe";
  } else if (lower.includes("moderate") || lower.includes("pretty bad") || lower.includes("medium")) {
    severity = "moderate";
  } else if (lower.includes("mild") || lower.includes("slight") || lower.includes("a little") || lower.includes("manageable")) {
    severity = "mild";
  }

  let duration: string | undefined;
  if (lower.includes("today") || lower.includes("this morning") || lower.includes("hours")) {
    duration = "Within 24 hours";
  } else if (lower.includes("yesterday") || lower.includes("1 day") || lower.includes("2 days") || lower.includes("3 days")) {
    duration = "1-3 days";
  } else if (lower.includes("week") || lower.includes("days ago")) {
    duration = "Several days";
  }

  return { duration, severity };
}

/**
 * Initializes a structured assessment object.
 */
export function createAssessmentState(initialSymptomText: string, id: string): StructuredAssessmentData {
  const safetyState = checkEmergencyRules({ text: initialSymptomText, symptoms: initialSymptomText });
  const attrs = extractSymptomAttributes(initialSymptomText);

  const initialSymptom: StructuredSymptom = {
    name: initialSymptomText.slice(0, 100),
    duration: attrs.duration,
    severity: attrs.severity,
  };

  const initialUrgency: UrgencyTier = safetyState.emergencyDetected
    ? "emergency"
    : safetyState.floor === "urgent"
    ? "urgent"
    : "routine";

  return {
    id,
    ruleSetVersion: DEFAULT_RULESET_VERSION,
    status: safetyState.emergencyDetected ? "escalated" : "in_progress",
    symptoms: [initialSymptom],
    associatedSymptoms: [],
    answeredQuestions: {},
    unansweredQuestions: STANDARD_FOLLOW_UPS.map((q) => q.id),
    safetyState,
    urgency: initialUrgency,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Updates structured assessment when the user provides an answer or correction.
 * Re-evaluates independent safety rules after every update.
 */
export function updateAssessmentWithAnswer(
  currentState: StructuredAssessmentData,
  questionId: string,
  answer: string
): StructuredAssessmentData {
  const updatedAnswers = {
    ...currentState.answeredQuestions,
    [questionId]: answer,
  };

  const updatedUnanswered = currentState.unansweredQuestions.filter((id) => id !== questionId);

  // Check if answer contains a correction (e.g. "actually", "correction", "not 2 days, 5 days")
  const isCorrection = /actually|correction|instead of|mistake|mean to say/i.test(answer);

  const updatedSymptoms = [...currentState.symptoms];
  const attrs = extractSymptomAttributes(answer);

  if (attrs.severity && attrs.severity !== "unknown") {
    if (updatedSymptoms.length > 0) {
      updatedSymptoms[0] = {
        ...updatedSymptoms[0],
        severity: attrs.severity,
        isCorrection: isCorrection || updatedSymptoms[0].isCorrection,
      };
    }
  }

  if (attrs.duration) {
    if (updatedSymptoms.length > 0) {
      updatedSymptoms[0] = {
        ...updatedSymptoms[0],
        duration: attrs.duration,
        isCorrection: isCorrection || updatedSymptoms[0].isCorrection,
      };
    }
  }

  // Combine all texts for deterministic safety re-evaluation
  const allTexts = [
    ...currentState.symptoms.map((s) => s.name),
    ...Object.values(updatedAnswers),
    answer,
  ].join(" ");

  const reevaluatedSafety = checkEmergencyRules({
    text: allTexts,
    symptoms: currentState.symptoms.map((s) => s.name).join(", "),
  });

  const isEmergency = reevaluatedSafety.emergencyDetected;

  const newUrgency: UrgencyTier = isEmergency
    ? "emergency"
    : reevaluatedSafety.floor === "urgent"
    ? "urgent"
    : currentState.urgency;

  return {
    ...currentState,
    answeredQuestions: updatedAnswers,
    unansweredQuestions: updatedUnanswered,
    symptoms: updatedSymptoms,
    safetyState: reevaluatedSafety,
    status: isEmergency ? "escalated" : currentState.status,
    urgency: newUrgency,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns the next unanswered follow-up question, or null if enough info is collected.
 */
export function getNextFollowUpQuestion(
  assessment: StructuredAssessmentData
): FollowUpQuestionDefinition | null {
  // If emergency is triggered, stop asking questions immediately
  if (assessment.status === "escalated" || assessment.safetyState.emergencyDetected) {
    return null;
  }

  // Check unanswered questions against STANDARD_FOLLOW_UPS
  for (const qId of assessment.unansweredQuestions) {
    if (!assessment.answeredQuestions[qId]) {
      const q = STANDARD_FOLLOW_UPS.find((def) => def.id === qId);
      if (q) return q;
    }
  }

  return null;
}
