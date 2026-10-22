import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase, tryConnectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    const assessment = await defaultFullAssessmentService.getAssessment(id, authContext);
    if (!assessment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Assessment record not found.", requestId } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: assessment,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[GET ASSESSMENT ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Could not retrieve assessment record.",
          requestId,
        },
      },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`assess_update_${clientIp}`, { limit: 40, windowSeconds: 60 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many updates.", requestId } },
      { status: 429 }
    );
  }

  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);
    const body = await req.json();

    const updated = await defaultFullAssessmentService.updateDraft(id, authContext, body);

    return NextResponse.json({
      success: true,
      data: updated,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[UPDATE ASSESSMENT ERROR - ${requestId}]`, err);
    const raw = (err as Error).message || "";
    const message = raw.includes("ECONNREFUSED") || raw.includes("Mongo")
      ? "Failed to save assessment to database. Progress retained in session."
      : raw || "Failed to update assessment.";

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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const { id } = await context.params;
    const authContext = await resolveAssistantAuth(req);

    if (await tryConnectToDatabase()) {
      await connectToDatabase();
      if (mongoose.Types.ObjectId.isValid(id)) {
        const assessment = await Assessment.findById(id);
        if (assessment) {
          await defaultFullAssessmentService.verifyOwnership(assessment, authContext);
          await Assessment.deleteOne({ _id: id });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[DELETE ASSESSMENT ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete assessment.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
