import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    if (!authContext.userId && !authContext.guestTokenHash) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication or valid guest session required.",
            requestId,
          },
        },
        { status: 401 }
      );
    }

    const conversation = await defaultAssistantService.finishConversation(id, authContext);

    return NextResponse.json({
      success: true,
      data: {
        id: String(conversation._id),
        status: conversation.status,
        currentState: conversation.currentState,
        lastActiveAt: conversation.lastActiveAt,
      },
      requestId,
    });
  } catch (err: unknown) {
    const errorCode = (err as { code?: string })?.code;
    const isNotFound = errorCode === "CONVERSATION_NOT_FOUND";
    const isUnauthorized = errorCode === "UNAUTHORIZED_CONVERSATION_ACCESS";

    return NextResponse.json(
      {
        error: {
          code: isNotFound ? "NOT_FOUND" : isUnauthorized ? "FORBIDDEN" : "INTERNAL_ERROR",
          message: isNotFound
            ? "Conversation not found."
            : isUnauthorized
            ? "You do not have permission to modify this conversation."
            : "Failed to finalize conversation.",
          requestId,
        },
      },
      { status: isNotFound ? 404 : isUnauthorized ? 403 : 500 }
    );
  }
}
