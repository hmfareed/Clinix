import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import { logAuditEvent } from "@/lib/audit/audit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to view this assessment.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    await connectToDatabase();

    // STRICT PATIENT SCOPING: Must match both _id AND patientId
    const assessment = await Assessment.findOne({
      _id: id,
      patientId: session.user.id,
    }).lean();

    if (!assessment) {
      // Return 404 rather than 403 to prevent object existence enumeration
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment not found or inaccessible.",
          },
        },
        { status: 404 }
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
        isUnverifiedAI: true,
        disclaimerNotice: "AI-GENERATED AND UNVERIFIED BY A CLINICIAN. Clinix is an automated informational assessment platform and does not provide formal medical diagnoses or prescriptions.",
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[AssessmentDetailAPI] Error fetching assessment:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve assessment details.",
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to delete assessments.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    await connectToDatabase();

    // STRICT PATIENT SCOPING: Only delete if owned by the authenticated patient
    const deleted = await Assessment.findOneAndDelete({
      _id: id,
      patientId: session.user.id,
    });

    if (!deleted) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Assessment not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    // Audit event: record resourceId only, zero clinical transcript content
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: "patient",
      action: "assessment_deleted",
      resourceType: "Assessment",
      resourceId: id,
      outcome: "success",
      ip: clientIp,
    });

    return NextResponse.json({
      success: true,
      message: "Assessment successfully deleted.",
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[AssessmentDeleteAPI] Error deleting assessment:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete assessment.",
        },
      },
      { status: 500 }
    );
  }
}
