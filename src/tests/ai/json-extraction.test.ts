import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/ai/extract-json";

describe("AI JSON Extraction Helper", () => {
  it("parses pure JSON string directly", () => {
    const raw = '{"summary": "Test summary", "urgency": "routine"}';
    const parsed = extractJson<{ summary: string; urgency: string }>(raw);
    expect(parsed.summary).toBe("Test summary");
    expect(parsed.urgency).toBe("routine");
  });

  it("extracts JSON wrapped in markdown code blocks with ```json", () => {
    const raw = `Here is the assessment:
\`\`\`json
{
  "summary": "Patient has mild headache",
  "urgency": "routine",
  "recommendedNextSteps": ["Rest", "Hydrate"]
}
\`\`\`
Hope this helps!`;

    const parsed = extractJson<{ summary: string; urgency: string; recommendedNextSteps: string[] }>(raw);
    expect(parsed.summary).toBe("Patient has mild headache");
    expect(parsed.urgency).toBe("routine");
    expect(parsed.recommendedNextSteps).toHaveLength(2);
  });

  it("extracts JSON wrapped in plain ``` code block", () => {
    const raw = `\`\`\`
{"summary": "Patient is experiencing mild cough"}
\`\`\``;
    const parsed = extractJson<{ summary: string }>(raw);
    expect(parsed.summary).toBe("Patient is experiencing mild cough");
  });

  it("extracts JSON with surrounding conversational prose without code blocks", () => {
    const raw = `Based on the patient's symptoms, here is my clinical evaluation:
{"summary": "Throat pain with no fever", "urgency": "routine"}
Please advise patient to schedule an appointment.`;

    const parsed = extractJson<{ summary: string; urgency: string }>(raw);
    expect(parsed.summary).toBe("Throat pain with no fever");
    expect(parsed.urgency).toBe("routine");
  });

  it("throws descriptive error when no JSON structure is present", () => {
    const raw = "I am sorry, but I cannot assess these symptoms.";
    expect(() => extractJson(raw)).toThrow("No valid JSON object structure found");
  });
});
