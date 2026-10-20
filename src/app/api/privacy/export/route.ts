import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import PatientProfile from "@/models/PatientProfile";
import Assessment from "@/models/Assessment";
import Reminder from "@/models/Reminder";
import Consent from "@/models/Consent";
import { logAuditEvent } from "@/lib/audit/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to export your personal data.",
          },
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const [user, profile, assessments, reminders, consents] = await Promise.all([
      User.findById(session.user.id).select("-passwordHash").lean(),
      PatientProfile.findOne({ userId: session.user.id }).lean(),
      Assessment.find({ patientId: session.user.id }).sort({ createdAt: -1 }).lean(),
      Reminder.find({ patientId: session.user.id }).sort({ dueDate: 1 }).lean(),
      Consent.find({ userId: session.user.id }).sort({ grantedAt: -1 }).lean(),
    ]);

    const exportData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        jurisdiction: "Ghana (Act 843 Data Protection Act Compliant)",
        disclaimerNotice:
          "AI-GENERATED AND UNVERIFIED BY A CLINICIAN. Clinix is an automated informational assessment platform. These summaries reflect patient-reported symptoms and algorithmic outputs, and are NOT verified medical diagnoses or prescriptions.",
      },
      account: {
        id: session.user.id,
        email: user?.email,
        name: user?.name,
        role: user?.role,
        emailVerified: user?.emailVerified,
        createdAt: user?.createdAt,
      },
      healthProfile: profile
        ? {
            ageYears: profile.ageYears ?? "unknown",
            allergies: profile.allergies,
            currentMedicines: profile.currentMedicines,
            pregnancy: profile.pregnancy,
            emergencyContact: profile.emergencyContact,
            updatedAt: profile.updatedAt,
          }
        : null,
      assessments: assessments.map((a) => ({
        id: String(a._id),
        date: a.createdAt,
        urgency: a.urgency,
        summary: a.summary,
        symptoms: a.symptoms,
        possibleConditions: a.possibleConditions,
        recommendations: a.recommendations,
        limitations: a.limitations,
        medicationGuidance: a.medicationGuidance,
        triageRuleSet: a.triage?.ruleSetVersion,
        clinicalStatus: "Unverified AI Output",
      })),
      reminders: reminders.map((r) => ({
        id: String(r._id),
        title: r.title,
        description: r.description,
        type: r.reminderType,
        dueDate: r.dueDate,
        status: r.status,
      })),
      consentRecords: consents.map((c) => ({
        type: c.type,
        policyVersion: c.policyVersion,
        status: c.status,
        grantedAt: c.grantedAt,
        withdrawnAt: c.withdrawnAt,
      })),
    };

    // Log audit event
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: "patient",
      action: "personal_data_exported",
      resourceType: "PatientData",
      resourceId: session.user.id,
      outcome: "success",
      ip: clientIp,
    });

    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="clinix-patient-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
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

    console.error("[DataExportAPI] Error generating data export:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate personal data export.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Support both POST and GET for data export
  return GET(req);
}
