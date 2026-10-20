import { getNvidiaClient, MODEL, isNvidiaConfigured, AssessmentUnavailableError } from "@/lib/ai/nvidia";
import { assessmentSchema, type Assessment } from "@/lib/medical/assessment-schema";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { enforceSafetyGate } from "@/lib/safety/post-generation-gate";
import { extractJson } from "@/lib/ai/extract-json";
import { SYSTEM_PROMPT_V1, PROMPT_VERSION_V1 } from "@/lib/ai/prompts";
import { TriState } from "@/lib/safety/types";

export interface ClinicalInput {
  sessionId?: string;
  symptoms: string;
  age?: number;
  allergies?: { status: TriState; items?: string[] };
  currentMedicines?: { status: TriState; items?: string[] };
  pregnancy?: TriState | "not_applicable";
  vitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    temperatureC?: number;
    oxygenSaturation?: number;
  };
  conversationHistory?: Array<{
    role: "patient" | "assistant";
    content: string;
  }>;
  language?: string;
}

export interface AssessmentResult extends Assessment {
  aiMetadata: {
    provider: string;
    model: string;
    promptVersion: string;
    ruleSetVersion: string;
    attempts: number;
    completedAt: string;
  };
}

export async function assessSymptoms(input: ClinicalInput): Promise<AssessmentResult> {
  // =========================================================================
  // 1. PRE-AI EMERGENCY SAFETY CHECK (Independent rule engine)
  // =========================================================================
  const conversationText = [
    input.symptoms,
    ...(input.conversationHistory || []).map((m) => m.content),
  ].join(" ");

  const preSafety = checkEmergencyRules({
    text: conversationText,
    symptoms: input.symptoms,
    age: input.age,
    vitals: input.vitals,
    allergies: input.allergies,
    currentMedicines: input.currentMedicines,
    pregnancy: input.pregnancy,
  });

  if (preSafety.emergencyDetected) {
    return {
      urgency: "emergency",
      summary: preSafety.patientMessage,
      possibleConditions: [],
      followUpQuestions: [],
      recommendedNextSteps: preSafety.nextSteps,
      medicationGuidance: {
        available: false,
        explanation: "Do not delay emergency medical care to seek medication information. Immediate in-person evaluation is needed.",
        requiresProfessionalReview: true,
      },
      limitations: [
        "Emergency warning signs were identified by the clinical safety engine.",
        "This is not a confirmed medical diagnosis. Immediate medical intervention is required.",
      ],
      aiMetadata: {
        provider: "safety-rule-engine",
        model: "pre-ai-emergency-gate",
        promptVersion: PROMPT_VERSION_V1,
        ruleSetVersion: preSafety.ruleSetVersion,
        attempts: 0,
        completedAt: new Date().toISOString(),
      },
    };
  }

  // =========================================================================
  // 2. AI INFERENCE WITH BOUNDED RETRIES & SAFE DEGRADATION
  // =========================================================================
  let attempts = 0;
  let lastError: unknown;
  const maxAttempts = Number(process.env.AI_MAX_ATTEMPTS) || 2;

  if (isNvidiaConfigured()) {
    const client = getNvidiaClient();

    // Build chat message trajectory
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT_V1 },
    ];

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      for (const msg of input.conversationHistory) {
        messages.push({
          role: msg.role === "patient" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Prepare patient payload excluding sensitive PII
    const patientPayload = {
      symptoms: input.symptoms,
      age: input.age,
      allergies: input.allergies,
      currentMedicines: input.currentMedicines,
      pregnancy: input.pregnancy,
      vitals: input.vitals,
      language: input.language || "en",
    };

    messages.push({
      role: "user",
      content: JSON.stringify(patientPayload),
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const completion = await client.chat.completions.create({
          model: MODEL,
          temperature: 0, // Deterministic zero-temperature for clinical consistency
          messages,
        });

        const rawContent = completion.choices[0]?.message?.content;
        if (!rawContent) {
          throw new Error("AI inference returned empty content");
        }

        const parsedJson = extractJson(rawContent);
        const validatedOutput = assessmentSchema.parse(parsedJson);

        // =========================================================================
        // 3. POST-AI SAFETY GATE (Stricter urgency always wins)
        // =========================================================================
        const gatedOutput = enforceSafetyGate(
          {
            text: conversationText,
            symptoms: input.symptoms,
            age: input.age,
            allergies: input.allergies,
            currentMedicines: input.currentMedicines,
            pregnancy: input.pregnancy,
            vitals: input.vitals,
          },
          validatedOutput
        );

        return {
          ...gatedOutput,
          aiMetadata: {
            provider: "NVIDIA",
            model: MODEL,
            promptVersion: PROMPT_VERSION_V1,
            ruleSetVersion: preSafety.ruleSetVersion,
            attempts,
            completedAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(`[ASSESSMENT SERVICE] Attempt ${attempt} failed:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // =========================================================================
  // 4. DEGRADED MODE / SAFE FAILURE (Fail safe, never reassure on failure)
  // =========================================================================
  // If safety engine found an urgent floor, return an urgent referral
  if (preSafety.floor === "urgent") {
    return {
      urgency: "urgent",
      summary: preSafety.patientMessage || "Your reported symptoms require prompt medical review.",
      possibleConditions: [],
      followUpQuestions: [],
      recommendedNextSteps: preSafety.nextSteps,
      medicationGuidance: {
        available: false,
        explanation: "Medication advice requires in-person medical evaluation.",
        requiresProfessionalReview: true,
      },
      limitations: [
        "Assessment generated via clinical safety rules due to inference unavailability.",
        "This is not a confirmed medical diagnosis.",
      ],
      aiMetadata: {
        provider: "safety-rule-engine-fallback",
        model: "offline-urgent-fallback",
        promptVersion: PROMPT_VERSION_V1,
        ruleSetVersion: preSafety.ruleSetVersion,
        attempts,
        completedAt: new Date().toISOString(),
      },
    };
  }

  // Invariant: Never convert an AI failure into a reassuring result
  throw new AssessmentUnavailableError(
    "We could not complete your assessment right now. This is not a sign that you are fine.",
    lastError
  );
}
