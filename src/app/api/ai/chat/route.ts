import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { assessSymptoms } from "@/services/assessment-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit/audit";
import { auth } from "@/lib/auth/auth";

const MAX_FOLLOW_UP_TURNS = 6;

const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  symptoms: z.string().min(1).max(2000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["patient", "assistant"]),
      content: z.string(),
    })
  ).default([]),
  age: z.number().optional(),
  allergies: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).optional(),
    })
    .optional(),
  currentMedicines: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).optional(),
    })
    .optional(),
  pregnancy: z.enum(["yes", "no", "unknown", "not_applicable"]).optional(),
  language: z.string().default("en"),
  concludeNow: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate Limiting (25 requests per minute for active chat)
  const rateLimit = checkRateLimit(`ai_chat_${clientIp}`, {
    limit: 25,
    windowSeconds: 60,
  });

  const rateLimitHeaders = {
    "X-Request-Id": requestId,
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetSeconds),
  };

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "You are sending messages too quickly. Please pause for a moment before continuing.",
          safeAction: "If you are in acute distress, call 112 immediately.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  try {
    const session = await auth();
    const rawBody = await req.json();
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid chat payload.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const {
      message,
      symptoms,
      conversationHistory,
      age,
      allergies,
      currentMedicines,
      pregnancy,
      language,
      concludeNow,
    } = parseResult.data;

    // Check for fixed refusal on out-of-scope prescription requests
    const prescriptionKeywords = ["prescribe", "prescription", "write me a script", "give me antibiotics"];
    const lowerMessage = message.toLowerCase();
    if (prescriptionKeywords.some((kw) => lowerMessage.includes(kw))) {
      return NextResponse.json(
        {
          success: true,
          data: {
            isRefusal: true,
            summary: "Prescription requests cannot be fulfilled.",
            reply:
              "Clinix is an informational triage assistant and cannot issue prescriptions, calculate specific doses, or prescribe medications. Please visit a licensed physician or consult a registered pharmacist for prescription medicines.",
            followUpQuestions: [],
            recommendedNextSteps: [
              "Consult a licensed medical doctor or clinic for physical examination and prescription evaluation.",
              "Speak with a licensed community pharmacist regarding over-the-counter options.",
            ],
            urgency: "routine",
          },
          requestId,
        },
        { status: 200, headers: rateLimitHeaders }
      );
    }

    // Build updated history ensuring no duplicate patient turns
    const lastHistoryMsg = conversationHistory[conversationHistory.length - 1];
    const isAlreadyInHistory =
      lastHistoryMsg &&
      lastHistoryMsg.role === "patient" &&
      lastHistoryMsg.content.trim() === message.trim();

    const updatedHistory = isAlreadyInHistory
      ? conversationHistory
      : [...conversationHistory, { role: "patient" as const, content: message }];

    // Enforce maximum turn cap or forced conclusion
    const patientTurns = updatedHistory.filter((m) => m.role === "patient").length;
    const shouldConclude = concludeNow || patientTurns >= MAX_FOLLOW_UP_TURNS;

    const consolidatedSymptoms = symptoms.includes(message)
      ? symptoms
      : `${symptoms}. Latest detail: ${message}`;

    const assessment = await assessSymptoms({
      symptoms: consolidatedSymptoms,
      conversationHistory: updatedHistory,
      age,
      allergies,
      currentMedicines,
      pregnancy,
      language,
    });

    // If turn limit reached or requested to conclude, clear any remaining follow-up questions
    if (shouldConclude && assessment.urgency !== "emergency") {
      assessment.followUpQuestions = [];
    }

    await logAuditEvent({
      actorId: session?.user?.id,
      actorRole: (session?.user as unknown as { role?: string })?.role || "anonymous",
      action: "ai_chat_turn_completed",
      outcome: "success",
      ip: clientIp,
      metadata: {
        turn: patientTurns,
        urgency: assessment.urgency,
        concluded: shouldConclude,
        requestId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: assessment,
        isConcluded: shouldConclude || assessment.urgency === "emergency" || assessment.followUpQuestions.length === 0,
        requestId,
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (err: unknown) {
    console.error(`[AI CHAT ERROR - ${requestId}]`, err);

    const isAssessmentUnavailable =
      err && typeof err === "object" && (err as { code?: string }).code === "AI_UNAVAILABLE";

    const errorStatus = isAssessmentUnavailable ? 503 : 500;
    const errorCode = isAssessmentUnavailable ? "AI_UNAVAILABLE" : "INTERNAL_ERROR";
    const errorMessage =
      isAssessmentUnavailable
        ? (err as Error).message
        : "We couldn't continue your assessment right now. This is not a sign that you are fine.";

    const safeAction =
      (err as { safeAction?: string })?.safeAction ||
      "If you have severe or worsening symptoms, call 112 immediately or visit the nearest healthcare facility.";

    return NextResponse.json(
      {
        error: {
          code: errorCode,
          message: errorMessage,
          safeAction,
          requestId,
        },
      },
      { status: errorStatus, headers: rateLimitHeaders }
    );
  }
}
