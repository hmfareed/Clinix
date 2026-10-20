import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import SafetyIncident from "@/models/SafetyIncident";
import { logAuditEvent } from "@/lib/audit/audit";

const createIncidentSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(5).max(150),
  description: z.string().min(10).max(2000),
  assessmentId: z.string().optional(),
  assignedReviewer: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    await connectToDatabase();
    const incidents = await SafetyIncident.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: incidents.map((inc) => ({
        id: String(inc._id),
        incidentNumber: inc.incidentNumber,
        severity: inc.severity,
        title: inc.title,
        description: inc.description,
        assessmentId: inc.assessmentId,
        status: inc.status,
        reportedBy: inc.reportedBy,
        assignedReviewer: inc.assignedReviewer,
        rootCause: inc.rootCause,
        correctiveAction: inc.correctiveAction,
        ruleUpdateRequired: inc.ruleUpdateRequired,
        promptUpdateRequired: inc.promptUpdateRequired,
        createdAt: inc.createdAt,
        resolvedAt: inc.resolvedAt,
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

    console.error("[AdminIncidentsGET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load incidents." } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    const body = await req.json();
    const parseResult = createIncidentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid incident payload.", details: parseResult.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const incidentNumber = `INC-2026-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const { severity, title, description, assessmentId, assignedReviewer } = parseResult.data;

    const incident = await SafetyIncident.create({
      incidentNumber,
      severity,
      title,
      description,
      assessmentId,
      status: "reported",
      reportedBy: authResult.user.email,
      assignedReviewer,
      ruleUpdateRequired: severity === "critical",
      promptUpdateRequired: severity === "critical",
    });

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "safety_incident_reported",
      resourceType: "SafetyIncident",
      resourceId: String(incident._id),
      outcome: "success",
      ip: clientIp,
      metadata: { incidentNumber, severity },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Safety incident ${incidentNumber} reported successfully.`,
        data: {
          id: String(incident._id),
          incidentNumber: incident.incidentNumber,
          severity: incident.severity,
          status: incident.status,
        },
      },
      { status: 201 }
    );
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

    console.error("[AdminIncidentsPOST] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to file safety incident." } },
      { status: 500 }
    );
  }
}
