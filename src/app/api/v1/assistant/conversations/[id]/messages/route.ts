import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";

const messageInputSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (maximum 2000 characters)"),
  clientMessageId: z.string().max(128).optional(),
  locationContext: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusMeters: z.number().min(500).max(25000).optional(),
      locationName: z.string().max(120).optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`conv_msg_${clientIp}`, {
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
          message: "You are sending messages too quickly. Please pause briefly before continuing.",
          safeAction: "If you are in acute distress, call 112 immediately.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  try {
    const { id: conversationId } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    if (!authContext.userId && !authContext.guestTokenHash) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "A valid session or guest token is required to send messages.",
            safeAction: "If you have an urgent medical concern, call 112 immediately.",
            requestId,
          },
        },
        { status: 401, headers: rateLimitHeaders }
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = messageInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid message payload.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const result = await defaultAssistantService.processPatientMessage({
      conversationId,
      message: parseResult.data.message,
      clientMessageId: parseResult.data.clientMessageId,
      locationContext: parseResult.data.locationContext,
      authContext,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        requestId,
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (err: unknown) {
    console.error(`[MESSAGE PROCESSING ERROR - ${requestId}]`, err);

    const errorCode = (err as { code?: string })?.code;
    const isNotFound = errorCode === "CONVERSATION_NOT_FOUND";
    const isUnauthorized = errorCode === "UNAUTHORIZED_CONVERSATION_ACCESS";
    const isInvalidTransition = errorCode === "INVALID_STATE_TRANSITION";

    const httpStatus = isNotFound
      ? 404
      : isUnauthorized
      ? 403
      : isInvalidTransition
      ? 400
      : 500;

    const message =
      isNotFound
        ? "Conversation not found."
        : isUnauthorized
        ? "You do not have permission to post to this conversation."
        : isInvalidTransition
        ? "Invalid state transition requested for this conversation."
        : "Failed to process message safely.";

    return NextResponse.json(
      {
        error: {
          code: errorCode || "INTERNAL_ERROR",
          message,
          safeAction: "If you have severe, acute, or worsening symptoms, call 112 immediately or visit the nearest clinic.",
          requestId,
        },
      },
      { status: httpStatus, headers: rateLimitHeaders }
    );
  }
}
