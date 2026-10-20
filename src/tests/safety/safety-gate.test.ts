import { describe, it, expect } from "vitest";
import {
  enforceSafetyGate,
  getStricterUrgency,
  hasUnknownCriticalClinicalFields,
} from "@/lib/safety/post-generation-gate";
import { GeneratedAssessmentOutput, PatientSafetyInput } from "@/lib/safety/types";

describe("Safety Gate - Stricter Urgency Invariant", () => {
  it("never allows downgrading an emergency floor", () => {
    expect(getStricterUrgency("routine", "emergency")).toBe("emergency");
    expect(getStricterUrgency("self_care_eligible", "emergency")).toBe("emergency");
    expect(getStricterUrgency("urgent", "emergency")).toBe("emergency");
    expect(getStricterUrgency("insufficient_information", "emergency")).toBe("emergency");
  });

  it("escalates self-care and routine when urgent floor is detected", () => {
    expect(getStricterUrgency("self_care_eligible", "urgent")).toBe("urgent");
    expect(getStricterUrgency("routine", "urgent")).toBe("urgent");
    expect(getStricterUrgency("urgent", "routine")).toBe("urgent");
  });

  it("escalates self-care when routine floor is detected", () => {
    expect(getStricterUrgency("self_care_eligible", "routine")).toBe("routine");
  });
});

describe("Safety Gate - Tri-State Unknown Clinical Fields", () => {
  it("identifies missing critical fields correctly", () => {
    // Missing age
    expect(
      hasUnknownCriticalClinicalFields({
        allergies: { status: "no" },
        currentMedicines: { status: "no" },
        pregnancy: "not_applicable",
      })
    ).toBe(true);

    // Unknown allergies
    expect(
      hasUnknownCriticalClinicalFields({
        age: 30,
        allergies: { status: "unknown" },
        currentMedicines: { status: "no" },
        pregnancy: "no",
      })
    ).toBe(true);

    // Complete fields
    expect(
      hasUnknownCriticalClinicalFields({
        age: 30,
        allergies: { status: "yes", items: ["Penicillin"] },
        currentMedicines: { status: "no" },
        pregnancy: "no",
      })
    ).toBe(false);
  });
});

describe("Safety Gate - enforceSafetyGate Function", () => {
  const baseAiAssessment: GeneratedAssessmentOutput = {
    summary: "You may have a mild viral infection.",
    urgency: "routine",
    possibleConditions: [
      {
        name: "Common Cold",
        explanation: "Mild upper respiratory viral syndrome.",
        supportingSymptoms: ["sneezing"],
        missingInformation: [],
      },
    ],
    followUpQuestions: ["How long have you had this?"],
    recommendedNextSteps: ["Drink fluids and rest."],
    medicationGuidance: {
      available: true,
      explanation: "Paracetamol may help with mild discomfort.",
      requiresProfessionalReview: false,
    },
    limitations: [],
  };

  it("overrides AI when patient text triggers an emergency rule", () => {
    const input: PatientSafetyInput = {
      text: "I also have severe crushing chest pain radiating to left arm",
      age: 45,
      allergies: { status: "no" },
      currentMedicines: { status: "no" },
      pregnancy: "not_applicable",
    };

    const finalAssessment = enforceSafetyGate(input, baseAiAssessment);

    expect(finalAssessment.urgency).toBe("emergency");
    expect(finalAssessment.possibleConditions).toHaveLength(0);
    expect(finalAssessment.medicationGuidance.available).toBe(false);
    expect(finalAssessment.recommendedNextSteps[0]).toContain("112");
  });

  it("catches emergency symptoms mentioned in AI generated text", () => {
    const input: PatientSafetyInput = {
      text: "Feeling bad today",
      age: 30,
      allergies: { status: "no" },
      currentMedicines: { status: "no" },
      pregnancy: "not_applicable",
    };

    const dangerousAiAssessment: GeneratedAssessmentOutput = {
      ...baseAiAssessment,
      summary: "Patient shows signs of severe cyanosis and suffocating",
    };

    const finalAssessment = enforceSafetyGate(input, dangerousAiAssessment);

    expect(finalAssessment.urgency).toBe("emergency");
    expect(finalAssessment.medicationGuidance.available).toBe(false);
  });

  it("downgrades self_care_eligible to insufficient_information when critical fields are unknown", () => {
    const input: PatientSafetyInput = {
      text: "Mild sneeze",
      // age is undefined
      allergies: { status: "unknown" },
    };

    const selfCareAiAssessment: GeneratedAssessmentOutput = {
      ...baseAiAssessment,
      urgency: "self_care_eligible",
    };

    const finalAssessment = enforceSafetyGate(input, selfCareAiAssessment);

    expect(finalAssessment.urgency).toBe("insufficient_information");
    expect(finalAssessment.medicationGuidance.available).toBe(false);
    expect(finalAssessment.medicationGuidance.requiresProfessionalReview).toBe(true);
  });

  it("preserves self_care_eligible only when all critical fields are fully known and safe", () => {
    const input: PatientSafetyInput = {
      text: "Mild seasonal sneeze with itchy eyes",
      age: 26,
      allergies: { status: "no" },
      currentMedicines: { status: "no" },
      pregnancy: "no",
    };

    const selfCareAiAssessment: GeneratedAssessmentOutput = {
      ...baseAiAssessment,
      urgency: "self_care_eligible",
    };

    const finalAssessment = enforceSafetyGate(input, selfCareAiAssessment);

    expect(finalAssessment.urgency).toBe("self_care_eligible");
  });

  it("always injects mandatory non-diagnosis limitation disclaimer", () => {
    const input: PatientSafetyInput = {
      text: "Mild headache",
      age: 25,
      allergies: { status: "no" },
      currentMedicines: { status: "no" },
      pregnancy: "no",
    };

    const finalAssessment = enforceSafetyGate(input, {
      ...baseAiAssessment,
      limitations: [],
    });

    expect(
      finalAssessment.limitations.some((l) =>
        l.toLowerCase().includes("not a confirmed diagnosis") ||
        l.toLowerCase().includes("not a confirmed medical diagnosis")
      )
    ).toBe(true);
  });
});
