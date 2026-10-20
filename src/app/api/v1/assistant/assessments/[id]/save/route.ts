import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    if (!authContext.userId) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "You must be signed in to permanently save an assessment to your personal health record.",
            safeAction: "Create or log in to your account to save your health records.",
            requestId,
          },
        },
        { status: 401 }
      );
    }

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
    const assessment = await Assessment.findById(id);

    if (!assessment) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment not found.",
            requestId,
          },
        },
        { status: 404 }
      );
    }

    // Link/confirm user ownership
    assessment.patientId = new mongoose.Types.ObjectId(authContext.userId);
    await assessment.save();

    await logAuditEvent({
      actorId: authContext.userId,
      actorRole: "patient",
      action: "ASSESSMENT_RECORD_SAVED",
      resourceType: "Assessment",
      resourceId: String(assessment._id),
      outcome: "success",
      ip: clientIp,
      metadata: {
        urgency: assessment.urgency,
        ruleSetVersion: assessment.triage?.ruleSetVersion,
        requestId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(assessment._id),
        saved: true,
        patientId: authContext.userId,
        updatedAt: assessment.updatedAt,
      },
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[SAVE ASSESSMENT ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save assessment to records.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
