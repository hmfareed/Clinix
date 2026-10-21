import { getNvidiaClient, MODEL, FALLBACK_MODEL, isNvidiaConfigured, AssessmentUnavailableError } from "@/lib/ai/nvidia";
import { assessmentSchema, type Assessment, type Condition } from "@/lib/medical/assessment-schema";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { enforceSafetyGate } from "@/lib/safety/post-generation-gate";
import { extractJson } from "@/lib/ai/extract-json";
import { SYSTEM_PROMPT_V1, PROMPT_VERSION_V1 } from "@/lib/ai/prompts";
import { TriState } from "@/lib/safety/types";
import { detectSymptomPathway, SYMPTOM_PATHWAYS } from "@/lib/assistant/symptom-adaptive-questions";

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
    const emergMsg =
      preSafety.patientMessage ||
      "EMERGENCY WARNING: Critical symptoms reported that require immediate in-person emergency care. Do not wait for an automated chat. Call emergency dispatch immediately.";

    return {
      urgency: "emergency",
      urgencyLevel: "emergency",
      conversationStage: "escalated",
      awaitingPatientResponse: false,
      nextQuestion: null,
      message: emergMsg,
      summary: emergMsg,
      reply: emergMsg,
      possibleConditions: [],
      possibleCauses: [],
      followUpQuestions: [],
      recommendedNextSteps: preSafety.nextSteps,
      nextSteps: preSafety.nextSteps,
      redFlags: ["Critical emergency warning signs detected — immediate 112 emergency response required."],
      disclaimer: "Emergency warning signs were identified by the clinical safety engine. Immediate medical intervention is required.",
      medicationGuidance: {
        available: false,
        explanation: "Do not delay emergency medical care to seek medication information. Immediate in-person evaluation is needed.",
        requiresProfessionalReview: true,
        suggestedOTCDrugs: [],
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
  // 1b. GREETING / INSUFFICIENT INFORMATION FAST-PATH (Instant non-diagnostic response)
  // =========================================================================
  const cleanInput = input.symptoms.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const GREETING_LIST = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "howdy",
    "sup",
    "greetings",
    "yo",
  ];

  const isGreeting =
    GREETING_LIST.includes(cleanInput) ||
    cleanInput.length <= 2 ||
    GREETING_LIST.some((g) => cleanInput.startsWith(`${g} `) && cleanInput.length < 25);

  if (isGreeting) {
    const greetingText =
      "Hello! I am your Clinix Health Assistant. Tell me what symptoms or health concerns you are experiencing, and I will help guide you toward possible causes, next steps, and verified care.";

    return {
      urgency: "insufficient_information",
      urgencyLevel: "insufficient_information",
      conversationStage: "collecting_symptoms",
      awaitingPatientResponse: true,
      nextQuestion: "What symptoms or health concerns are you experiencing?",
      message: greetingText,
      summary: "Hello! I am your Clinix AI Health Assistant.",
      reply: greetingText,
      possibleConditions: [],
      possibleCauses: [],
      followUpQuestions: [
        "What symptoms or health concerns are you experiencing?",
      ],
      recommendedNextSteps: [
        "Please describe the specific symptoms you are experiencing.",
        "Tell me about when they started, their severity, and any other symptoms.",
        "If you are experiencing severe chest pain or shortness of breath, call 112 immediately.",
      ],
      nextSteps: [
        "Please describe the specific symptoms you are experiencing.",
        "Tell me about when they started, their severity, and any other symptoms.",
        "If you are experiencing severe chest pain or shortness of breath, call 112 immediately.",
      ],
      redFlags: [],
      disclaimer: "This guidance is for informational and triage purposes only, not a medical diagnosis.",
      medicationGuidance: {
        available: false,
        explanation: "Medication information is available once specific symptoms are provided.",
        requiresProfessionalReview: true,
        suggestedOTCDrugs: [],
      },
      limitations: [
        "No clinical symptoms were described in this message.",
        "A full assessment requires describing what you are experiencing.",
      ],
      aiMetadata: {
        provider: "conversational-gate",
        model: "greeting-fast-path",
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

    // Build chat message trajectory ensuring valid alternating turns
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT_V1 },
    ];

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

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      for (const msg of input.conversationHistory) {
        const role = msg.role === "patient" ? ("user" as const) : ("assistant" as const);
        const prevMsg = messages[messages.length - 1];
        if (prevMsg && prevMsg.role === role) {
          prevMsg.content = `${prevMsg.content}. ${msg.content}`;
        } else {
          messages.push({ role, content: msg.content });
        }
      }

      // If the last message is already a user message, enrich it with clinical payload; otherwise append user message
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        lastMsg.content = `${lastMsg.content}\nClinical Details: ${JSON.stringify(patientPayload)}`;
      } else {
        messages.push({
          role: "user",
          content: JSON.stringify(patientPayload),
        });
      }
    } else {
      messages.push({
        role: "user",
        content: JSON.stringify(patientPayload),
      });
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      const currentModel = attempt === 1 ? MODEL : FALLBACK_MODEL;
      try {
        const completion = await client.chat.completions.create({
          model: currentModel,
          temperature: 0.1, // Near-deterministic for clinical consistency
          max_tokens: 850,
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

        const mappedConditions: Condition[] = (
          gatedOutput.possibleCauses || gatedOutput.possibleConditions || []
        ).map((c: any) => ({
          name: c.name || c.condition || "Potential Consideration",
          condition: c.condition || c.name || "Potential Consideration",
          explanation: c.explanation || c.rationale || "Plausible explanation based on symptoms.",
          rationale: c.rationale || c.explanation || "Plausible explanation based on symptoms.",
          supportingSymptoms: c.supportingSymptoms || [],
          missingInformation: c.missingInformation || [],
          probability: c.probability,
        }));

        return {
          ...gatedOutput,
          message: gatedOutput.message || gatedOutput.summary,
          reply: gatedOutput.reply || gatedOutput.message || gatedOutput.summary,
          possibleConditions: mappedConditions,
          possibleCauses: mappedConditions,
          nextSteps: gatedOutput.nextSteps || gatedOutput.recommendedNextSteps,
          urgencyLevel: gatedOutput.urgencyLevel || gatedOutput.urgency,
          disclaimer:
            gatedOutput.disclaimer ||
            gatedOutput.limitations[0] ||
            "This guidance is informational only and not a confirmed diagnosis.",
          redFlags: gatedOutput.redFlags || [],
          aiMetadata: {
            provider: "NVIDIA",
            model: currentModel,
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
    const urgentMsg = preSafety.patientMessage || "Your reported symptoms require prompt in-person medical review.";
    return {
      urgency: "urgent",
      urgencyLevel: "urgent",
      conversationStage: "presenting_guidance",
      awaitingPatientResponse: false,
      nextQuestion: null,
      message: urgentMsg,
      summary: urgentMsg,
      reply: urgentMsg,
      possibleConditions: [],
      possibleCauses: [],
      followUpQuestions: [],
      recommendedNextSteps: preSafety.nextSteps,
      nextSteps: preSafety.nextSteps,
      redFlags: ["Urgent warning signs identified requiring physical healthcare provider evaluation."],
      disclaimer: "This assessment was generated via clinical safety rules due to inference unavailability. It is not a confirmed medical diagnosis.",
      medicationGuidance: {
        available: false,
        explanation: "Medication advice requires in-person medical evaluation.",
        requiresProfessionalReview: true,
        suggestedOTCDrugs: [],
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

  // Resilient Clinical Fallback: Generate structured guidance based on symptom pathway
  const detectedPathway = detectSymptomPathway(input.symptoms);
  const pathwayDef = SYMPTOM_PATHWAYS[detectedPathway];
  const pathwayLabel = pathwayDef?.label || "General Health";

  // Build conversational acknowledgment and screening tailored to symptoms
  const lowerSymptoms = input.symptoms.toLowerCase();
  const isHeadacheVomiting =
    (lowerSymptoms.includes("headache") || lowerSymptoms.includes("head")) &&
    (lowerSymptoms.includes("vomit") || lowerSymptoms.includes("nausea"));

  let conversationalMessage: string;
  let followUpQuestions: string[];
  let redFlags: string[];
  let possibleCauses: Condition[];
  let nextSteps: string[];

  if (isHeadacheVomiting) {
    conversationalMessage =
      "I'm sorry you're experiencing a headache and vomiting. These symptoms can occur for several reasons, including migraine, dehydration, or an infection. I can't determine the cause from these symptoms alone.\n\nFirst, I want to check for warning signs: did the headache begin suddenly and become extremely severe, or are you experiencing confusion, weakness, a stiff neck, or difficulty speaking?";

    followUpQuestions = [
      "Did the headache begin suddenly like a thunderclap or build gradually?",
      "Do you have a stiff neck, high fever, or sensitivity to light?",
      "How long have you been vomiting, and can you keep liquids down?",
    ];

    redFlags = [
      "Sudden, explosive 'thunderclap' headache reaching peak intensity within seconds",
      "Stiff neck, high fever, or confusion / altered mental state",
      "Weakness, facial drooping, numbness, or difficulty speaking",
      "Inability to keep liquids down for more than 24 hours leading to dehydration",
    ];

    possibleCauses = [
      {
        name: "Migraine with Nausea / Vomiting",
        condition: "Migraine with Nausea / Vomiting",
        explanation: "Migraines frequently present with moderate-to-severe headache accompanied by nausea, vomiting, and light or sound sensitivity.",
        rationale: "Migraines frequently present with moderate-to-severe headache accompanied by nausea, vomiting, and light or sound sensitivity.",
        supportingSymptoms: ["Headache", "Vomiting"],
        missingInformation: ["Visual aura", "One-sided vs bilateral location", "Light sensitivity"],
        probability: undefined,
      },
      {
        name: "Acute Viral or Systemic Infection",
        condition: "Acute Viral or Systemic Infection",
        explanation: "Common viral infections (such as viral gastroenteritis or systemic viral illness) can cause headache secondary to dehydration or systemic immune response.",
        rationale: "Common viral infections (such as viral gastroenteritis or systemic viral illness) can cause headache secondary to dehydration or systemic immune response.",
        supportingSymptoms: ["Headache", "Vomiting"],
        missingInformation: ["Body temperature", "Presence of diarrhea or body aches"],
        probability: undefined,
      },
      {
        name: "Tension Headache with Dehydration",
        condition: "Tension Headache with Dehydration",
        explanation: "Dehydration from repeated vomiting can trigger or worsen significant headaches.",
        rationale: "Dehydration from repeated vomiting can trigger or worsen significant headaches.",
        supportingSymptoms: ["Headache", "Vomiting"],
        missingInformation: ["Fluid intake", "Duration of symptoms"],
        probability: undefined,
      },
    ];

    nextSteps = [
      "Rest in a quiet, dark environment away from bright screens and loud noises.",
      "Take small, frequent sips of water or oral rehydration solution (ORS) to prevent dehydration.",
      "Consult a registered healthcare practitioner or local clinic for clinical evaluation if symptoms persist.",
      "Seek emergency medical care immediately if you develop sudden severe worsening, stiff neck, confusion, or inability to keep fluids down.",
    ];
  } else {
    conversationalMessage = `I understand you are experiencing ${input.symptoms}. Because these symptoms can occur for several reasons, I want to check for serious warning signs and understand your situation better before drawing conclusions.`;

    followUpQuestions =
      pathwayDef?.questions?.slice(0, 3).map((q) => q.text) || [
        "How long have you been experiencing these symptoms?",
        "Are your symptoms getting progressively worse?",
      ];

    redFlags = [
      "Sudden, severe, or rapidly worsening pain or distress",
      "Difficulty breathing or shortness of breath",
      "Confusion, persistent vomiting, or inability to retain fluids",
    ];

    possibleCauses = [
      {
        name: `${pathwayLabel} Condition`,
        condition: `${pathwayLabel} Condition`,
        explanation: `Common conditions associated with ${pathwayLabel.toLowerCase()} symptoms can present with your described symptoms. A medical professional should evaluate you in person.`,
        rationale: `Common conditions associated with ${pathwayLabel.toLowerCase()} symptoms can present with your described symptoms. A medical professional should evaluate you in person.`,
        supportingSymptoms: [input.symptoms],
        missingInformation: ["Vital signs", "Physical examination", "Clinical duration"],
        probability: undefined,
      },
      {
        name: "Acute non-specific viral or systemic reaction",
        condition: "Acute non-specific viral or systemic reaction",
        explanation: "Many common viral infections or systemic responses begin with non-specific discomfort such as headache, fatigue, or digestive changes.",
        rationale: "Many common viral infections or systemic responses begin with non-specific discomfort such as headache, fatigue, or digestive changes.",
        supportingSymptoms: [input.symptoms],
        missingInformation: ["Temperature reading", "Hydration status"],
        probability: undefined,
      },
    ];

    nextSteps = [
      "Consult a registered healthcare practitioner or local clinic for clinical evaluation.",
      "Stay well-hydrated with fluids or oral rehydration solution (ORS).",
      "Seek emergency medical care immediately if you develop sudden severe worsening, stiff neck, confusion, or inability to keep fluids down.",
    ];
  }

  return {
    urgency: "routine",
    urgencyLevel: "routine",
    conversationStage: "asking_follow_up",
    awaitingPatientResponse: followUpQuestions.length > 0,
    nextQuestion: followUpQuestions[0] || null,
    message: conversationalMessage,
    summary: `Reported symptoms (${input.symptoms}) evaluated against Clinix clinical guidance. Physical medical evaluation recommended.`,
    reply: conversationalMessage,
    possibleConditions: possibleCauses,
    possibleCauses,
    followUpQuestions,
    recommendedNextSteps: nextSteps,
    nextSteps,
    redFlags,
    disclaimer: "This guidance is for clinical triage navigation only and is not a confirmed medical diagnosis.",
    medicationGuidance: {
      available: true,
      explanation: "Over-the-counter options should be reviewed by a pharmacist prior to use.",
      requiresProfessionalReview: true,
      suggestedOTCDrugs: [
        {
          name: "Oral Rehydration Salts (ORS)",
          purpose: "Helps replace lost fluids and electrolytes from vomiting or sickness",
          warning: "Sip slowly; if vomiting persists continuously, seek immediate medical attention",
        },
        {
          name: "Paracetamol",
          purpose: "Symptomatic relief for headache or mild discomfort",
          warning: "Follow official packaging dosage; do not exceed daily limits or combine with other paracetamol products",
        },
      ],
    },
    limitations: [
      "Assessment generated via Clinix clinical knowledge rules.",
      "This is clinical care-navigation guidance, not a medical diagnosis.",
    ],
    aiMetadata: {
      provider: "clinical-safety-fallback",
      model: "deterministic-triage",
      promptVersion: PROMPT_VERSION_V1,
      ruleSetVersion: preSafety.ruleSetVersion || "1.0",
      attempts,
      completedAt: new Date().toISOString(),
    },
  };
}
