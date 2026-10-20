import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import AssistantFeedback from "@/models/AssistantFeedback";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";

const feedbackSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().optional(),
  rating: z.enum(["positive", "negative", "helpful", "not_helpful", "concerning"]),
  feedbackText: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`feedback_${clientIp}`, {
    limit: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many feedback submissions. Please wait a moment.",
          requestId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const authContext = await resolveAssistantAuth(req);
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = feedbackSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid feedback submission.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const { conversationId, messageId, rating, feedbackText, category } = parseResult.data;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid conversation ID format.",
            requestId,
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await AssistantFeedback.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      messageId: messageId && mongoose.Types.ObjectId.isValid(messageId) ? new mongoose.Types.ObjectId(messageId) : undefined,
      userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
      rating,
      feedbackText,
      category,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Thank you for your feedback. It helps improve Clinix safety.",
        requestId,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error(`[SUBMIT FEEDBACK ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to record feedback.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
