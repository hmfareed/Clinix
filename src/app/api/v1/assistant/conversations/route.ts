import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createGuestSession, GUEST_COOKIE_NAME, GUEST_TTL_HOURS } from "@/lib/auth/guest-session";

const createConversationSchema = z.object({
  title: z.string().max(120).optional(),
  language: z.string().max(10).default("en"),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`conv_create_${clientIp}`, {
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many conversation requests. Please wait a moment.",
          requestId,
        },
      },
      { status: 429 }
    );
  }

  try {
    let authContext = await resolveAssistantAuth(req);
    let guestTokenToSet: string | null = null;

    // If neither authenticated nor guest token present, automatically establish a guest session
    if (!authContext.userId && !authContext.guestTokenHash) {
      const guestResult = await createGuestSession();
      authContext = {
        guestTokenHash: guestResult.session.guestTokenHash,
        isAuthenticated: false,
      };
      guestTokenToSet = guestResult.rawToken;
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createConversationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid conversation parameters.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const conversation = await defaultAssistantService.createConversation({
      title: parseResult.data.title,
      language: parseResult.data.language,
      authContext,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: String(conversation._id),
          title: conversation.title,
          status: conversation.status,
          currentState: conversation.currentState,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        requestId,
      },
      { status: 201 }
    );

    if (guestTokenToSet) {
      response.cookies.set({
        name: GUEST_COOKIE_NAME,
        value: guestTokenToSet,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: GUEST_TTL_HOURS * 3600,
        path: "/",
      });
    }

    return response;
  } catch (err: unknown) {
    console.error(`[CREATE CONVERSATION ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initialize conversation session.",
          safeAction: "If you are in distress, please dial 112 immediately.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const authContext = await resolveAssistantAuth(req);
    if (!authContext.userId && !authContext.guestTokenHash) {
      return NextResponse.json({
        success: true,
        data: [],
        requestId,
      });
    }

    const conversations = await defaultAssistantService.listConversations(authContext);

    return NextResponse.json({
      success: true,
      data: conversations.map((c) => ({
        id: String(c._id),
        title: c.title,
        status: c.status,
        currentState: c.currentState,
        assessmentId: c.assessmentId ? String(c.assessmentId) : undefined,
        lastActiveAt: c.lastActiveAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[LIST CONVERSATIONS ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list conversations.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
