import { describe, it, expect } from "vitest";
import {
  structuredAssistantResponseSchema,
  StructuredAssistantResponse,
} from "@/lib/assistant/schemas";

describe("Assistant Structured Output Schema Validation", () => {
  it("validates a compliant structured response", () => {
    const validPayload: StructuredAssistantResponse = {
      intent: "symptom_assessment",
      state: "asking_questions",
      message: "I understand you have an abdominal pain.",
      followUpQuestion: {
        id: "symptom_severity",
        text: "How severe is the pain?",
        type: "single_choice",
        options: ["Mild", "Moderate", "Severe"],
      },
      safety: {
        urgentPathwayTriggered: false,
        ruleIds: [],
      },
      actions: [
        {
          id: "find_clinic",
          label: "Find Nearby Clinic",
          type: "link",
          target: "/clinics",
        },
      ],
      sources: [
        {
          id: "who_guidelines",
          title: "WHO Guidelines",
          url: "https://www.who.int",
        },
      ],
    };

    const parsed = structuredAssistantResponseSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid intent or state enum values", () => {
    const invalidPayload = {
      intent: "unknown_intent",
      state: "arbitrary_state",
      message: "Some text",
    };

    const parsed = structuredAssistantResponseSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it("rejects follow-up questions with empty text or invalid type", () => {
    const invalidQuestion = {
      intent: "symptom_assessment",
      state: "asking_questions",
      message: "Some text",
      followUpQuestion: {
        id: "q1",
        text: "", // Too short
        type: "unsupported_type",
      },
      safety: { urgentPathwayTriggered: false, ruleIds: [] },
    };

    const parsed = structuredAssistantResponseSchema.safeParse(invalidQuestion);
    expect(parsed.success).toBe(false);
  });

  it("handles null followUpQuestion gracefully", () => {
    const payloadWithNullQuestion = {
      intent: "medication_information",
      state: "idle",
      message: "Paracetamol is an over-the-counter analgesic.",
      followUpQuestion: null,
      safety: {
        urgentPathwayTriggered: false,
        ruleIds: [],
      },
      actions: [],
      sources: [],
    };

    const parsed = structuredAssistantResponseSchema.safeParse(payloadWithNullQuestion);
    expect(parsed.success).toBe(true);
  });
});
