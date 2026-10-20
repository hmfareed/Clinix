import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import SafetyIncident from "@/models/SafetyIncident";
import { logAuditEvent } from "@/lib/audit/audit";

const updateIncidentSchema = z.object({
  status: z.enum(["reported", "in_review", "action_taken", "resolved", "closed"]).optional(),
  assignedReviewer: z.string().optional(),
  rootCause: z.string().max(2000).optional(),
  correctiveAction: z.string().max(2000).optional(),
  ruleUpdateRequired: z.boolean().optional(),
  promptUpdateRequired: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(["clinical_reviewer", "system_admin", "support_admin"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Incident not found." } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parseResult = updateIncidentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid update fields.", details: parseResult.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updateFields: Record<string, unknown> = {};
    const { status, assignedReviewer, rootCause, correctiveAction, ruleUpdateRequired, promptUpdateRequired } = parseResult.data;

    if (status !== undefined) {
      updateFields.status = status;
      if (status === "resolved" || status === "closed") {
        updateFields.resolvedAt = new Date();
      }
    }
    if (assignedReviewer !== undefined) updateFields.assignedReviewer = assignedReviewer;
    if (rootCause !== undefined) updateFields.rootCause = rootCause;
    if (correctiveAction !== undefined) updateFields.correctiveAction = correctiveAction;
    if (ruleUpdateRequired !== undefined) updateFields.ruleUpdateRequired = ruleUpdateRequired;
    if (promptUpdateRequired !== undefined) updateFields.promptUpdateRequired = promptUpdateRequired;

    const incident = await SafetyIncident.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!incident) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Incident not found." } },
        { status: 404 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "safety_incident_updated",
      resourceType: "SafetyIncident",
      resourceId: id,
      outcome: "success",
      ip: clientIp,
      metadata: { incidentNumber: incident.incidentNumber, status: incident.status },
    });

    return NextResponse.json({
      success: true,
      message: `Incident ${incident.incidentNumber} updated.`,
      data: incident,
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

    console.error("[IncidentPATCH] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update incident." } },
      { status: 500 }
    );
  }
}
