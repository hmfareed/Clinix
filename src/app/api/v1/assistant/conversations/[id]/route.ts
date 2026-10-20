import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";

export async function GET(
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

    const conversation = await defaultAssistantService.getConversation(id, authContext);
    const messages = await defaultAssistantService.getMessages(id, authContext);

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: String(conversation._id),
          title: conversation.title,
          status: conversation.status,
          currentState: conversation.currentState,
          assessmentId: conversation.assessmentId ? String(conversation.assessmentId) : undefined,
          lastActiveAt: conversation.lastActiveAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        messages: messages.map((m) => ({
          id: String(m._id),
          role: m.role,
          content: m.content,
          responseType: m.responseType,
          intent: m.intent,
          structuredPayload: m.structuredPayload,
          createdAt: m.createdAt,
        })),
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
          message:
            isNotFound
              ? "Conversation not found."
              : isUnauthorized
              ? "You do not have permission to view this conversation."
              : "Failed to retrieve conversation details.",
          requestId,
        },
      },
      { status: isNotFound ? 404 : isUnauthorized ? 403 : 500 }
    );
  }
}
