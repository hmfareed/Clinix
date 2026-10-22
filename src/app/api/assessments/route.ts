import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "You must be signed in to view assessment history.",
          },
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // STRICT PATIENT SCOPING: Every query is scoped by the authenticated patientId
    const assessments = await Assessment.find({
      patientId: session.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: assessments.map((a) => ({
        id: String(a._id),
        status: a.status || (a.urgency ? "completed" : "draft"),
        isDraft: Boolean(a.isDraft),
        urgency: a.urgency,
        summary: a.summary,
        primaryComplaint: a.primaryComplaint,
        reportedFacts: a.reportedFacts,
        interviewProgress: a.interviewProgress,
        symptoms: a.symptoms,
        possibleConditions: a.possibleConditions,
        recommendations: a.recommendations,
        limitations: a.limitations,
        medicationGuidance: a.medicationGuidance,
        triage: a.triage,
        aiMetadata: a.aiMetadata,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        lastSavedAt: a.lastSavedAt,
        isUnverifiedAI: true,
      })),
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

    console.error("[AssessmentsAPI] Error fetching assessments:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve assessment records.",
        },
      },
      { status: 500 }
    );
  }
}
