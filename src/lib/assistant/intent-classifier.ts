import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { AssistantState } from "@/models/AssistantConversation";

export type AssistantIntent =
  | "symptom_assessment"
  | "general_health_information"
  | "medication_information"
  | "clinic_search"
  | "emergency_assistance"
  | "assessment_follow_up"
  | "unsupported_request"
  | "clarification_required";

export interface IntentClassificationResult {
  intent: AssistantIntent;
  confidence: number;
  emergencyTriggered: boolean;
  matchedKeywords?: string[];
  rationale: string;
}

const EMERGENCY_TERMS = [
  "cannot breathe",
  "can't breathe",
  "cant breathe",
  "shortness of breath",
  "struggling to breathe",
  "chest pain",
  "heart attack",
  "cardiac arrest",
  "stroke",
  "facial drooping",
  "slurred speech",
  "sudden numbness",
  "unconscious",
  "passed out",
  "unresponsive",
  "coughing blood",
  "vomiting blood",
  "severe bleeding",
  "bleeding heavily",
  "anaphylaxis",
  "throat swelling",
  "blue lips",
  "cyanosis",
  "seizure",
  "convulsion",
  "head injury unconscious",
];

const CLINIC_SEARCH_TERMS = [
  "clinic",
  "hospital",
  "pharmacy",
  "doctor near",
  "health center",
  "health centre",
  "emergency room",
  "er near",
  "urgent care",
  "find care",
  "nearest hospital",
  "nearest clinic",
  "medical facility",
  "chemist",
  "drugstore",
  "dispensary",
];

const MEDICATION_TERMS = [
  "medication",
  "medicine",
  "drug",
  "pill",
  "tablet",
  "syrup",
  "paracetamol",
  "ibuprofen",
  "amoxicillin",
  "artemether",
  "lumefantrine",
  "cetirizine",
  "aspirin",
  "ors",
  "oral rehydration",
  "antibiotic",
  "antimalarial",
  "painkiller",
  "side effects of",
  "dosage",
  "interaction between",
  "can i take",
];

const GENERAL_HEALTH_QUESTIONS = [
  "what is",
  "what are",
  "explain",
  "how does",
  "tell me about",
  "difference between",
  "why do people get",
  "prevention of",
  "definition of",
  "causes of",
];

const SYMPTOM_VERBS_AND_TERMS = [
  "feel",
  "hurts",
  "pain",
  "ache",
  "fever",
  "cough",
  "sore",
  "swelling",
  "rash",
  "dizzy",
  "nausea",
  "vomit",
  "diarrhea",
  "fatigue",
  "tired",
  "burning",
  "itching",
  "stomach",
  "headache",
  "chills",
  "cramps",
  "weakness",
  "stiff neck",
  "congestion",
];

const UNSUPPORTED_TOPICS = [
  "crypto",
  "bitcoin",
  "stock market",
  "coding",
  "programming",
  "python script",
  "javascript",
  "homework",
  "recipe for cake",
  "weather forecast",
  "translate this",
  "car repair",
];

/**
 * Classifies patient input into a validated intent category.
 * Independent safety screening runs first to ensure emergencies are never delayed.
 */
export function classifyIntent(
  message: string,
  currentState: AssistantState = "idle",
  hasActiveAssessment: boolean = false
): IntentClassificationResult {
  const clean = message.trim();
  const lower = clean.toLowerCase();

  // 1. Independent Deterministic Safety Screen
  const emergencyCheck = checkEmergencyRules({ text: clean, symptoms: clean });
  const hasEmergencyKeyword = EMERGENCY_TERMS.some((term) => lower.includes(term));

  if (emergencyCheck.emergencyDetected || hasEmergencyKeyword) {
    return {
      intent: "emergency_assistance",
      confidence: 1.0,
      emergencyTriggered: true,
      matchedKeywords: emergencyCheck.matchedRuleIds.length > 0 ? emergencyCheck.matchedRuleIds : ["emergency_phrase"],
      rationale: "Triggered by independent clinical emergency safety rules or high-risk keywords.",
    };
  }

  // 2. Empty or extremely short ambiguous message
  if (clean.length < 2) {
    return {
      intent: "clarification_required",
      confidence: 0.9,
      emergencyTriggered: false,
      rationale: "Message too short to determine intent.",
    };
  }

  // 3. Conversation Follow-up (If currently in question/screening state)
  if (
    hasActiveAssessment &&
    (currentState === "asking_questions" || currentState === "screening" || currentState === "collecting_symptoms")
  ) {
    const isExplicitNewTopic =
      CLINIC_SEARCH_TERMS.some((t) => lower.includes(t)) ||
      UNSUPPORTED_TOPICS.some((t) => lower.includes(t));

    if (!isExplicitNewTopic) {
      return {
        intent: "assessment_follow_up",
        confidence: 0.85,
        emergencyTriggered: false,
        rationale: "User is responding to an ongoing assessment question.",
      };
    }
  }

  // 4. Unsupported / Out-of-scope non-health topics
  if (UNSUPPORTED_TOPICS.some((topic) => lower.includes(topic))) {
    return {
      intent: "unsupported_request",
      confidence: 0.95,
      emergencyTriggered: false,
      rationale: "Topic is non-health related.",
    };
  }

  // 5. Clinic / Facility Search
  if (CLINIC_SEARCH_TERMS.some((term) => lower.includes(term))) {
    return {
      intent: "clinic_search",
      confidence: 0.9,
      emergencyTriggered: false,
      rationale: "Matched facility discovery keywords.",
    };
  }

  // 6. Medication Information
  if (MEDICATION_TERMS.some((term) => lower.includes(term))) {
    return {
      intent: "medication_information",
      confidence: 0.85,
      emergencyTriggered: false,
      rationale: "Matched verified medication reference keywords.",
    };
  }

  // 7. General Health Questions (Educational queries without personal symptoms)
  const isGeneralQuestionPattern = GENERAL_HEALTH_QUESTIONS.some((q) => lower.startsWith(q) || lower.includes(` ${q}`));
  const hasFirstPersonPronoun = /\b(i|i'm|my|me|we|i've|ive)\b/i.test(lower);

  if (isGeneralQuestionPattern && !hasFirstPersonPronoun) {
    return {
      intent: "general_health_information",
      confidence: 0.85,
      emergencyTriggered: false,
      rationale: "Educational health question without personal symptom report.",
    };
  }

  // 8. Symptom Assessment
  if (
    SYMPTOM_VERBS_AND_TERMS.some((sym) => lower.includes(sym)) ||
    hasFirstPersonPronoun
  ) {
    return {
      intent: "symptom_assessment",
      confidence: 0.85,
      emergencyTriggered: false,
      rationale: "Identified symptom description or first-person health concern.",
    };
  }

  // 9. Ambiguous or greeting
  const isGreeting = ["hello", "hi", "hey", "good morning", "good evening", "good afternoon"].some((g) =>
    lower.startsWith(g)
  );

  if (isGreeting) {
    return {
      intent: "clarification_required",
      confidence: 0.9,
      emergencyTriggered: false,
      rationale: "Greeting or conversational opener requires clarifying intent.",
    };
  }

  return {
    intent: "clarification_required",
    confidence: 0.6,
    emergencyTriggered: false,
    rationale: "Request does not clearly match supported workflows.",
  };
}
