import { describe, it, expect } from "vitest";
import {
  createAssessmentState,
  updateAssessmentWithAnswer,
  getNextFollowUpQuestion,
  extractSymptomAttributes,
} from "@/lib/assistant/symptom-tracker";

describe("Assistant Symptom Tracker", () => {
  it("extracts symptom duration and severity attributes from text", () => {
    const res1 = extractSymptomAttributes("I have severe fever since this morning");
    expect(res1.severity).toBe("severe");
    expect(res1.duration).toBe("Within 24 hours");

    const res2 = extractSymptomAttributes("Mild headache for 2 days");
    expect(res2.severity).toBe("mild");
    expect(res2.duration).toBe("1-3 days");
  });

  it("initializes assessment state properly", () => {
    const state = createAssessmentState("headache and dizziness", "ass_123");
    expect(state.id).toBe("ass_123");
    expect(state.status).toBe("in_progress");
    expect(state.symptoms[0].name).toContain("headache");
    expect(state.unansweredQuestions.length).toBeGreaterThan(0);
  });

  it("updates assessment with answers and applies user corrections", () => {
    const state = createAssessmentState("stomach ache", "ass_123");

    // First answer
    const state2 = updateAssessmentWithAnswer(state, "symptom_duration", "1 to 3 days");
    expect(state2.answeredQuestions["symptom_duration"]).toBe("1 to 3 days");
    expect(state2.unansweredQuestions).not.toContain("symptom_duration");

    // User corrects previous answer
    const state3 = updateAssessmentWithAnswer(
      state2,
      "symptom_severity",
      "Actually it's severe, not mild, I made a mistake earlier"
    );
    expect(state3.symptoms[0].severity).toBe("severe");
    expect(state3.symptoms[0].isCorrection).toBe(true);
  });

  it("reevaluates safety rules upon receiving new information", () => {
    const state = createAssessmentState("general discomfort", "ass_123");
    expect(state.status).toBe("in_progress");

    // User suddenly reports chest pain and inability to breathe
    const updated = updateAssessmentWithAnswer(
      state,
      "associated_difficulty_breathing",
      "Yes, I cannot breathe and my chest hurts"
    );
    expect(updated.status).toBe("escalated");
    expect(updated.urgency).toBe("emergency");
    expect(updated.safetyState.emergencyDetected).toBe(true);

    // Follow up questions should stop once emergency is detected
    expect(getNextFollowUpQuestion(updated)).toBeNull();
  });
});
