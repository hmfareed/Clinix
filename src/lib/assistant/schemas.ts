import { z } from "zod";

export const assistantIntentEnum = z.enum([
  "symptom_assessment",
  "general_health_information",
  "medication_information",
  "clinic_search",
  "emergency_assistance",
  "assessment_follow_up",
  "unsupported_request",
  "clarification_required",
]);

export const assistantStateEnum = z.enum([
  "idle",
  "collecting_symptoms",
  "screening",
  "screening_safety",
  "asking_questions",
  "asking_follow_up",
  "evaluating",
  "presenting_result",
  "presenting_guidance",
  "completed",
  "escalated",
  "failed",
]);

export const followUpQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(3).max(500),
  type: z.enum(["single_choice", "multiple_choice", "free_text"]),
  options: z.array(z.string().min(1).max(100)).max(8).optional(),
});

export const assistantActionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  type: z.enum(["link", "action", "call"]),
  target: z.string().max(256).optional(),
});

export const assistantSourceSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  url: z.string().url().max(500).optional(),
});

export const assessmentDetailsSchema = z.object({
  summary: z.string(),
  urgency: z.string(),
  possibleConditions: z
    .array(
      z.object({
        name: z.string(),
        explanation: z.string(),
        supportingSymptoms: z.array(z.string()).default([]),
        missingInformation: z.array(z.string()).default([]),
      })
    )
    .default([]),
  recommendedNextSteps: z.array(z.string()).default([]),
  suggestedOTCDrugs: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string(),
        warning: z.string(),
      })
    )
    .default([]),
  limitations: z.array(z.string()).default([]),
});

export const structuredAssistantResponseSchema = z.object({
  intent: assistantIntentEnum,
  state: assistantStateEnum,
  conversationStage: assistantStateEnum.optional(),
  awaitingPatientResponse: z.boolean().optional(),
  message: z.string().min(1).max(3000),
  nextQuestion: z.string().nullable().optional(),
  followUpQuestion: followUpQuestionSchema.nullable().optional(),
  assessmentSummary: z.string().optional(),
  nextSteps: z.array(z.string()).optional(),
  urgencyLevel: z.string().optional(),
  safety: z.object({
    urgentPathwayTriggered: z.boolean().default(false),
    ruleIds: z.array(z.string()).default([]),
  }),
  actions: z.array(assistantActionSchema).default([]),
  sources: z.array(assistantSourceSchema).default([]),
  assessmentDetails: assessmentDetailsSchema.optional(),
  facilityResults: z.array(z.any()).optional(),
  clinicSearchPrompt: z
    .object({
      active: z.boolean(),
      defaultRadiusMeters: z.number().default(5000),
      detectedLocationName: z.string().optional(),
    })
    .optional(),
});

export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantSource = z.infer<typeof assistantSourceSchema>;
export type AssessmentDetails = z.infer<typeof assessmentDetailsSchema>;
export type StructuredAssistantResponse = z.infer<typeof structuredAssistantResponseSchema>;
