import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  assertValidTransition,
  determineNextState,
  InvalidStateTransitionError,
  ALLOWED_TRANSITIONS,
} from "@/lib/assistant/state-machine";

describe("Assistant State Machine - Transitions & Validation", () => {
  it("allows valid transitions through the assessment lifecycle", () => {
    expect(isValidTransition("idle", "collecting_symptoms")).toBe(true);
    expect(isValidTransition("collecting_symptoms", "screening")).toBe(true);
    expect(isValidTransition("screening", "asking_questions")).toBe(true);
    expect(isValidTransition("asking_questions", "evaluating")).toBe(true);
    expect(isValidTransition("evaluating", "presenting_result")).toBe(true);
    expect(isValidTransition("presenting_result", "completed")).toBe(true);
  });

  it("permits emergency escalation from active clinical states", () => {
    expect(isValidTransition("idle", "escalated")).toBe(true);
    expect(isValidTransition("collecting_symptoms", "escalated")).toBe(true);
    expect(isValidTransition("screening", "escalated")).toBe(true);
    expect(isValidTransition("asking_questions", "escalated")).toBe(true);
    expect(isValidTransition("evaluating", "escalated")).toBe(true);
  });

  it("rejects invalid state jumps", () => {
    expect(isValidTransition("idle", "presenting_result")).toBe(false);
    expect(isValidTransition("idle", "evaluating")).toBe(false);
    expect(isValidTransition("collecting_symptoms", "completed")).toBe(false);
    expect(isValidTransition("completed", "evaluating")).toBe(false);
  });

  it("throws InvalidStateTransitionError on assertValidTransition with invalid transition", () => {
    expect(() => assertValidTransition("idle", "evaluating")).toThrow(
      InvalidStateTransitionError
    );
  });

  it("allows idempotent self-transitions", () => {
    expect(isValidTransition("idle", "idle")).toBe(true);
    expect(isValidTransition("asking_questions", "asking_questions")).toBe(true);
    expect(isValidTransition("escalated", "escalated")).toBe(true);
  });

  it("preserves emergency state: cannot downgrade escalated state to normal states", () => {
    expect(isValidTransition("escalated", "idle")).toBe(false);
    expect(isValidTransition("escalated", "collecting_symptoms")).toBe(false);
    expect(isValidTransition("escalated", "asking_questions")).toBe(false);
    expect(isValidTransition("escalated", "evaluating")).toBe(false);
    expect(isValidTransition("escalated", "presenting_result")).toBe(false);
  });

  it("determineNextState forces escalation when emergency is detected regardless of current state", () => {
    const nextState = determineNextState({
      currentState: "collecting_symptoms",
      emergencyDetected: true,
      hasSufficientInfo: false,
      moreQuestionsNeeded: true,
    });
    expect(nextState).toBe("escalated");
  });

  it("determineNextState preserves escalated state even if subsequent detection is false", () => {
    const nextState = determineNextState({
      currentState: "escalated",
      emergencyDetected: false,
      hasSufficientInfo: true,
      moreQuestionsNeeded: false,
    });
    expect(nextState).toBe("escalated");
  });
});
