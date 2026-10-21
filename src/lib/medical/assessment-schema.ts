import { z } from "zod";

export const conditionSchema = z
  .object({
    name: z.string().optional(),
    condition: z.string().optional(),
    explanation: z.string().optional().default(""),
    rationale: z.string().optional(),
    supportingSymptoms: z.array(z.string()).default([]),
    missingInformation: z.array(z.string()).default([]),
    probability: z.string().optional(),
  })
  .transform((data) => {
    const name = (data.name || data.condition || "").trim();
    const explanation =
      (data.explanation || data.rationale || "").trim() ||
      (name ? "Plausible explanation based on reported symptoms; requires clinical evaluation." : "");
    return {
      name,
      condition: name,
      explanation,
      rationale: (data.rationale || explanation).trim(),
      supportingSymptoms: data.supportingSymptoms || [],
      missingInformation: data.missingInformation || [],
      ...(data.probability ? { probability: data.probability } : {}),
    };
  });

export const otcDrugSuggestionSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  warning: z.string().min(1),
});

export const medicationGuidanceSchema = z.object({
  available: z.boolean(),
  explanation: z.string(),
  requiresProfessionalReview: z.boolean(),
  /** OTC (over-the-counter) drug suggestions — only populated when safe and
   *  clinically appropriate. Never includes prescription-only medicines. */
  suggestedOTCDrugs: z.array(otcDrugSuggestionSchema).optional(),
});

export const urgencyEnum = z.enum([
  "emergency",
  "urgent",
  "routine",
  "self_care_eligible",
  "insufficient_information",
]);

export const assessmentSchema = z
  .object({
    summary: z.string().optional(),
    message: z.string().optional(),
    reply: z.string().optional(),
    conversationStage: z.string().optional(),
    awaitingPatientResponse: z.boolean().optional(),
    nextQuestion: z.string().nullable().optional(),
    assessmentSummary: z.string().optional(),
    urgency: urgencyEnum.optional(),
    urgencyLevel: urgencyEnum.optional(),
    possibleConditions: z.array(conditionSchema).default([]),
    possibleCauses: z.array(conditionSchema).optional(),
    followUpQuestions: z.array(z.string()).default([]),
    recommendedNextSteps: z.array(z.string()).default([]),
    nextSteps: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).default([]),
    disclaimer: z.string().optional(),
    medicationGuidance: medicationGuidanceSchema.optional().default({
      available: false,
      explanation: "Medication guidance requires clinical review.",
      requiresProfessionalReview: true,
      suggestedOTCDrugs: [],
    }),
    limitations: z.array(z.string()).default([]),
  })
  .transform((data) => {
    const mainMessage =
      data.message ||
      data.reply ||
      data.summary ||
      "I have evaluated your symptoms against clinical safety and triage protocols.";
    const mainUrgency = data.urgencyLevel || data.urgency || "routine";
    const rawConditions = data.possibleCauses || data.possibleConditions || [];
    // Filter out any blank or empty condition objects
    const conditions = rawConditions.filter((c) => Boolean(c.name?.trim() || c.condition?.trim()));
    const rawSteps = data.nextSteps || data.recommendedNextSteps || [];
    const steps = rawSteps.filter((s) => typeof s === "string" && s.trim().length > 0);
    const redFlags = (data.redFlags || []).filter((f) => typeof f === "string" && f.trim().length > 0);
    const disclaimer =
      data.disclaimer ||
      (data.limitations && data.limitations[0]) ||
      "This guidance is informational and for triage purposes only, not a confirmed medical diagnosis. If symptoms worsen, seek care immediately.";

    const nextQuestion = data.nextQuestion || (data.followUpQuestions && data.followUpQuestions[0]) || null;
    const awaitingPatientResponse =
      data.awaitingPatientResponse !== undefined
        ? data.awaitingPatientResponse
        : Boolean(nextQuestion);
    const conversationStage =
      data.conversationStage || (awaitingPatientResponse ? "asking_follow_up" : "presenting_guidance");
    const assessmentSummary = data.assessmentSummary || (awaitingPatientResponse ? undefined : mainMessage);

    return {
      ...data,
      summary: mainMessage,
      message: mainMessage,
      reply: mainMessage,
      conversationStage,
      awaitingPatientResponse,
      nextQuestion,
      assessmentSummary,
      urgency: mainUrgency,
      urgencyLevel: mainUrgency,
      possibleConditions: conditions,
      possibleCauses: conditions,
      recommendedNextSteps:
        steps.length > 0
          ? steps
          : [
              "Consult a registered healthcare professional or clinic for physical evaluation.",
              "Seek emergency medical attention if severe warning signs develop.",
            ],
      nextSteps:
        steps.length > 0
          ? steps
          : [
              "Consult a registered healthcare professional or clinic for physical evaluation.",
              "Seek emergency medical attention if severe warning signs develop.",
            ],
      redFlags,
      disclaimer,
      medicationGuidance: data.medicationGuidance,
      limitations:
        data.limitations && data.limitations.length > 0
          ? data.limitations
          : [disclaimer],
    };
  });

export type Condition = z.infer<typeof conditionSchema>;
export type OTCDrugSuggestion = z.infer<typeof otcDrugSuggestionSchema>;
export type MedicationGuidance = z.infer<typeof medicationGuidanceSchema>;
export type Urgency = z.infer<typeof urgencyEnum>;
export type Assessment = Omit<
  z.infer<typeof assessmentSchema>,
  "assessmentSummary" | "conversationStage" | "awaitingPatientResponse" | "nextQuestion"
> & {
  assessmentSummary?: string;
  conversationStage?: string;
  awaitingPatientResponse?: boolean;
  nextQuestion?: string | null;
};
