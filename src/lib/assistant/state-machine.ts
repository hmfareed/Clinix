import { AssistantState } from "@/models/AssistantConversation";

export type { AssistantState };

export class InvalidStateTransitionError extends Error {
  public readonly fromState: AssistantState;
  public readonly toState: AssistantState;
  public readonly code = "INVALID_STATE_TRANSITION";

  constructor(fromState: AssistantState, toState: AssistantState, message?: string) {
    super(
      message ||
        `Invalid conversation state transition from "${fromState}" to "${toState}".`
    );
    this.name = "InvalidStateTransitionError";
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Centrally defined allowed transitions for the Clinix AI Assistant state machine.
 * This guarantees strict server-side state enforcement.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<AssistantState, readonly AssistantState[]>> = {
  idle: [
    "collecting_symptoms",
    "screening",
    "screening_safety",
    "asking_follow_up",
    "asking_questions",
    "completed",
    "escalated",
  ],
  collecting_symptoms: [
    "screening",
    "screening_safety",
    "asking_questions",
    "asking_follow_up",
    "escalated",
    "failed",
  ],
  screening: [
    "asking_questions",
    "asking_follow_up",
    "evaluating",
    "escalated",
    "presenting_result",
    "presenting_guidance",
    "failed",
  ],
  screening_safety: [
    "asking_questions",
    "asking_follow_up",
    "evaluating",
    "escalated",
    "presenting_result",
    "presenting_guidance",
    "failed",
  ],
  asking_questions: [
    "screening",
    "screening_safety",
    "asking_questions",
    "asking_follow_up",
    "evaluating",
    "escalated",
    "failed",
    "presenting_result",
    "presenting_guidance",
  ],
  asking_follow_up: [
    "screening",
    "screening_safety",
    "asking_questions",
    "asking_follow_up",
    "evaluating",
    "escalated",
    "failed",
    "presenting_result",
    "presenting_guidance",
  ],
  evaluating: [
    "presenting_result",
    "presenting_guidance",
    "escalated",
    "failed",
    "asking_questions",
    "asking_follow_up",
  ],
  presenting_result: [
    "completed",
    "collecting_symptoms",
    "escalated",
    "idle",
    "presenting_guidance",
  ],
  presenting_guidance: [
    "completed",
    "collecting_symptoms",
    "escalated",
    "idle",
    "presenting_result",
  ],
  completed: ["idle", "collecting_symptoms"],
  // Once escalated to emergency, the emergency state must be preserved.
  // Only explicitly closing or acknowledging allows transition to completed.
  escalated: ["completed", "escalated"],
  failed: [
    "idle",
    "collecting_symptoms",
    "screening",
    "screening_safety",
    "evaluating",
    "escalated",
  ],
};

/**
 * Returns true if transition from `fromState` to `toState` is permitted.
 */
export function isValidTransition(fromState: AssistantState, toState: AssistantState): boolean {
  if (fromState === toState) {
    return true; // Idempotent self-transitions are permitted
  }

  const allowed = ALLOWED_TRANSITIONS[fromState];
  if (!allowed) {
    return false;
  }

  return allowed.includes(toState);
}

/**
 * Validates transition or throws an explicit InvalidStateTransitionError.
 */
export function assertValidTransition(
  fromState: AssistantState,
  toState: AssistantState,
  customMessage?: string
): void {
  if (!isValidTransition(fromState, toState)) {
    throw new InvalidStateTransitionError(fromState, toState, customMessage);
  }
}

/**
 * Determines next state given an event or result.
 * Always prioritizes emergency escalation over all other states.
 */
export function determineNextState(options: {
  currentState: AssistantState;
  emergencyDetected: boolean;
  hasSufficientInfo: boolean;
  moreQuestionsNeeded: boolean;
  isCompleted?: boolean;
}): AssistantState {
  const { currentState, emergencyDetected, hasSufficientInfo, moreQuestionsNeeded, isCompleted } =
    options;

  // Emergency invariant: emergency detection immediately forces escalation
  if (emergencyDetected) {
    return "escalated";
  }

  // If already escalated, do not downgrade
  if (currentState === "escalated" && !isCompleted) {
    return "escalated";
  }

  if (isCompleted) {
    return "completed";
  }

  switch (currentState) {
    case "idle":
      return "collecting_symptoms";

    case "collecting_symptoms":
      return "screening";

    case "screening":
      if (moreQuestionsNeeded) {
        return "asking_questions";
      }
      return hasSufficientInfo ? "evaluating" : "asking_questions";

    case "asking_questions":
      if (moreQuestionsNeeded) {
        return "asking_questions";
      }
      return hasSufficientInfo ? "evaluating" : "presenting_result";

    case "evaluating":
      return "presenting_result";

    case "presenting_result":
      return isCompleted ? "completed" : "presenting_result";

    default:
      return currentState;
  }
}
