import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import Assessment from "@/models/Assessment";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import {
  detectSymptomPathway,
  getNextAdaptiveQuestion,
  hasEnoughInfoForEvaluation,
} from "@/lib/assistant/symptom-adaptive-questions";

// Mock mongodb connection to run in test isolation
vi.mock("@/lib/db/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
  tryConnectToDatabase: vi.fn().mockResolvedValue(true),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
}));

// Mock emergency configuration
vi.mock("@/lib/emergency/emergency-config", () => ({
  getEmergencyConfiguration: vi.fn().mockResolvedValue({
    countryCode: "GH",
    countryName: "Ghana",
    emergencyNumber: "112",
    serviceName: "National Ambulance Service",
    isVerified: true,
  }),
}));

describe("Full Patient Assessment Module", () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockAuthContext = { userId: mockUserId };

  describe("Symptom Pathway Detection & Adaptive Questions", () => {
    it("detects gastrointestinal pathway for abdominal pain and vomiting", () => {
      const pathway = detectSymptomPathway("I have severe stomach pain and vomiting");
      expect(pathway).toBe("gastrointestinal");
    });

    it("detects respiratory pathway for persistent cough and wheezing", () => {
      const pathway = detectSymptomPathway("I've been coughing and wheezing with a sore throat");
      expect(pathway).toBe("respiratory");
    });

    it("detects headache_neuro pathway for migraine and visual disturbances", () => {
      const pathway = detectSymptomPathway("Severe throbbing headache with blurry vision and dizziness");
      expect(pathway).toBe("headache_neuro");
    });

    it("returns next unanswered adaptive question in sequence", () => {
      const q1 = getNextAdaptiveQuestion("headache_neuro", []);
      expect(q1).not.toBeNull();
      expect(q1?.category).toBe("onset");

      const q2 = getNextAdaptiveQuestion("headache_neuro", [q1!.id]);
      expect(q2).not.toBeNull();
      expect(q2?.id).not.toBe(q1?.id);
    });

    it("verifies evaluation threshold is not met until required questions are answered", () => {
      // 0 questions answered
      expect(hasEnoughInfoForEvaluation("headache_neuro", [], 0)).toBe(false);

      // Only 1 question answered
      expect(hasEnoughInfoForEvaluation("headache_neuro", ["headache_onset"], 1)).toBe(false);
    });
  });

  describe("Independent Clinical Safety Screening", () => {
    it("immediately detects life-threatening chest pain with shortness of breath", () => {
      const check = checkEmergencyRules({
        text: "I have crushing chest pain radiating to my left arm and I can't breathe",
        symptoms: "Crushing chest pain radiating to my left arm",
      });

      expect(check.emergencyDetected).toBe(true);
      expect(check.matchedRuleIds.length).toBeGreaterThan(0);
      expect(check.patientMessage?.toLowerCase()).toContain("emergency");
    });

    it("immediately flags sudden explosive thunderclap headache with stiff neck", () => {
      const check = checkEmergencyRules({
        text: "Sudden worst headache of my life with fever and stiff neck",
        symptoms: "Worst headache of my life, stiff neck, fever",
      });

      expect(check.emergencyDetected).toBe(true);
    });

    it("treats routine headaches and vomiting without red flags as non-emergency", () => {
      const check = checkEmergencyRules({
        text: "I have a mild headache since yesterday morning and felt nauseous",
        symptoms: "Mild headache and nausea",
      });

      expect(check.emergencyDetected).toBe(false);
    });
  });

  describe("Assessment Service Operations & Lifecycles", () => {
    const testAssessmentId = new mongoose.Types.ObjectId().toString();
    let mockDoc: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockDoc = {
        _id: new mongoose.Types.ObjectId(testAssessmentId),
        patientId: new mongoose.Types.ObjectId(mockUserId),
        status: "draft",
        isDraft: true,
        primaryComplaint: {
          symptom: "Headache and vomiting",
          onset: "gradual",
          duration: "since_yesterday",
          severity: "moderate",
        },
        reportedFacts: {
          known: [{ label: "Primary Complaint", value: "Headache and vomiting", source: "patient" }],
          unknown: [{ label: "Allergies", reason: "Unknown" }],
        },
        interviewProgress: {
          currentStep: 2,
          pathway: "headache_neuro",
          answeredQuestions: [],
          currentQuestion: {
            id: "headache_severity",
            text: "How severe is the headache on a scale of 1 to 10?",
            type: "single_choice",
          },
        },
        symptoms: [{ description: "Headache and vomiting" }],
        urgency: "routine",
        summary: "Draft assessment in progress.",
        possibleConditions: [],
        recommendations: [],
        limitations: ["Assessment in progress."],
        triage: {
          level: "routine",
          ruleSetVersion: "1.0",
          checkedAt: new Date(),
        },
        aiMetadata: {
          provider: "NVIDIA",
          model: "test-model",
          promptVersion: "assessment-v1",
        },
        save: vi.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      vi.spyOn(Assessment, "findById").mockResolvedValue(mockDoc);
    });

    it("updates draft information and stores structured facts", async () => {
      const updated = await defaultFullAssessmentService.updateDraft(
        testAssessmentId,
        mockAuthContext,
        {
          primaryComplaint: {
            symptom: "Throbbing temporal headache",
            onset: "gradual",
            duration: "since_yesterday",
            severity: "moderate",
          },
          patientInfo: { age: 32 },
          medicalHistory: {
            allergies: { status: "yes", items: ["Penicillin"] },
            currentMedications: { status: "no", items: [] },
          },
          currentStep: 3,
        }
      );

      expect(updated.status).toBe("collecting_information");
      expect(updated.primaryComplaint?.symptom).toBe("Throbbing temporal headache");
      expect(updated.medicalHistory?.allergies?.items).toContain("Penicillin");
      expect(updated.reportedFacts?.known.some((f) => f.label === "Allergies")).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("escalates immediately when emergency warning signs are reported during draft update", async () => {
      const escalated = await defaultFullAssessmentService.updateDraft(
        testAssessmentId,
        mockAuthContext,
        {
          primaryComplaint: {
            symptom: "Sudden explosive thunderclap headache and I passed out",
            onset: "sudden",
            severity: "severe",
          },
          warningSignsReported: true,
        }
      );

      expect(escalated.status).toBe("escalated");
      expect(escalated.urgency).toBe("emergency");
      expect(escalated.isDraft).toBe(false);
      expect(escalated.recommendations[0]).toContain("112");
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("records interview answer and selects next adaptive question", async () => {
      const result = await defaultFullAssessmentService.submitInterviewAnswer(
        testAssessmentId,
        mockAuthContext,
        {
          answer: "The pain is about 6 out of 10, throbbing on one side of my forehead.",
          questionId: "headache_severity",
        }
      );

      expect(result.interviewProgress?.answeredQuestions.length).toBe(1);
      expect(result.interviewProgress?.answeredQuestions[0].answerText).toContain("6 out of 10");
      expect(result.symptoms.length).toBeGreaterThan(1);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("escalates immediately if patient reports emergency red flags in interview answer", async () => {
      const escalated = await defaultFullAssessmentService.submitInterviewAnswer(
        testAssessmentId,
        mockAuthContext,
        {
          answer: "Suddenly I have arm weakness and slurred speech",
          questionId: "headache_neuro_check",
        }
      );

      expect(escalated.status).toBe("escalated");
      expect(escalated.urgency).toBe("emergency");
      expect(escalated.isDraft).toBe(false);
      expect(escalated.recommendations[0]).toContain("112");
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("verifies authorization ownership blocks unauthorized users", async () => {
      const unauthorizedContext = { userId: new mongoose.Types.ObjectId().toString() };
      const doc = await Assessment.findById(testAssessmentId);
      expect(doc).not.toBeNull();

      await expect(
        defaultFullAssessmentService.verifyOwnership(doc!, unauthorizedContext)
      ).rejects.toThrow("permission");
    });
  });
});
