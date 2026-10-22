import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";

const interviewAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  questionId: z.string().optional(),
  concludeNow: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`assess_interview_${clientIp}`, { limit: 25, windowSeconds: 60 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many messages.", requestId } },
      { status: 429 }
    );
  }

  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);
    const body = await req.json();
    const parse = interviewAnswerSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid interview answer format.",
            details: parse.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const updated = await defaultFullAssessmentService.submitInterviewAnswer(
      id,
      authContext,
      parse.data
    );

    return NextResponse.json({
      success: true,
      data: updated,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[INTERVIEW ANSWER ERROR - ${requestId}]`, err);
    const raw = (err as Error).message || "";
    const message = raw.includes("ECONNREFUSED") || raw.includes("Mongo")
      ? "Unable to record interview response to database. Proceeding in session mode."
      : raw || "Failed to process interview answer.";

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
