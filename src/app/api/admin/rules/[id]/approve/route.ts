import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import TriageRuleSet from "@/models/TriageRuleSet";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // STRICT CLINICAL GOVERNANCE: Only clinical_reviewer can approve rules
    const authResult = await requireAdminAuth(["clinical_reviewer"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule set not found." } },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const ruleSet = await TriageRuleSet.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "approved",
          approvedBy: authResult.user.email,
          approvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!ruleSet) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule set not found." } },
        { status: 404 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "rule_set_approved_by_clinical_reviewer",
      resourceType: "TriageRuleSet",
      resourceId: id,
      outcome: "success",
      ip: clientIp,
      metadata: { version: ruleSet.version, approvedBy: authResult.user.email },
    });

    return NextResponse.json({
      success: true,
      message: `Rule set '${ruleSet.version}' successfully approved by clinical reviewer.`,
      data: {
        id: String(ruleSet._id),
        version: ruleSet.version,
        approvalStatus: ruleSet.approvalStatus,
        approvedBy: ruleSet.approvedBy,
        approvedAt: ruleSet.approvedAt,
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

    console.error("[RuleApproveAPI] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to approve rule set." } },
      { status: 500 }
    );
  }
}
