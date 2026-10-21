import { describe, it, expect, vi, beforeEach } from "vitest";
import { assessmentSchema } from "@/lib/medical/assessment-schema";
import { assessSymptoms } from "@/services/assessment-service";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { extractJson } from "@/lib/ai/extract-json";

// Mock audit logger so test runs in isolation without DB hang
vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
  hashIp: vi.fn().mockReturnValue("mocked-hash"),
}));

describe("Clinix AI Assistant - Response Quality and Chat Flow (Phase 8 Fixes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. NO EMPTY SECTION HEADINGS & STRUCTURED VALIDATION
  // =========================================================================
  describe("Empty Sections and Structured Schema Robustness", () => {
    it("never permits empty conditions or blank condition names in parsed output", () => {
      const rawInput = {
        summary: "Patient reports mild headache.",
        urgency: "routine",
        possibleConditions: [
          { name: "", explanation: "", supportingSymptoms: [] },
          { name: "Tension Headache", explanation: "Common primary headache.", supportingSymptoms: ["headache"] },
        ],
        followUpQuestions: ["How long have you had this?"],
        recommendedNextSteps: ["Rest in a quiet room."],
      };

      const parsed = assessmentSchema.parse(rawInput);

      // Blank condition must be filtered out
      expect(parsed.possibleConditions).toHaveLength(1);
      expect(parsed.possibleConditions[0].name).toBe("Tension Headache");
      expect(parsed.possibleConditions[0].condition).toBe("Tension Headache");
      expect(parsed.possibleCauses).toHaveLength(1);
    });

    it("ensures nextSteps and recommendedNextSteps are always populated with non-empty strings", () => {
      const rawInput = {
        message: "I hear you have stomach ache.",
        urgency: "routine",
        possibleCauses: [],
        nextSteps: ["", "  ", "Stay hydrated with small sips of water."],
      };

      const parsed = assessmentSchema.parse(rawInput);

      expect(parsed.nextSteps).toHaveLength(1);
      expect(parsed.nextSteps[0]).toBe("Stay hydrated with small sips of water.");
      expect(parsed.recommendedNextSteps).toEqual(parsed.nextSteps);
    });

    it("provides safe fallback next steps if input nextSteps array is completely empty", () => {
      const rawInput = {
        message: "Patient inquiry.",
        urgency: "routine",
        nextSteps: [],
        recommendedNextSteps: [],
      };

      const parsed = assessmentSchema.parse(rawInput);

      expect(parsed.nextSteps.length).toBeGreaterThan(0);
      expect(parsed.nextSteps[0]).toContain("healthcare professional");
    });

    it("ensures disclaimer and redFlags are always accessible and non-null", () => {
      const rawInput = {
        message: "Consultation note.",
        urgency: "routine",
        redFlags: ["Sudden severe headache", "Stiff neck"],
      };

      const parsed = assessmentSchema.parse(rawInput);

      expect(parsed.disclaimer).toBeTruthy();
      expect(parsed.disclaimer).toContain("not a confirmed");
      expect(parsed.redFlags).toHaveLength(2);
      expect(parsed.redFlags[0]).toBe("Sudden severe headache");
    });
  });

  // =========================================================================
  // 2. CONVERSATIONAL TONE & CLINICAL RESPONSE SEQUENCING
  // =========================================================================
  describe("Conversational Response Sequencing (Headache and Vomiting Pathway)", () => {
    it("produces an empathetic conversational acknowledgment with warning signs screening", async () => {
      const result = await assessSymptoms({
        symptoms: "I have a headache and vomiting since this morning",
      });

      // 1. Natural, empathetic acknowledgment
      expect(result.message).toBeTruthy();
      expect(result.message.toLowerCase()).toContain("headache and vomiting");
      expect(result.message.toLowerCase()).toContain("warning signs");

      // 2. Screens for serious warning signs (thunderclap, stiff neck, confusion)
      expect(result.message.toLowerCase()).toMatch(/thunderclap|stiff neck|confusion|weakness/i);

      // 3. Relevant, interactive follow-up questions
      expect(result.followUpQuestions.length).toBeGreaterThanOrEqual(2);
      const questionsText = result.followUpQuestions.join(" ").toLowerCase();
      expect(questionsText).toMatch(/thunderclap|stiff neck|fever|fluids|vomit/i);

      // 4. Prominent emergency warning signs (red flags)
      expect(result.redFlags.length).toBeGreaterThanOrEqual(3);
      const redFlagsText = result.redFlags.join(" ").toLowerCase();
      expect(redFlagsText).toMatch(/thunderclap|stiff neck|dehydration|confusion/i);

      // 5. Plausible explanations with clear uncertainty
      expect(result.possibleCauses.length).toBeGreaterThanOrEqual(2);
      expect(result.possibleCauses.some((c) => c.name.toLowerCase().includes("migraine"))).toBe(true);

      // 6. Actionable, cautious next steps
      expect(result.nextSteps.length).toBeGreaterThanOrEqual(2);
      expect(result.nextSteps.some((s) => s.toLowerCase().includes("hydrat") || s.toLowerCase().includes("ors"))).toBe(true);

      // 7. Non-diagnostic disclaimer
      expect(result.disclaimer).toContain("not a confirmed medical diagnosis");
    });
  });

  // =========================================================================
  // 3. INDEPENDENT EMERGENCY SAFETY SCREENING (Pre-AI Rule Gate)
  // =========================================================================
  describe("Independent Clinical Safety Screening", () => {
    it("immediately detects headache + stiff neck + fever as urgent clinical warning signs", () => {
      const safety = checkEmergencyRules({
        text: "I have a terrible headache, vomiting, and my neck is stiff with a high fever",
      });

      expect(safety.floor).toBe("urgent");
      expect(safety.matchedRuleIds).toContain("URG-MENING-001");
    });

    it("immediately detects sudden thunderclap headache as an emergency", async () => {
      const result = await assessSymptoms({
        symptoms: "I have a sudden thunderclap headache, worst headache of my life and I am throwing up",
      });

      // Must be immediate emergency
      expect(result.urgency).toBe("emergency");
      expect(result.urgencyLevel).toBe("emergency");
      expect(result.recommendedNextSteps[0]).toMatch(/112|emergency/i);
      expect(result.followUpQuestions).toHaveLength(0); // Never delay emergency care with routine questions
    });

    it("immediately escalates chest pain or severe shortness of breath", async () => {
      const result = await assessSymptoms({
        symptoms: "I have chest pain radiating to left arm and cannot breathe",
      });

      expect(result.urgency).toBe("emergency");
      expect(result.aiMetadata.provider).toBe("safety-rule-engine");
      expect(result.possibleConditions).toHaveLength(0); // Differential suppressed in life-threatening emergency
    });
  });

  // =========================================================================
  // 4. RESILIENCE AGAINST MALFORMED MODEL RESPONSES
  // =========================================================================
  describe("Malformed Model Output Handling", () => {
    it("extracts JSON correctly from markdown code fences or conversational text", () => {
      const wrappedResponse = `Here is the clinical evaluation:
\`\`\`json
{
  "message": "I understand your symptoms.",
  "urgency": "routine",
  "possibleCauses": [
    { "name": "Viral Infection", "explanation": "Common cause of fatigue." }
  ],
  "followUpQuestions": ["How long have you had fatigue?"],
  "nextSteps": ["Get plenty of rest."]
}
\`\`\`
Hope this helps!`;

      const extracted = extractJson(wrappedResponse);
      expect(extracted).toBeDefined();
      expect(extracted.urgency).toBe("routine");

      const validated = assessmentSchema.parse(extracted);
      expect(validated.message).toBe("I understand your symptoms.");
      expect(validated.possibleConditions).toHaveLength(1);
      expect(validated.possibleConditions[0].name).toBe("Viral Infection");
    });

    it("safely recovers and provides clinical triage if AI returns incomplete schema", () => {
      // Model returned partial object without summary or nextSteps
      const incompleteJson = {
        urgency: "routine",
        message: "You mentioned feeling nauseous.",
      };

      const validated = assessmentSchema.parse(incompleteJson);
      expect(validated.summary).toBe("You mentioned feeling nauseous.");
      expect(validated.nextSteps.length).toBeGreaterThan(0);
      expect(validated.disclaimer).toBeTruthy();
      expect(validated.possibleConditions).toEqual([]);
    });
  });

  // =========================================================================
  // 5. GREETING & INTERACTIVE FLOW INTEGRITY
  // =========================================================================
  describe("Greeting Fast-Path & User Interaction", () => {
    it("returns immediate conversational welcome without calling LLM when user says 'Hi'", async () => {
      const result = await assessSymptoms({
        symptoms: "Hi",
      });

      expect(result.urgency).toBe("insufficient_information");
      expect(result.aiMetadata.provider).toBe("conversational-gate");
      expect(result.message).toContain("Clinix");
      expect(result.followUpQuestions.length).toBeGreaterThan(0);
      expect(result.possibleConditions).toHaveLength(0); // No premature differential on a greeting!
      expect(result.conversationStage).toBe("collecting_symptoms");
      expect(result.awaitingPatientResponse).toBe(true);
      expect(result.nextQuestion).toBeTruthy();
    });

    it("represents conversational stage and waiting state explicitly", async () => {
      const result = await assessSymptoms({
        symptoms: "Hello there",
      });

      expect(result.conversationStage).toBe("collecting_symptoms");
      expect(result.awaitingPatientResponse).toBe(true);
      expect(typeof result.nextQuestion).toBe("string");
    });

    it("sets conversationStage to escalated and awaitingPatientResponse to false on emergency", async () => {
      const result = await assessSymptoms({
        symptoms: "I have sudden thunderclap headache, worst pain of my life and vomiting",
      });

      expect(result.urgency).toBe("emergency");
      expect(result.conversationStage).toBe("escalated");
      expect(result.awaitingPatientResponse).toBe(false);
      expect(result.nextQuestion).toBeNull();
      expect(result.recommendedNextSteps[0]).toMatch(/112|emergency/i);
    });
  });
});
