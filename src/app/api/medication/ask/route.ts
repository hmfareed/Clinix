import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultMedicationService } from "@/services/medication-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { auth } from "@/lib/auth/auth";
import { isFeatureEnabled } from "@/lib/governance/feature-flags";

const askMedicationRequestSchema = z.object({
  medicationId: z.string().max(100).optional(),
  medicationName: z.string().max(120).optional(),
  question: z
    .string()
    .min(1, "Question cannot be empty")
    .max(1000, "Question is too long (maximum 1000 characters)"),
  patientContext: z
    .object({
      ageYears: z.number().min(0).max(125).optional(),
      pregnancy: z.enum(["yes", "no", "unknown", "not_applicable"]).default("unknown"),
      breastfeeding: z.enum(["yes", "no", "unknown", "not_applicable"]).optional(),
      allergies: z
        .object({
          status: z.enum(["yes", "no", "unknown"]).default("unknown"),
          items: z.array(z.string()).default([]),
        })
        .default({ status: "unknown", items: [] }),
      currentMedicines: z
        .object({
          status: z.enum(["yes", "no", "unknown"]).default("unknown"),
          items: z.array(z.string()).default([]),
        })
        .default({ status: "unknown", items: [] }),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate Limiting: 30 requests per minute
  const rateLimit = checkRateLimit(`med_ai_${clientIp}`, {
    limit: 30,
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
          message:
            "You have reached the question rate limit for the medication assistant. Please wait a moment before asking again.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // Feature Flag Kill Switch
  const medEnabled = await isFeatureEnabled("medication_module_enabled");
  if (!medEnabled) {
    return NextResponse.json(
      {
        error: {
          code: "FEATURE_DISABLED",
          message:
            "The medication guidance module has been temporarily paused by administrative safety control. Please consult a registered pharmacist.",
          requestId,
        },
      },
      { status: 503, headers: rateLimitHeaders }
    );
  }

  try {
    const body = await req.json();
    const parseResult = askMedicationRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid medication inquiry.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { medicationId, medicationName, question, patientContext } = parseResult.data;

    if (!medicationId && !medicationName && !question) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Please specify a medication or health question.",
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    let actorId: string | undefined;
    try {
      const session = await auth();
      if (session?.user?.id) {
        actorId = session.user.id;
      }
    } catch {
      // Guest allowed
    }

    const result = await defaultMedicationService.askMedicationAi({
      medicationId,
      medicationName,
      question,
      patientContext,
      actorId,
      ip: clientIp,
    });

    return NextResponse.json(
      {
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (error: unknown) {
    console.error("[MedicationAiAPI] Error generating grounded medication answer:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Unable to generate medication guidance at this moment. For medication queries, please consult a licensed pharmacist directly.",
          requestId,
        },
      },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
