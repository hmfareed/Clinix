import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`assess_ctx_${clientIp}`, { limit: 30, windowSeconds: 60 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests.", requestId } },
      { status: 429 }
    );
  }

  try {
    const authContext = await resolveAssistantAuth(req);
    const context = await defaultFullAssessmentService.getAssessmentContext(authContext);

    return NextResponse.json({
      success: true,
      data: context,
      requestId,
    });
  } catch (err: unknown) {
    console.warn(`[ASSESSMENT CONTEXT FALLBACK - ${requestId}]`, err);
    // Graceful fallback to fresh assessment state instead of 500 error
    return NextResponse.json({
      success: true,
      data: {
        hasActiveDraft: false,
        hasRecentConversation: false,
        isOffline: true,
      },
      requestId,
    });
  }
}
