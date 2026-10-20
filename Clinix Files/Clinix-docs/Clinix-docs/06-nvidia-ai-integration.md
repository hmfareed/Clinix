# 06 — NVIDIA AI Integration

NVIDIA's hosted model APIs expose an OpenAI-compatible chat-completions endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`. The model identifier depends on the model you choose.

## 6.1 Environment variables

```
MONGODB_URI=mongodb+srv://...
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_MODEL=your_selected_model_id
AUTH_SECRET=your_long_random_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NVIDIA_API_KEY` must **never** use the `NEXT_PUBLIC_` prefix, be sent to the browser, appear in client code, or be committed to Git. See [21](21-environment-and-setup.md) for the full list.

## 6.2 Client

```bash
npm install openai zod mongoose
```

`src/lib/ai/nvidia.ts`:

```ts
import OpenAI from "openai";

if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");
if (!process.env.NVIDIA_MODEL) throw new Error("NVIDIA_MODEL is missing");

export const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
  timeout: 30_000,
  maxRetries: 0, // retries are controlled by our own orchestration
});

export const MODEL = process.env.NVIDIA_MODEL;
```

The OpenAI SDK is just an API client; it does not mean an OpenAI model is used.

## 6.3 Structured output contract

`src/lib/medical/assessment-schema.ts`:

```ts
import { z } from "zod";

export const assessmentSchema = z.object({
  summary: z.string(),
  urgency: z.enum([
    "emergency",
    "urgent",
    "routine",
    "self_care_eligible",
    "insufficient_information",
  ]),
  possibleConditions: z.array(
    z.object({
      name: z.string(),
      explanation: z.string(),
      supportingSymptoms: z.array(z.string()),
      missingInformation: z.array(z.string()),
    })
  ),
  followUpQuestions: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
  medicationGuidance: z.object({
    available: z.boolean(),
    explanation: z.string(),
    requiresProfessionalReview: z.boolean(),
  }),
  limitations: z.array(z.string()),
});

export type Assessment = z.infer<typeof assessmentSchema>;
```

This is an application contract, not clinical validation. Enforce conditional rules too: e.g. an emergency must never be downgraded to self-care because of an inconsistent field.

## 6.4 Assessment service

`src/services/assessment-service.ts` — illustrates the integration pattern, with the hardening described below built in.

```ts
import { nvidia, MODEL } from "@/lib/ai/nvidia";
import { assessmentSchema, type Assessment } from "@/lib/medical/assessment-schema";
import { checkEmergencyRules } from "@/lib/safety/emergency-rules";
import { enforceSafetyGate } from "@/lib/safety/post-generation-gate";
import { extractJson } from "@/lib/ai/extract-json";
import { SYSTEM_PROMPT_V1 } from "@/lib/ai/prompts";

export async function assessSymptoms(input: {
  symptoms: string;
  age?: number;
  relevantHistory?: string[];
}): Promise<Assessment> {
  // 1. Pre-AI emergency check (clinician-reviewed rules)
  const pre = checkEmergencyRules(input);
  if (pre.emergencyDetected) {
    return {
      urgency: "emergency",
      summary: pre.patientMessage,
      possibleConditions: [],
      followUpQuestions: [],
      recommendedNextSteps: pre.nextSteps,
      medicationGuidance: {
        available: false,
        explanation: "Do not delay emergency care to seek medication advice.",
        requiresProfessionalReview: true,
      },
      limitations: ["This is not a confirmed diagnosis."],
    };
  }

  // 2. Controlled retries: at most 2 attempts, then a safe failure
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await nvidia.chat.completions.create({
        model: MODEL!,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_V1 },
          { role: "user", content: JSON.stringify(input) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("AI assessment returned no content");

      const parsed = assessmentSchema.parse(extractJson(content));

      // 3. Post-AI safety gate: the stricter urgency always wins
      return enforceSafetyGate(input, parsed);
    } catch (err) {
      lastError = err;
    }
  }

  // 4. Never convert an AI failure into a reassuring result
  throw new AssessmentUnavailableError(lastError);
}
```

### What production adds

- Controlled retries, timeouts and a typed `AssessmentUnavailableError` mapped to HTTP 503 and a safe UI message
- Output validation that rejects unsupported fields and inconsistent combinations
- An **independent post-generation safety gate** (`enforceSafetyGate`) that re-runs the rules on the whole conversation plus the AI output
- Use of a structured-output mode if the chosen NVIDIA model supports one; otherwise validate and reject
- Prompt and model version stored with every assessment (see [11](11-database-design.md))

## 6.5 AI capabilities to add over time

- Conversation history for the current assessment
- Context-aware follow-up questions
- Streaming responses (NVIDIA documents streaming for supported models)
- Language detection and supported-language responses
- Medical reference retrieval with citations
- Model selection through configuration
- Prompt and model version tracking
- Request limits and inference-cost monitoring
- Evaluation suite to compare model versions (see [23](23-ai-prompts-and-evaluation.md))
- Safe fallback if NVIDIA is unavailable (see [25](25-error-states-and-fallbacks.md))

## 6.6 Tool access rules

Do not give the AI unrestricted access to databases, the internet, arbitrary tools or patient records. Expose only narrow, permission-checked functions such as `findFacilities` or `getApprovedMedicationInformation`, with arguments validated by Zod and the acting user checked server-side.

## 6.7 Data sent to NVIDIA (new)

Send the minimum needed: symptom text, age band, relevant history the patient chose to share. Do **not** send name, email, phone, exact location or account identifiers. Disclose this to the patient in the consent screen, and review NVIDIA's terms for retention, training use, residency and contractual commitments before sending any real patient data.
