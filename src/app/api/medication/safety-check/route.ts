import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultMedicationService } from "@/services/medication-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { auth } from "@/lib/auth/auth";
import { isFeatureEnabled } from "@/lib/governance/feature-flags";

const safetyCheckRequestSchema = z.object({
  medications: z
    .array(z.string().min(1).max(100))
    .min(1, "At least one medication is required for safety assessment")
    .max(12, "Maximum of 12 medications can be evaluated simultaneously"),
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
      conditions: z.array(z.string()).optional().default([]),
      symptomsOrComplaint: z.string().max(1000).optional(),
      userQuestion: z.string().max(1000).optional(),
    })
    .default({
      pregnancy: "unknown",
      allergies: { status: "unknown", items: [] },
      currentMedicines: { status: "unknown", items: [] },
      conditions: [],
    }),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate Limiting: 30 requests per minute
  const rateLimit = checkRateLimit(`med_safety_${clientIp}`, {
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
            "You have exceeded the safety check rate limit. Please wait a moment before trying again.",
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
    const parseResult = safetyCheckRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid safety check request.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { medications, patientContext } = parseResult.data;

    let actorId: string | undefined;
    try {
      const session = await auth();
      if (session?.user?.id) {
        actorId = session.user.id;
      }
    } catch {
      // Guest allowed
    }

    const result = await defaultMedicationService.checkMultiDrugSafety({
      medicationNamesOrIds: medications,
      context: patientContext,
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
    console.error("[MedicationSafetyCheckAPI] Error executing safety check:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Unable to perform medication safety evaluation at this time. Please speak with a registered pharmacist.",
          requestId,
        },
      },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
