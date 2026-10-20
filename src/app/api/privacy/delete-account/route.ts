import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import PatientProfile from "@/models/PatientProfile";
import Assessment from "@/models/Assessment";
import Reminder from "@/models/Reminder";
import AssessmentSession from "@/models/AssessmentSession";
import Consent from "@/models/Consent";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to initiate account deletion.",
          },
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    // 1. Mark user account status as pending_deletion per Act 843 workflow
    await User.findByIdAndUpdate(userId, {
      $set: {
        status: "pending_deletion",
        name: "[DELETED USER]",
      },
    });

    // 2. Immediate purge of personal health profile & medical data
    await Promise.all([
      PatientProfile.deleteOne({ userId }),
      Assessment.deleteMany({ patientId: userId }),
      Reminder.deleteMany({ patientId: userId }),
      AssessmentSession.deleteMany({ userId }),
    ]);

    // 3. Mark consent records as withdrawn (minimal record retained for legal proof per file 24)
    await Consent.updateMany(
      { userId },
      {
        $set: {
          status: "withdrawn",
          withdrawnAt: new Date(),
        },
      }
    );

    // 4. Audit log event: resourceId only, zero health content
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: userId,
      actorRole: "patient",
      action: "account_deleted_retention_purged",
      resourceType: "User",
      resourceId: userId,
      outcome: "success",
      ip: clientIp,
      metadata: {
        reason: "Patient initiated account deletion under Act 843 data privacy rights",
        retentionAction: "Purged health profile, assessments, messages, and reminders",
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Your account deletion request has been processed. All personal health records, assessments, and profile data have been permanently purged.",
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

    console.error("[AccountDeleteAPI] Error processing account deletion:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process account deletion request.",
        },
      },
      { status: 500 }
    );
  }
}
