import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MedicationFeedback } from "@/models/MedicationFeedback";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit/audit";

const feedbackSchema = z.object({
  medicationId: z.string().min(1).max(100),
  medicationName: z.string().min(1).max(150),
  feedbackType: z.enum([
    "incorrect_information",
    "missing_warning",
    "dosage_discrepancy",
    "side_effect_update",
    "general_feedback",
  ]),
  details: z.string().min(5, "Please provide more details").max(2000),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  const rateLimit = checkRateLimit(`med_fb_${clientIp}`, {
    limit: 15,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many feedback submissions. Please try again later.",
          requestId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = feedbackSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid feedback form submission.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    let userId: string | undefined;
    try {
      const session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    } catch {
      // Guest allowed
    }

    await connectToDatabase();
    const feedbackDoc = await MedicationFeedback.create({
      medicationId: data.medicationId,
      medicationName: data.medicationName,
      feedbackType: data.feedbackType,
      details: data.details,
      contactEmail: data.contactEmail || undefined,
      userId: userId ? userId : undefined,
      status: "submitted",
    });

    try {
      await logAuditEvent({
        actorId: userId,
        actorRole: userId ? "patient" : "guest",
        action: "MEDICATION_FEEDBACK_SUBMITTED",
        resourceType: "MedicalReference",
        resourceId: data.medicationId,
        outcome: "success",
        metadata: {
          feedbackType: data.feedbackType,
          feedbackId: feedbackDoc._id.toString(),
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json(
      {
        message: "Thank you. Your feedback has been submitted to the clinical governance team.",
        data: { id: feedbackDoc._id.toString() },
        meta: { requestId },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[MedicationFeedbackAPI] Error saving feedback:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to submit feedback at this time.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
