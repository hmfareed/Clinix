import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { assessSymptoms } from "@/services/assessment-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit/audit";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";

const assessRequestSchema = z.object({
  sessionId: z.string().optional(),
  symptoms: z.string().min(3, "Please describe your symptoms in at least 3 characters").max(2000),
  age: z.number().min(0).max(120).optional(),
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
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate Limiting (15 requests per minute for AI assessment)
  const rateLimit = checkRateLimit(`ai_assess_${clientIp}`, {
    limit: 15,
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
          message: "You have exceeded the request rate limit for symptom assessment. Please wait before trying again.",
          safeAction: "If you feel this is an emergency, call 112 immediately.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  try {
    const session = await auth();
    const rawBody = await req.json();
    const parseResult = assessRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid assessment request payload.",
            safeAction: "Please review the form fields or dial 112 if you are in distress.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const assessment = await assessSymptoms(parseResult.data);

    // If authenticated user, persist structured assessment
    let persistedAssessmentId: string | undefined;
    if (session?.user?.id) {
      try {
        await connectToDatabase();
        const saved = await Assessment.create({
          patientId: session.user.id,
          sessionId: parseResult.data.sessionId,
          symptoms: [{ description: parseResult.data.symptoms }],
          urgency: assessment.urgency,
          summary: assessment.summary,
          possibleConditions: assessment.possibleConditions,
          recommendations: assessment.recommendedNextSteps,
          limitations: assessment.limitations,
          medicationGuidance: assessment.medicationGuidance,
          triage: {
            level: assessment.urgency,
            ruleSetVersion: assessment.aiMetadata.ruleSetVersion,
            checkedAt: new Date(assessment.aiMetadata.completedAt || Date.now()),
          },
          aiMetadata: {
            provider: assessment.aiMetadata.provider,
            model: assessment.aiMetadata.model,
            promptVersion: assessment.aiMetadata.promptVersion,
          },
        });
        persistedAssessmentId = String(saved._id);
      } catch (saveErr) {
        console.error("[AssessAPI] Could not persist assessment to database:", saveErr);
      }
    }

    // Audit log (sanitized, no full transcript)
    await logAuditEvent({
      actorId: session?.user?.id,
      actorRole: (session?.user as unknown as { role?: string })?.role || "anonymous",
      action: "ai_assessment_completed",
      resourceType: "Assessment",
      resourceId: persistedAssessmentId,
      outcome: "success",
      ip: clientIp,
      metadata: {
        urgency: assessment.urgency,
        ruleSetVersion: assessment.aiMetadata.ruleSetVersion,
        provider: assessment.aiMetadata.provider,
        requestId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        assessmentId: persistedAssessmentId,
        data: assessment,
        requestId,
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (err: unknown) {
    console.error(`[AI ASSESS ERROR - ${requestId}]`, err);

    const isAssessmentUnavailable =
      err && typeof err === "object" && (err as { code?: string }).code === "AI_UNAVAILABLE";

    const errorStatus = isAssessmentUnavailable ? 503 : 500;
    const errorCode = isAssessmentUnavailable ? "AI_UNAVAILABLE" : "INTERNAL_ERROR";
    const errorMessage =
      isAssessmentUnavailable
        ? (err as Error).message
        : "We couldn't complete your assessment right now. This is not a sign that you are fine.";

    const safeAction =
      (err as { safeAction?: string })?.safeAction ||
      "If you have severe, acute, or worsening symptoms, call 112 immediately or visit the nearest emergency facility.";

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
