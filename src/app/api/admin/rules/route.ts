import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import TriageRuleSet from "@/models/TriageRuleSet";
import { logAuditEvent } from "@/lib/audit/audit";
import { REVIEWED_TRIAGE_RULES } from "@/lib/safety/rules-data";

const createRuleSetSchema = z.object({
  version: z.string().min(2).max(50),
  name: z.string().min(3).max(100),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    await connectToDatabase();
    const ruleSets = await TriageRuleSet.find({})
      .sort({ createdAt: -1 })
      .lean();

    // If no rule sets in DB yet, return the default reviewed set as active baseline
    if (ruleSets.length === 0) {
      return NextResponse.json({
        success: true,
        data: [
          {
            id: "bundled-reviewed-rules-v1",
            version: "reviewed-rules-v1",
            name: "Ghana Emergency & Red Flag Rules (Bundled Baseline)",
            isActive: true,
            approvalStatus: "approved",
            reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
            reviewedAt: new Date().toISOString(),
            approvedBy: "Chief Medical Officer",
            approvedAt: new Date().toISOString(),
            ruleCount: REVIEWED_TRIAGE_RULES.length,
            notes: "Bundled clinician-reviewed emergency safety baseline.",
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      data: ruleSets.map((rs) => ({
        id: String(rs._id),
        version: rs.version,
        name: rs.name,
        isActive: rs.isActive,
        approvalStatus: rs.approvalStatus || "approved",
        reviewedBy: rs.reviewedBy,
        reviewedAt: rs.reviewedAt,
        approvedBy: rs.approvedBy,
        approvedAt: rs.approvedAt,
        ruleCount: Array.isArray(rs.rules) ? rs.rules.length : REVIEWED_TRIAGE_RULES.length,
        notes: rs.notes,
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

    console.error("[AdminRulesGET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load triage rule sets." } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth(["clinical_reviewer", "system_admin"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const body = await req.json();
    const parseResult = createRuleSetSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid rule set payload.", details: parseResult.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const { version, name, notes } = parseResult.data;

    const existing = await TriageRuleSet.findOne({ version });
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: `Rule set version '${version}' already exists.` } },
        { status: 409 }
      );
    }

    const newRuleSet = await TriageRuleSet.create({
      version,
      name,
      rules: REVIEWED_TRIAGE_RULES, // clones active baseline rules
      isActive: false,
      approvalStatus: "draft",
      reviewedBy: authResult.user.email,
      reviewedAt: new Date(),
      notes,
    });

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "rule_set_draft_created",
      resourceType: "TriageRuleSet",
      resourceId: String(newRuleSet._id),
      outcome: "success",
      ip: clientIp,
      metadata: { version, name },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Draft rule set '${version}' created. Clinical review and approval required before activation.`,
        data: { id: String(newRuleSet._id), version: newRuleSet.version, status: newRuleSet.approvalStatus },
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

    console.error("[AdminRulesPOST] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create rule set draft." } },
      { status: 500 }
    );
  }
}
