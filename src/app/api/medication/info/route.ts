import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultMedicationService } from "@/services/medication-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { auth } from "@/lib/auth/auth";
import { isFeatureEnabled } from "@/lib/governance/feature-flags";

const patientContextSchema = z.object({
  ageYears: z.number().min(0).max(125).optional(),
  pregnancy: z.enum(["yes", "no", "unknown", "not_applicable"]).default("unknown"),
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
  symptomsOrComplaint: z.string().max(1000).optional(),
  userQuestion: z.string().max(1000).optional(),
});

const medicationInfoRequestSchema = z.object({
  medicationName: z
    .string()
    .min(1, "Medication name or query is required")
    .max(100, "Medication name too long"),
  patientContext: patientContextSchema.default({
    pregnancy: "unknown",
    allergies: { status: "unknown", items: [] },
    currentMedicines: { status: "unknown", items: [] },
  }),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate limiting: 30 queries per minute per client
  const rateLimit = checkRateLimit(`med_info_${clientIp}`, {
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
          message: "You have exceeded the request rate limit for medication queries. Please wait a moment before trying again.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // Feature Flag Kill Switch Check
  const medEnabled = await isFeatureEnabled("medication_module_enabled");
  if (!medEnabled) {
    return NextResponse.json(
      {
        error: {
          code: "FEATURE_DISABLED",
          message: "The medication guidance module has been temporarily paused by administrative safety control. Please consult a registered pharmacist.",
          requestId,
        },
      },
      { status: 503, headers: rateLimitHeaders }
    );
  }

  try {
    const body = await req.json();
    const parseResult = medicationInfoRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid medication query input.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { medicationName, patientContext } = parseResult.data;

    // Check optional authenticated session
    let actorId: string | undefined;
    try {
      const session = await auth();
      if (session?.user?.id) {
        actorId = session.user.id;
      }
    } catch {
      // Unauthenticated / guest access is allowed
    }

    const guidance = await defaultMedicationService.getMedicationGuidance({
      query: medicationName,
      context: patientContext,
      actorId,
      ip: clientIp,
    });

    return NextResponse.json(
      {
        data: guidance,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("[MedicationAPI] Error processing medication info query:", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to process medication request at this time. Please consult a licensed pharmacist or physician directly.",
          requestId,
        },
      },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
