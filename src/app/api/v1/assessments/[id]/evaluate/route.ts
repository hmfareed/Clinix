import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`assess_eval_${clientIp}`, { limit: 15, windowSeconds: 60 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many evaluations.", requestId } },
      { status: 429 }
    );
  }

  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    const completed = await defaultFullAssessmentService.evaluateAssessment(id, authContext);

    return NextResponse.json({
      success: true,
      data: completed,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[EVALUATE ASSESSMENT ERROR - ${requestId}]`, err);
    const raw = (err as Error).message || "";
    const message = raw.includes("ECONNREFUSED") || raw.includes("Mongo")
      ? "Unable to record assessment completion to database. Completed evaluation returned."
      : raw || "Failed to evaluate assessment.";

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message,
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
