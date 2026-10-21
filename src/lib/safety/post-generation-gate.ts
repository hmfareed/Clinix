import {
  PatientSafetyInput,
  GeneratedAssessmentOutput,
  UrgencyTier,
  UrgencyFloor,
} from "./types";
import { checkEmergencyRules } from "./triage-engine";
import { DEFAULT_RULESET_VERSION } from "./rules-data";

const URGENCY_SEVERITY: Record<UrgencyTier, number> = {
  emergency: 1,
  urgent: 2,
  routine: 3,
  self_care_eligible: 4,
  insufficient_information: 5,
};

export function getStricterUrgency(
  aiUrgency: UrgencyTier,
  safetyFloor: UrgencyFloor
): UrgencyTier {
  if (!safetyFloor) return aiUrgency;

  const aiRank = URGENCY_SEVERITY[aiUrgency] ?? 5;
  const floorRank = URGENCY_SEVERITY[safetyFloor] ?? 5;

  // Stricter urgency has lower numerical rank (1 = emergency is most strict)
  return aiRank <= floorRank ? aiUrgency : safetyFloor;
}

export function hasUnknownCriticalClinicalFields(input: PatientSafetyInput): boolean {
  // 1. Age must be known
  if (input.age === undefined || input.age === null) {
    return true;
  }

  // 2. Allergies status must not be "unknown"
  if (!input.allergies || input.allergies.status === "unknown") {
    return true;
  }

  // 3. Current medicines status must not be "unknown"
  if (!input.currentMedicines || input.currentMedicines.status === "unknown") {
    return true;
  }

  // 4. Pregnancy status check if applicable (e.g. reproductive age)
  if (input.pregnancy === "unknown") {
    return true;
  }

  return false;
}

export function enforceSafetyGate(
  input: PatientSafetyInput,
  aiAssessment: GeneratedAssessmentOutput,
  ruleSetVersion: string = DEFAULT_RULESET_VERSION
): GeneratedAssessmentOutput {
  // 1. Safety check over the entire conversation + generated AI text
  const combinedText = [
    input.text,
    input.symptoms,
    aiAssessment.summary,
    aiAssessment.message,
    ...aiAssessment.possibleConditions.map((c) => `${c.name} ${c.explanation}`),
  ]
    .filter(Boolean)
    .join(" ");

  const safety = checkEmergencyRules({ ...input, text: combinedText });

  // 2. If safety engine detects emergency, return immediate emergency assessment
  if (safety.emergencyDetected) {
    return {
      ...aiAssessment,
      urgency: "emergency",
      urgencyLevel: "emergency",
      summary: safety.patientMessage,
      message: safety.patientMessage,
      reply: safety.patientMessage,
      possibleConditions: [],
      possibleCauses: [],
      followUpQuestions: [],
      recommendedNextSteps: safety.nextSteps,
      nextSteps: safety.nextSteps,
      redFlags: ["Critical emergency warning signs detected — immediate 112 emergency response required."],
      medicationGuidance: {
        available: false,
        explanation:
          "Do not delay emergency care to seek medication information. Immediate in-person evaluation is required.",
        requiresProfessionalReview: true,
      },
      limitations: [
        "Emergency warning signs were identified by the clinical safety engine.",
        "This assessment is not a confirmed diagnosis. Immediate medical care is necessary.",
      ],
      triage: {
        level: "emergency",
        ruleSetVersion: safety.ruleSetVersion,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  // 3. Urgency = stricter between AI-generated urgency and safety floor
  let finalUrgency = getStricterUrgency(aiAssessment.urgency, safety.floor);

  // 4. Tri-State Constraint:
  // If urgency is "self_care_eligible" but critical clinical fields are unknown,
  // downgrade to "insufficient_information" or "routine"
  const missingCritical = hasUnknownCriticalClinicalFields(input);
  if (finalUrgency === "self_care_eligible" && missingCritical) {
    finalUrgency = "insufficient_information";
  }

  // 5. Medication Guidance Safeguard:
  // If medication guidance is available but critical patient fields are unknown,
  // revoke availability and require professional review.
  const medicationGuidance = { ...aiAssessment.medicationGuidance };
  if (medicationGuidance.available && missingCritical) {
    medicationGuidance.available = false;
    medicationGuidance.requiresProfessionalReview = true;
    medicationGuidance.explanation =
      "Suitability cannot be assessed because critical clinical information (such as age, known allergies, or current medicines) is unknown. Please consult a pharmacist or clinician.";
  }

  // 6. Return validated assessment with mandatory limitation disclaimer
  const limitations: string[] = [...(aiAssessment.limitations || [])];
  if (!limitations.some((l) => l.toLowerCase().includes("not a confirmed diagnosis"))) {
    limitations.unshift("This assessment provides clinical triage guidance and is not a confirmed medical diagnosis.");
  }

  return {
    ...aiAssessment,
    urgency: finalUrgency,
    urgencyLevel: finalUrgency,
    medicationGuidance,
    limitations,
    triage: {
      level: finalUrgency,
      ruleSetVersion: safety.ruleSetVersion || ruleSetVersion,
      checkedAt: new Date().toISOString(),
    },
  };
}
