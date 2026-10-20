import { z } from "zod";

export const conditionSchema = z.object({
  name: z.string().min(1, "Condition name is required"),
  explanation: z.string().min(1, "Explanation is required"),
  supportingSymptoms: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
});

export const medicationGuidanceSchema = z.object({
  available: z.boolean(),
  explanation: z.string(),
  requiresProfessionalReview: z.boolean(),
});

export const urgencyEnum = z.enum([
  "emergency",
  "urgent",
  "routine",
  "self_care_eligible",
  "insufficient_information",
]);

export const assessmentSchema = z.object({
  summary: z.string().min(1, "Assessment summary is required"),
  urgency: urgencyEnum,
  possibleConditions: z.array(conditionSchema).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  recommendedNextSteps: z.array(z.string()).min(1, "At least one next step is required"),
  medicationGuidance: medicationGuidanceSchema,
  limitations: z.array(z.string()).default([]),
});

export type Condition = z.infer<typeof conditionSchema>;
export type MedicationGuidance = z.infer<typeof medicationGuidanceSchema>;
export type Urgency = z.infer<typeof urgencyEnum>;
export type Assessment = z.infer<typeof assessmentSchema>;
