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
  "asking_questions",
  "evaluating",
  "presenting_result",
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

export const structuredAssistantResponseSchema = z.object({
  intent: assistantIntentEnum,
  state: assistantStateEnum,
  message: z.string().min(1).max(3000),
  followUpQuestion: followUpQuestionSchema.nullable().optional(),
  safety: z.object({
    urgentPathwayTriggered: z.boolean().default(false),
    ruleIds: z.array(z.string()).default([]),
  }),
  actions: z.array(assistantActionSchema).default([]),
  sources: z.array(assistantSourceSchema).default([]),
});

export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantSource = z.infer<typeof assistantSourceSchema>;
export type StructuredAssistantResponse = z.infer<typeof structuredAssistantResponseSchema>;
