import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
import { resolveAssistantAuth } from "@/lib/assistant/auth-helper";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { connectToDatabase, tryConnectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import mongoose from "mongoose";

const initAssessmentSchema = z.object({
  source: z.enum(["new", "conversation", "resume"]).default("new"),
  conversationId: z.string().optional(),
  draftId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`assess_init_${clientIp}`, { limit: 20, windowSeconds: 60 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests.", requestId } },
      { status: 429 }
    );
  }

  try {
    const authContext = await resolveAssistantAuth(req);
    const body = await req.json().catch(() => ({}));
    const parse = initAssessmentSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid assessment initialization request.",
            details: parse.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const assessment = await defaultFullAssessmentService.initAssessment({
      authContext,
      source: parse.data.source,
      conversationId: parse.data.conversationId,
      draftId: parse.data.draftId,
    });

    return NextResponse.json({
      success: true,
      data: assessment,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[INIT ASSESSMENT ERROR - ${requestId}]`, err);
    const raw = (err as Error).message || "";
    const message = raw.includes("ECONNREFUSED") || raw.includes("Mongo")
      ? "Assessment initialized in session mode."
      : raw || "Failed to initialize assessment.";

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

export async function GET(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  try {
    const authContext = await resolveAssistantAuth(req);

    const dbAvailable = await tryConnectToDatabase();
    if (!dbAvailable) {
      const inMemory = defaultFullAssessmentService.listInMemoryAssessments(authContext);
      return NextResponse.json({
        success: true,
        data: inMemory,
        requestId,
      });
    }

    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (authContext.userId) {
      query.patientId = new mongoose.Types.ObjectId(authContext.userId);
    } else {
      return NextResponse.json({ success: true, data: [] });
    }

    const assessments = await Assessment.find(query).sort({ updatedAt: -1 }).limit(30).lean();

    return NextResponse.json({
      success: true,
      data: assessments.map((a) => ({
        id: String(a._id),
        status: a.status,
        isDraft: a.isDraft,
        urgency: a.urgency,
        summary: a.summary,
        primaryComplaint: a.primaryComplaint,
        symptoms: a.symptoms,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        lastSavedAt: a.lastSavedAt,
      })),
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[LIST ASSESSMENTS ERROR - ${requestId}]`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list assessments.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
