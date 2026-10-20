import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/assistant/intent-classifier";

describe("Assistant Intent Classification", () => {
  it("prioritizes emergency messages immediately", () => {
    const res1 = classifyIntent("I cannot breathe and my chest hurts badly");
    expect(res1.intent).toBe("emergency_assistance");
    expect(res1.emergencyTriggered).toBe(true);

    const res2 = classifyIntent("Sudden facial drooping and slurred speech");
    expect(res2.intent).toBe("emergency_assistance");
    expect(res2.emergencyTriggered).toBe(true);

    const res3 = classifyIntent("Heavy coughing blood after an accident");
    expect(res3.intent).toBe("emergency_assistance");
    expect(res3.emergencyTriggered).toBe(true);
  });

  it("classifies medication inquiries correctly", () => {
    const res1 = classifyIntent("What is paracetamol used for?");
    expect(res1.intent).toBe("medication_information");

    const res2 = classifyIntent("Can I take ibuprofen with amoxicillin?");
    expect(res2.intent).toBe("medication_information");

    const res3 = classifyIntent("What are the side effects of cetirizine?");
    expect(res3.intent).toBe("medication_information");
  });

  it("classifies clinic and hospital searches correctly", () => {
    const res1 = classifyIntent("Find a clinic near me in Accra");
    expect(res1.intent).toBe("clinic_search");

    const res2 = classifyIntent("Where is the nearest hospital or pharmacy?");
    expect(res2.intent).toBe("clinic_search");
  });

  it("distinguishes general educational queries from personal symptoms", () => {
    const res1 = classifyIntent("What is high blood pressure?");
    expect(res1.intent).toBe("general_health_information");

    const res2 = classifyIntent("Explain what causes diabetes");
    expect(res2.intent).toBe("general_health_information");

    // First person personal symptoms must be symptom_assessment
    const res3 = classifyIntent("I have had a bad headache and fever since yesterday");
    expect(res3.intent).toBe("symptom_assessment");
  });

  it("identifies conversational follow-ups during active assessment", () => {
    const res = classifyIntent("About 3 days ago", "asking_questions", true);
    expect(res.intent).toBe("assessment_follow_up");
  });

  it("identifies unsupported non-health topics", () => {
    const res1 = classifyIntent("What is the current bitcoin price?");
    expect(res1.intent).toBe("unsupported_request");

    const res2 = classifyIntent("Write a python script to sort an array");
    expect(res2.intent).toBe("unsupported_request");
  });

  it("requires clarification on empty, short, or greeting messages", () => {
    const res1 = classifyIntent("hi");
    expect(res1.intent).toBe("clarification_required");

    const res2 = classifyIntent("a");
    expect(res2.intent).toBe("clarification_required");
  });
});
