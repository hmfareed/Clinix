import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import AssessmentSession from "@/models/AssessmentSession";
import { logAuditEvent } from "@/lib/audit/audit";

const breakGlassSchema = z.object({
  resourceType: z.enum(["Assessment", "AssessmentSession"]),
  resourceId: z.string().min(1),
  justificationReason: z
    .string()
    .min(15, "Justification must be at least 15 characters explaining clinical or regulatory necessity."),
  durationMinutes: z.number().min(5).max(120).default(30),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth([
      "clinical_reviewer",
      "support_admin",
      "system_admin",
      "auditor",
    ]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const body = await req.json();
    const parseResult = breakGlassSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Break-glass requests require an explicit clinical or regulatory justification.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { resourceType, resourceId, justificationReason, durationMinutes } = parseResult.data;

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Target medical resource not found." } },
        { status: 404 }
      );
    }

    await connectToDatabase();

    let targetData: any = null;
    if (resourceType === "Assessment") {
      targetData = await Assessment.findById(resourceId).lean();
    } else {
      targetData = await AssessmentSession.findById(resourceId).lean();
    }

    if (!targetData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Target medical record does not exist." } },
        { status: 404 }
      );
    }

    // MANDATORY BREAK-GLASS AUDIT LOGGING:
    // Every single break-glass actuation is permanently recorded with the clinician's stated justification
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "break_glass_access_granted",
      resourceType,
      resourceId,
      outcome: "success",
      ip: clientIp,
      metadata: {
        justificationReason,
        durationMinutes,
        authorizedUntil: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        auditorNotified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Emergency break-glass access approved for ${durationMinutes} minutes. All activity is audited.`,
      accessGrant: {
        resourceType,
        resourceId,
        authorizedBy: authResult.user.email,
        authorizedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
      },
      unlockedRecord: targetData,
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

    console.error("[BreakGlassAPI] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process break-glass request." } },
      { status: 500 }
    );
  }
}
