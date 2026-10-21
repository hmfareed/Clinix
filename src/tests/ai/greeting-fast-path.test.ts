import { describe, it, expect } from "vitest";
import { assessSymptoms } from "@/services/assessment-service";

describe("Conversational Greeting Fast-Path", () => {
  it("immediately returns insufficient_information for simple 'Hi' without calling external AI", async () => {
    const start = Date.now();
    const result = await assessSymptoms({
      symptoms: "Hi",
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Must be near-instant (< 100ms)
    expect(result.urgency).toBe("insufficient_information");
    expect(result.possibleConditions).toHaveLength(0);
    expect(result.followUpQuestions.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Clinix");
    expect(result.aiMetadata.provider).toBe("conversational-gate");
  });

  it("handles other common greetings immediately", async () => {
    for (const greeting of ["hello", "Hey", "good morning", "yo"]) {
      const result = await assessSymptoms({
        symptoms: greeting,
      });
      expect(result.urgency).toBe("insufficient_information");
      expect(result.possibleConditions).toHaveLength(0);
    }
  });
});
