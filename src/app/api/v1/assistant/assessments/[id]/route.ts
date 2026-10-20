import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import AssistantConversation from "@/models/AssistantConversation";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid assessment ID format.",
            requestId,
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const assessment = await Assessment.findById(id).lean();

    if (!assessment) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment record not found.",
            requestId,
          },
        },
        { status: 404 }
      );
    }

    // Ownership check:
    // 1. If signed in, match patientId
    let isOwner = false;
    if (authContext.userId && assessment.patientId.toString() === authContext.userId) {
      isOwner = true;
    }

    // 2. Or check if the linked conversation matches user or guest token
    if (!isOwner && assessment.conversationId) {
      const conv = await AssistantConversation.findById(assessment.conversationId).lean();
      if (conv) {
        if (authContext.userId && conv.userId?.toString() === authContext.userId) {
          isOwner = true;
        } else if (authContext.guestTokenHash && conv.guestTokenHash === authContext.guestTokenHash) {
          isOwner = true;
        }
      }
    }

    if (!isOwner) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You are not authorized to view this assessment.",
            requestId,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(assessment._id),
        urgency: assessment.urgency,
        summary: assessment.summary,
        symptoms: assessment.symptoms,
        possibleConditions: assessment.possibleConditions,
        recommendations: assessment.recommendations,
        limitations: assessment.limitations,
        medicationGuidance: assessment.medicationGuidance,
        triage: assessment.triage,
        aiMetadata: assessment.aiMetadata,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
      },
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[GET ASSESSMENT ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve assessment.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
